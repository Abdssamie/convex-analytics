import type { AnalyticsEvent, AnalyticsProperties, IngestContext } from "./types";
import type { StorageProvider } from "./storage";
import { randomId } from "./helpers";

export interface CoreAnalyticsClient {
	page(properties?: AnalyticsProperties): void;
	track(name: string, properties?: AnalyticsProperties): void;
	identify(userId: string, properties?: AnalyticsProperties): void;
	reset(): void;
	flush(): Promise<void>;
	stop(): void;
}

export function createCoreAnalytics(options: {
	endpoint: string;
	writeKey: string;
	flushIntervalMs?: number;
	maxBatchSize?: number;
	visitorStorage: StorageProvider;
	sessionStorage: StorageProvider;
	getContext: () => IngestContext | undefined;
	getPath?: () => string | undefined;
	getTitle?: () => string | undefined;
	getReferrer?: () => string | undefined;
	startTimer?: boolean;
}): CoreAnalyticsClient {
	const flushIntervalMs = options.flushIntervalMs ?? 5000;
	const maxBatchSize = options.maxBatchSize ?? 10;
	const queue: AnalyticsEvent[] = [];
	const visitorId = getOrCreateStoredId(
		"convex_analytics_visitor_id",
		options.visitorStorage,
	);
	let sessionId = getOrCreateSessionId(options.sessionStorage);
	let timer: ReturnType<typeof setInterval> | null = null;

	async function flush() {
		if (queue.length === 0) {
			return;
		}

		const events = queue.splice(0, maxBatchSize);
		const payload = JSON.stringify({
			visitorId,
			sessionId,
			context: options.getContext(),
			events,
		});
		try {
			const response = await fetch(options.endpoint, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-analytics-write-key": options.writeKey,
				},
				body: payload,
				keepalive: true,
			});
			if (!response.ok) {
				throw new Error(`Analytics flush failed with ${response.status}`);
			}
		} catch {
			queue.unshift(...events);
		}
	}

	function enqueue(event: AnalyticsEvent) {
		queue.push({
			occurredAt: Date.now(),
			...event,
		});
		if (queue.length >= maxBatchSize) {
			void flush();
		}
	}

	const getPath = options.getPath ?? (() => undefined);
	const getTitle = options.getTitle ?? (() => undefined);
	const getReferrer = options.getReferrer ?? (() => undefined);

	const client: CoreAnalyticsClient = {
		page(properties?: AnalyticsProperties) {
			enqueue({
				type: "pageview",
				path: getPath(),
				title: getTitle(),
				referrer: getReferrer(),
				properties,
			});
		},
		track(name: string, properties?: AnalyticsProperties) {
			enqueue({
				type: "track",
				name,
				path: getPath(),
				properties,
			});
		},
		identify(userId: string, properties?: AnalyticsProperties) {
			enqueue({ type: "identify", userId, properties });
		},
		reset() {
			sessionId = randomId();
			try {
				options.sessionStorage.setItem("convex_analytics_session_id", sessionId);
				options.sessionStorage.setItem(
					"convex_analytics_session_seen_at",
					`${Date.now()}`,
				);
			} catch {
				// Ignore storage failures in privacy-restricted environments.
			}
		},
		flush,
		stop() {
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
		},
	};

	if (
		(options.startTimer ?? true) &&
		typeof globalThis !== "undefined" &&
		"setInterval" in globalThis
	) {
		timer = setInterval(() => void flush(), flushIntervalMs);
	}

	return client;
}

export function getOrCreateStoredId(key: string, storage: StorageProvider) {
	try {
		const existing = storage.getItem(key);
		if (existing) {
			return existing;
		}
		const next = randomId();
		storage.setItem(key, next);
		return next;
	} catch {
		return randomId();
	}
}

export function getOrCreateSessionId(storage: StorageProvider) {
	const now = Date.now();
	const timeoutMs = 30 * 60 * 1000;
	try {
		const existing = storage.getItem("convex_analytics_session_id");
		const seenAt = Number(
			storage.getItem("convex_analytics_session_seen_at") ?? "0",
		);
		if (existing && now - seenAt < timeoutMs) {
			storage.setItem("convex_analytics_session_seen_at", `${now}`);
			return existing;
		}
		const next = randomId();
		storage.setItem("convex_analytics_session_id", next);
		storage.setItem("convex_analytics_session_seen_at", `${now}`);
		return next;
	} catch {
		return randomId();
	}
}
