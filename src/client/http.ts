import { httpActionGeneric } from "convex/server";
import type { HttpRouter } from "convex/server";
import type { ComponentApi } from "../component/_generated/component";
import type {
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
		countryLookup?: "headers-only" | "country-is";
	},
) {
	const path = options?.path ?? "/analytics/ingest";
	const allowedHeaders = options?.allowedHeaders ?? [
		"content-type",
		"x-analytics-write-key",
	];
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
			const body = await request.json();
			const country = await getCountry(
				request,
				options?.countryLookup ?? "headers-only",
			);
			const result = await ingestFromHttp(ctx, component, {
				writeKeyHash,
				origin,
				visitorId: String(readRecord(body).visitorId ?? ""),
				sessionId: String(readRecord(body).sessionId ?? ""),
				context: withDetectedCountry(
					normalizeContext(readRecord(body).context),
					country,
				),
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

export function withDetectedCountry(
	context: IngestContext | undefined,
	country: string | undefined,
) {
	if (!country) {
		return context;
	}
	return {
		...context,
		country: context?.country ?? country,
	};
}

export function getHeaderCountry(request: Request) {
	const cfCountry = request.headers.get("cf-ipcountry");
	if (cfCountry && cfCountry !== "XX") {
		return cfCountry;
	}
	return undefined;
}

export async function getCountryWithFallback(
	request: Request,
	mode: "headers-only" | "country-is",
) {
	const headerCountry = getHeaderCountry(request);
	if (headerCountry || mode === "headers-only") {
		return headerCountry;
	}

	const ip =
		request.headers.get("cf-connecting-ip") ??
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	if (!ip || ip === "127.0.0.1" || ip === "::1" || !isValidIp(ip)) {
		return undefined;
	}

	try {
		const response = await fetch(`https://api.country.is/${ip}`, {
			signal: AbortSignal.timeout(500),
		});
		if (!response.ok) {
			return undefined;
		}
		const data = (await response.json()) as { country?: string };
		return typeof data.country === "string" ? data.country : undefined;
	} catch {
		return undefined;
	}
}

export async function getCountry(
	request: Request,
	mode: "headers-only" | "country-is" = "headers-only",
) {
	return await getCountryWithFallback(request, mode);
}

function isValidIp(ip: string) {
	return isValidIPv4(ip) || isValidIPv6(ip);
}

function isValidIPv4(ip: string) {
	const parts = ip.split(".");
	if (parts.length !== 4) {
		return false;
	}
	return parts.every((part) => {
		if (!/^\d{1,3}$/.test(part)) {
			return false;
		}
		const value = Number(part);
		return value >= 0 && value <= 255;
	});
}

function isValidIPv6(ip: string) {
	if (!/^[\da-fA-F:]+$/.test(ip)) {
		return false;
	}
	const parts = ip.split(":");
	if (parts.length < 3 || parts.length > 8) {
		return false;
	}
	let compressed = false;
	for (const part of parts) {
		if (part === "") {
			if (compressed) {
				continue;
			}
			compressed = true;
			continue;
		}
		if (part.length > 4 || !/^[\da-fA-F]{1,4}$/.test(part)) {
			return false;
		}
	}
	return true;
}
