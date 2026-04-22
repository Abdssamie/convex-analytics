import type { AnalyticsProperties } from "@Abdssamie/convex-analytics";

type AnalyticsClient = {
	page(properties?: AnalyticsProperties): void;
	track(name: string, properties?: AnalyticsProperties): void;
	identify(userId: string, properties?: AnalyticsProperties): void;
	flush(): Promise<void>;
};

type RequestSample = {
	url: string;
	status: number;
	durationMs: number;
	startedAt: number;
	finishedAt: number;
};

type ScenarioArgs = {
	userId: string;
	iterations: number;
	planSequence?: string[];
};

type ScenarioResult = {
	eventsQueued: number;
	requests: RequestSample[];
	totalDurationMs: number;
};

type LoadHarnessApi = {
	runScenario(args: ScenarioArgs): Promise<ScenarioResult>;
	resetMetrics(): void;
	getMetrics(): RequestSample[];
};

declare global {
	interface Window {
		__analyticsLoadHarness?: LoadHarnessApi;
	}
}

export function installAnalyticsLoadHarness(
	analytics: AnalyticsClient,
	options: {
		enabled: boolean;
		endpointPath: string;
	},
) {
	if (!options.enabled || typeof window === "undefined") {
		return;
	}

	const targetPath = options.endpointPath;
	const samples: RequestSample[] = [];
	const existing = window.__analyticsLoadHarness;
	if (existing) {
		existing.resetMetrics();
		return;
	}

	const originalFetch = window.fetch.bind(window);
	window.fetch = async (input, init) => {
		const startedAt = performance.now();
		const url =
			typeof input === "string"
				? input
				: input instanceof URL
					? input.toString()
					: input.url;
		const response = await originalFetch(input, init);
		const finishedAt = performance.now();
		if (new URL(url, window.location.href).pathname === targetPath) {
			samples.push({
				url,
				status: response.status,
				durationMs: finishedAt - startedAt,
				startedAt,
				finishedAt,
			});
		}
		return response;
	};

	window.__analyticsLoadHarness = {
		async runScenario(args) {
			const planSequence = args.planSequence ?? ["starter", "pro", "starter"];
			const startedAt = performance.now();
			const before = samples.length;
			let eventsQueued = 0;

			for (let index = 0; index < args.iterations; index += 1) {
				const plan = planSequence[index % planSequence.length]!;
				analytics.page({ screen: "landing", iteration: index });
				analytics.track("plan_selected", {
					plan,
					source: "playwright",
					iteration: index,
				});
				analytics.track("trial_started", {
					plan,
					source: "playwright",
					iteration: index,
				});
				if (index % 5 === 0) {
					analytics.identify(`${args.userId}-${index}`, {
						selectedPlan: plan,
						source: "playwright",
					});
					eventsQueued += 1;
				}
				eventsQueued += 3;
			}

			await analytics.flush();
			const finishedAt = performance.now();
			return {
				eventsQueued,
				requests: samples.slice(before),
				totalDurationMs: finishedAt - startedAt,
			};
		},
		resetMetrics() {
			samples.length = 0;
		},
		getMetrics() {
			return [...samples];
		},
	};
}
