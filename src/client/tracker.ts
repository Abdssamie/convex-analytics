import { createCoreAnalytics, type CoreAnalyticsClient } from "./core";
import {
	browserVisitorStorage,
	browserSessionStorage,
} from "./browserStorage";
import {
	getBrowserContext,
	getBrowserPath,
	getBrowserTitle,
	getBrowserReferrer,
} from "./browserContext";

export function createAnalytics(options: {
	endpoint: string;
	writeKey: string;
	flushIntervalMs?: number;
	maxBatchSize?: number;
	autoPageviews?: boolean;
}): CoreAnalyticsClient {
	const client = createCoreAnalytics({
		endpoint: options.endpoint,
		writeKey: options.writeKey,
		flushIntervalMs: options.flushIntervalMs,
		maxBatchSize: options.maxBatchSize,
		visitorStorage: browserVisitorStorage,
		sessionStorage: browserSessionStorage,
		getContext: getBrowserContext,
		getPath: getBrowserPath,
		getTitle: getBrowserTitle,
		getReferrer: getBrowserReferrer,
		startTimer: typeof window !== "undefined",
	});

	if (typeof window !== "undefined") {
		window.addEventListener("pagehide", () => {
			void client.flush();
		});
		if (options.autoPageviews ?? true) {
			client.page();
		}
	}

	return client;
}

export { getOrCreateStoredId, getOrCreateSessionId } from "./core";
export { getBrowserContext, getBrowserPath, getBrowserTitle, getBrowserReferrer } from "./browserContext";
