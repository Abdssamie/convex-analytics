import { createAnalytics } from "./tracker";
import type { AnalyticsProperties } from "./types";

type InitOptions = {
	endpoint: string;
	writeKey: string;
	flushIntervalMs?: number;
	maxBatchSize?: number;
	autoPageviews?: boolean;
};

type AnalyticsClient = ReturnType<typeof createAnalytics>;

type AnalyticsGlobal = {
	init: (options: InitOptions) => AnalyticsClient;
	getClient: () => AnalyticsClient | null;
	page: (properties?: AnalyticsProperties) => void;
	track: (name: string, properties?: AnalyticsProperties) => void;
	identify: (userId: string, properties?: AnalyticsProperties) => void;
	flush: () => Promise<void>;
	reset: () => void;
	stop: () => void;
};

declare global {
	interface Window {
		ConvexAnalytics?: AnalyticsGlobal;
	}
}

let client: AnalyticsClient | null = null;

function init(options: InitOptions) {
	if (client) {
		client.stop();
	}
	client = createAnalytics(options);
	return client;
}

function getClientOrThrow() {
	if (!client) {
		throw new Error(
			"ConvexAnalytics has not been initialized. Call ConvexAnalytics.init(...) first or provide data-endpoint and data-write-key on the script tag.",
		);
	}
	return client;
}

function parseBoolean(value: string | undefined) {
	if (value === undefined) {
		return undefined;
	}
	if (value === "true") {
		return true;
	}
	if (value === "false") {
		return false;
	}
	return undefined;
}

function parseNumber(value: string | undefined) {
	if (value === undefined) {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function maybeAutoInit() {
	if (typeof document === "undefined") {
		return;
	}
	const script = document.currentScript as HTMLScriptElement | null;
	if (!script?.dataset.endpoint || !script.dataset.writeKey) {
		return;
	}
	init({
		endpoint: script.dataset.endpoint,
		writeKey: script.dataset.writeKey,
		autoPageviews: parseBoolean(script.dataset.autoPageviews),
		flushIntervalMs: parseNumber(script.dataset.flushIntervalMs),
		maxBatchSize: parseNumber(script.dataset.maxBatchSize),
	});
}

const analyticsGlobal: AnalyticsGlobal = {
	init,
	getClient: () => client,
	page(properties) {
		getClientOrThrow().page(properties);
	},
	track(name, properties) {
		getClientOrThrow().track(name, properties);
	},
	identify(userId, properties) {
		getClientOrThrow().identify(userId, properties);
	},
	flush() {
		return getClientOrThrow().flush();
	},
	reset() {
		getClientOrThrow().reset();
	},
	stop() {
		getClientOrThrow().stop();
	},
};

if (typeof window !== "undefined") {
	window.ConvexAnalytics = analyticsGlobal;
	maybeAutoInit();
}

export { analyticsGlobal as ConvexAnalytics };
