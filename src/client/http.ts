import { httpActionGeneric } from "convex/server";
import type { HttpRouter } from "convex/server";
import type { ComponentApi } from "../component/_generated/component";
import type {
	SiteConfig,
	ActionCtx,
	IngestContext,
	IngestEventInput,
} from "./types";
import {
	corsHeaders,
	jsonResponse,
	hashWriteKey,
	readRecord,
	normalizeContext,
	normalizeEvents,
} from "./helpers";

export const ensureIntervalMs = 60 * 1000;
export const lastEnsuredAtByHash = new Map<string, number>();

export function registerRoutes(
	http: HttpRouter,
	component: ComponentApi,
	options?: {
		path?: string;
		allowedHeaders?: string[];
		site?: SiteConfig;
		sites?: SiteConfig[];
	},
) {
	const path = options?.path ?? "/analytics/ingest";
	const allowedHeaders = options?.allowedHeaders ?? [
		"content-type",
		"x-analytics-write-key",
	];
	const configuredSites =
		options?.sites ?? (options?.site ? [options.site] : []);
	http.route({
		path,
		method: "OPTIONS",
		handler: httpActionGeneric(async () => {
			return new Response(null, {
				status: 204,
				headers: corsHeaders("*", allowedHeaders),
			});
		}),
	});
	http.route({
		path,
		method: "POST",
		handler: httpActionGeneric(async (ctx, request) => {
			const origin = request.headers.get("origin") ?? undefined;
			const writeKey =
				request.headers.get("x-analytics-write-key") ??
				new URL(request.url).searchParams.get("writeKey");
			if (!writeKey) {
				return jsonResponse(
					{ error: "Missing analytics write key" },
					401,
					origin,
				);
			}
			const writeKeyHash = await hashWriteKey(writeKey);
			const configuredSite =
				configuredSites.length > 0
					? await findConfiguredSite(configuredSites, writeKeyHash)
					: null;
			if (configuredSites.length > 0 && !configuredSite) {
				return jsonResponse(
					{ error: "Invalid analytics write key" },
					401,
					origin,
				);
			}
			if (configuredSite) {
				await ensureConfiguredSite(
					ctx,
					component,
					configuredSite,
					writeKeyHash,
				);
			}
			const body = await request.json();
			const result = await ingestFromHttp(ctx, component, {
				writeKeyHash,
				origin,
				visitorId: String(readRecord(body).visitorId ?? ""),
				sessionId: String(readRecord(body).sessionId ?? ""),
				context: normalizeContext(readRecord(body).context),
				events: normalizeEvents(readRecord(body).events),
			});
			return jsonResponse(result, 202, origin);
		}),
	});
}

export async function ingestFromHttp(
	ctx: ActionCtx,
	component: ComponentApi,
	args: {
		writeKey?: string;
		writeKeyHash?: string;
		origin?: string;
		visitorId: string;
		sessionId: string;
		context?: IngestContext;
		events: IngestEventInput[];
	},
) {
	if (!args.visitorId || !args.sessionId) {
		throw new Error("visitorId and sessionId are required");
	}

	const writeKeyHash =
		args.writeKeyHash ??
		(args.writeKey ? await hashWriteKey(args.writeKey) : undefined);
	if (!writeKeyHash) {
		throw new Error("writeKey or writeKeyHash is required");
	}

	return await ctx.runMutation(component.lib.ingestBatch, {
		writeKeyHash,
		origin: args.origin,
		visitorId: args.visitorId,
		sessionId: args.sessionId,
		context: args.context,
		events: args.events,
	});
}

export async function findConfiguredSite(
	sites: SiteConfig[],
	writeKeyHash: string,
) {
	for (const site of sites) {
		const configuredHash =
			site.writeKeyHash ??
			(site.writeKey ? await hashWriteKey(site.writeKey) : undefined);
		if (configuredHash === writeKeyHash) {
			return site;
		}
	}

	return null;
}

export async function ensureConfiguredSite(
	ctx: ActionCtx,
	component: ComponentApi,
	site: SiteConfig,
	writeKeyHash: string,
) {
	const now = Date.now();
	const lastEnsuredAt = lastEnsuredAtByHash.get(writeKeyHash) ?? 0;
	if (now - lastEnsuredAt < ensureIntervalMs) {
		return;
	}

	await ctx.runMutation(component.lib.ensureSite, {
		slug: site.slug,
		name: site.name,
		writeKeyHash,
		allowedOrigins: site.allowedOrigins,
		sessionTimeoutMs: site.sessionTimeoutMs,
		retentionDays: site.retentionDays,
		rawEventRetentionDays: site.rawEventRetentionDays,
		pageViewRetentionDays: site.pageViewRetentionDays,
		hourlyRollupRetentionDays: site.hourlyRollupRetentionDays,
		dailyRollupRetentionDays: site.dailyRollupRetentionDays,
		dedupeRetentionMs: site.dedupeRetentionMs,
		allowedPropertyKeys: site.allowedPropertyKeys,
		deniedPropertyKeys: site.deniedPropertyKeys,
	});
	lastEnsuredAtByHash.set(writeKeyHash, now);
}
