import type {
	IngestContext,
	IngestEventInput,
	AnalyticsProperties,
} from "./types";

export async function hashWriteKey(writeKey: string) {
	const bytes = new TextEncoder().encode(writeKey);
	const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export function requireWriteKey(
	writeKey: string | null | undefined,
	message: string = "Analytics write key is required.",
) {
	if (typeof writeKey !== "string" || writeKey.trim() === "") {
		throw new Error(message);
	}
	return writeKey;
}

export function corsHeaders(origin: string, allowedHeaders: string[]) {
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": allowedHeaders.join(", "),
		Vary: "Origin",
	};
}

export function jsonResponse(body: unknown, status: number, origin?: string) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			...corsHeaders(origin ?? "*", ["content-type", "x-analytics-write-key"]),
		},
	});
}

export function readRecord(value: unknown): Record<string, unknown> {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}

	return {};
}

export function normalizeContext(value: unknown): IngestContext | undefined {
	const record = readRecord(value);
	const context: IngestContext = {};
	for (const key of [
		"device",
		"browser",
		"os",
		"country",
		"utmSource",
		"utmMedium",
		"utmCampaign",
	] as const) {
		if (typeof record[key] === "string") {
			context[key] = record[key];
		}
	}

	return Object.keys(context).length === 0 ? undefined : context;
}

export function normalizeEvents(value: unknown): IngestEventInput[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((item) => {
		const record = readRecord(item);
		if (
			record.type !== "pageview" &&
			record.type !== "track" &&
			record.type !== "identify"
		) {
			return [];
		}
		const event: IngestEventInput = { type: record.type };
		for (const key of [
			"name",
			"path",
			"title",
			"referrer",
			"userId",
		] as const) {
			if (typeof record[key] === "string") {
				event[key] = record[key];
			}
		}
		if (typeof record.occurredAt === "number") {
			event.occurredAt = record.occurredAt;
		}
		const properties = normalizeProperties(record.properties);
		if (properties) {
			event.properties = properties;
		}
		return [event];
	});
}

export function normalizeProperties(
	value: unknown,
): AnalyticsProperties | undefined {
	const record = readRecord(value);
	const properties: AnalyticsProperties = {};
	for (const [key, item] of Object.entries(record)) {
		if (
			typeof item === "string" ||
			typeof item === "number" ||
			typeof item === "boolean" ||
			item === null
		) {
			properties[key] = item;
		}
	}

	return Object.keys(properties).length === 0 ? undefined : properties;
}

export function randomId() {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}

	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
