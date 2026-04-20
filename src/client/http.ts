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
			if (configuredSites.length > 0) {
				const configuredSite = await findConfiguredSite(
					configuredSites,
					writeKeyHash,
				);
				if (!configuredSite) {
					return jsonResponse(
						{ error: "Invalid analytics write key" },
						401,
						origin,
					);
				}
				await ctx.runMutation(component.sites.ensureSite, {
					slug: configuredSite.slug,
					name: configuredSite.name,
					writeKeyHash,
					allowedOrigins: configuredSite.allowedOrigins,
					sessionTimeoutMs: configuredSite.sessionTimeoutMs,
					retentionDays: configuredSite.retentionDays,
					rawEventRetentionDays: configuredSite.rawEventRetentionDays,
					hourlyRollupRetentionDays:
						configuredSite.hourlyRollupRetentionDays,
					dailyRollupRetentionDays:
						configuredSite.dailyRollupRetentionDays,
					dedupeRetentionMs: configuredSite.dedupeRetentionMs,
					allowedPropertyKeys: configuredSite.allowedPropertyKeys,
					deniedPropertyKeys: configuredSite.deniedPropertyKeys,
				});
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

	return await ctx.runMutation(component.ingest.ingestBatch, {
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
