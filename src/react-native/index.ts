import { createCoreAnalytics, type CoreAnalyticsClient } from "../client/core";
import type { IngestContext } from "../client/types";
import { parseUA } from "../client/ua";

interface RnStorageProvider {
	getItem: (key: string) => Promise<string | null>;
	setItem: (key: string, value: string) => Promise<void>;
}

const STORAGE_KEYS = [
	"convex_analytics_visitor_id",
	"convex_analytics_session_id",
	"convex_analytics_session_seen_at",
] as const;

async function createStorageAdapter(storage: RnStorageProvider) {
	const cache = new Map<string, string>();
	await Promise.all(
		STORAGE_KEYS.map(async (key) => {
			const value = await storage.getItem(key);
			if (value !== null) {
				cache.set(key, value);
			}
		}),
	);

	return {
		getItem(key: string): string | null {
			const cached = cache.get(key);
			if (cached !== undefined) {
				return cached;
			}
			return null;
		},
		setItem(key: string, value: string): void {
			cache.set(key, value);
			void storage.setItem(key, value);
		},
	};
}

function getRnContext(): IngestContext | undefined {
	try {
		const RNPlatform =
			(globalThis as Record<string, unknown>).Platform ?? null;
		const os =
			(RNPlatform && typeof RNPlatform === "object" && "OS" in RNPlatform
				? (RNPlatform as { OS: string }).OS
				: undefined) ?? "Unknown";

		const ua =
			(globalThis as Record<string, unknown>).userAgent ??
			((globalThis as Record<string, unknown>).navigator as Record<string, unknown> | undefined)?.userAgent ??
			"";
		const parsed = parseUA(typeof ua === "string" ? ua : "");

		return {
			device: parsed.device,
			browser: parsed.browser,
			os,
		};
	} catch {
		return undefined;
	}
}

export function createRnAnalytics(options: {
	endpoint: string;
	writeKey: string;
	storage: RnStorageProvider;
	flushIntervalMs?: number;
	maxBatchSize?: number;
}): Promise<CoreAnalyticsClient> {
	return createStorageAdapter(options.storage).then((storageAdapter) =>
		createCoreAnalytics({
			endpoint: options.endpoint,
			writeKey: options.writeKey,
			flushIntervalMs: options.flushIntervalMs,
			maxBatchSize: options.maxBatchSize,
			visitorStorage: storageAdapter,
			sessionStorage: storageAdapter,
			getContext: getRnContext,
		}),
	);
}

export type { CoreAnalyticsClient } from "../client/core";
export type { StorageProvider } from "../client/storage";
