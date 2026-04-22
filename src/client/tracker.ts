import type { AnalyticsEvent, AnalyticsProperties } from "./types";
import { randomId } from "./helpers";
import { parseUA } from "./ua";

export function createAnalytics(options: {
	endpoint: string;
	writeKey: string;
	flushIntervalMs?: number;
	maxBatchSize?: number;
	autoPageviews?: boolean;
}) {
	const flushIntervalMs = options.flushIntervalMs ?? 5000;
	const maxBatchSize = options.maxBatchSize ?? 10;
	const queue: AnalyticsEvent[] = [];
	const visitorId = getOrCreateStoredId("convex_analytics_visitor_id");
	let sessionId = getOrCreateSessionId();
	let timer: ReturnType<typeof setInterval> | null = null;

	async function flush() {
		if (queue.length === 0) {
			return;
		}

		const events = queue.splice(0, maxBatchSize);
		const payload = JSON.stringify({
			visitorId,
			sessionId,
			context: browserContext(),
			events,
		});
		try {
			await fetch(options.endpoint, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-analytics-write-key": options.writeKey,
				},
				body: payload,
				keepalive: true,
			});
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

	const client = {
		page(properties?: AnalyticsProperties) {
			enqueue({
				type: "pageview",
				path: globalThis.location?.pathname ?? undefined,
				title: globalThis.document?.title ?? undefined,
				referrer: externalReferrer(),
				properties,
			});
		},
		track(name: string, properties?: AnalyticsProperties) {
			enqueue({
				type: "track",
				name,
				path: globalThis.location?.pathname ?? undefined,
				properties,
			});
		},
		identify(userId: string, properties?: AnalyticsProperties) {
			enqueue({ type: "identify", userId, properties });
		},
		reset() {
			sessionId = randomId();
			try {
				sessionStorage.setItem("convex_analytics_session_id", sessionId);
				sessionStorage.setItem(
					"convex_analytics_session_seen_at",
					`${Date.now()}`,
				);
			} catch {
				// Ignore storage failures in privacy-restricted browsers.
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
	if (typeof window !== "undefined") {
		timer = setInterval(() => void flush(), flushIntervalMs);
		window.addEventListener("pagehide", () => {
			void flush();
		});
		if (options.autoPageviews ?? true) {
			client.page();
		}
	}

	return client;
}

export function getOrCreateStoredId(key: string) {
	try {
		const existing = localStorage.getItem(key);
		if (existing) {
			return existing;
		}
		const next = randomId();
		localStorage.setItem(key, next);
		return next;
	} catch {
		return randomId();
	}
}

export function getOrCreateSessionId() {
	const now = Date.now();
	const timeoutMs = 30 * 60 * 1000;
	try {
		const existing = sessionStorage.getItem("convex_analytics_session_id");
		const seenAt = Number(
			sessionStorage.getItem("convex_analytics_session_seen_at") ?? "0",
		);
		if (existing && now - seenAt < timeoutMs) {
			sessionStorage.setItem("convex_analytics_session_seen_at", `${now}`);
			return existing;
		}
		const next = randomId();
		sessionStorage.setItem("convex_analytics_session_id", next);
		sessionStorage.setItem("convex_analytics_session_seen_at", `${now}`);
		return next;
	} catch {
		return randomId();
	}
}

export function browserContext() {
	if (typeof window === "undefined") {
		return undefined;
	}

	const params = new URLSearchParams(window.location.search);
	const ua = parseUA(window.navigator?.userAgent ?? "");
	return {
		device: ua.device,
		browser: ua.browser,
		os: ua.os,
		utmSource: params.get("utm_source") ?? undefined,
		utmMedium: params.get("utm_medium") ?? undefined,
		utmCampaign: params.get("utm_campaign") ?? undefined,
	};
}

export function externalReferrer() {
	const referrer = globalThis.document?.referrer;
	if (!referrer) {
		return undefined;
	}
	try {
		const referrerUrl = new URL(referrer);
		const currentOrigin = globalThis.location?.origin;
		if (currentOrigin && referrerUrl.origin === currentOrigin) {
			return undefined;
		}
		return referrerUrl.toString();
	} catch {
		return referrer;
	}
}
