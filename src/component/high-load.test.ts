import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";
import { dayMs, hourMs } from "./constants.js";

function buildVisitorLoad(args: {
	visitorIndex: number;
	base: number;
}) {
	const plan = ["starter", "pro", "enterprise"][args.visitorIndex % 3]!;
	const billingCycle = args.visitorIndex % 2 === 0 ? "monthly" : "yearly";
	const identifyProperties: Record<string, string> = {
		plan,
		tier: args.visitorIndex % 4 === 0 ? "team" : "self-serve",
	};
	const trackProperties: Record<string, string> = {
		plan,
		billingCycle,
	};

	return {
		visitorId: `visitor-${args.visitorIndex}`,
		sessionId: `session-${args.visitorIndex}`,
		events: [
			{
				type: "identify" as const,
				occurredAt: args.base,
				userId: `user-${args.visitorIndex}`,
				properties: identifyProperties,
			},
			{
				type: "pageview" as const,
				occurredAt: args.base + 1_000,
				path: "/",
				title: "Home",
				referrer: "https://app.example.com/",
			},
			{
				type: "track" as const,
				name: "plan_selected",
				occurredAt: args.base + 2_000,
				path: "/pricing",
				properties: trackProperties,
			},
			{
				type: "pageview" as const,
				occurredAt: args.base + 3_000,
				path: "/pricing",
				title: "Pricing",
				referrer: "https://app.example.com/",
			},
			{
				type: "track" as const,
				name: "plan_selected",
				occurredAt: args.base + 4_000,
				path: "/checkout",
				properties: trackProperties,
			},
		],
	};
}

describe("analytics high-load correctness", () => {
	test(
		"high ingest load stays exact with single-row rollups",
		async () => {
		vi.useFakeTimers();
		try {
			const t = initConvexTest();
			const siteId = await t.mutation(api.sites.createSite, {
				slug: "stress-site",
				name: "Stress Site",
				writeKeyHash: "write_stress",
				allowedPropertyKeys: ["plan", "billingCycle", "tier"],
			});

			const hourOne = Date.UTC(2026, 0, 10, 10, 0, 0);
			const hourTwo = hourOne + hourMs;
			const writeKeyHash = "write_stress";
			for (let visitorIndex = 0; visitorIndex < 120; visitorIndex += 1) {
				const hourBase = visitorIndex < 60 ? hourOne : hourTwo;
				const slotOffset =
					(visitorIndex % 30) * 10_000 +
					(visitorIndex % 2) * 5 * 60 * 1000;
				const batch = buildVisitorLoad({
					visitorIndex,
					base: hourBase + slotOffset,
				});
				const result = await t.mutation(api.ingest.ingestBatch, {
					writeKeyHash,
					visitorId: batch.visitorId,
					sessionId: batch.sessionId,
					context: {
						utmSource: "newsletter",
						utmMedium: "email",
						utmCampaign: "spring-launch",
					},
					events: batch.events,
				});
				expect(result).toEqual({
					accepted: 5,
					rejected: 0,
				});
			}

			await t.finishAllScheduledFunctions(() => vi.runAllTimers());

			const hourOneRowsBefore = await t.run(async (ctx) => {
				return await ctx.db
					.query("rollups")
					.withIndex("by_site_interval_dimension_key_bucket", (q) =>
						q
							.eq("siteId", siteId)
							.eq("interval", "hour")
							.eq("dimension", "event")
							.eq("key", "plan_selected")
							.eq("bucketStart", hourOne),
					)
					.take(32);
			});
			expect(hourOneRowsBefore).toHaveLength(1);
			expect(hourOneRowsBefore[0]).toMatchObject({
				count: 120,
				pageviewCount: 0,
			});

			const compactionNow = hourTwo + 4 * dayMs;
			const hourlyCompaction = await t.action(internal.compaction.compactShards, {
				siteId,
				interval: "hour",
				now: compactionNow,
			});
			const dailyCompaction = await t.action(internal.compaction.compactShards, {
				siteId,
				interval: "day",
				now: compactionNow,
			});
			expect(hourlyCompaction).toEqual({ compactedPairs: 0, hasMore: false });
			expect(dailyCompaction).toEqual({ compactedPairs: 0, hasMore: false });

			const hourOneRowsAfter = await t.run(async (ctx) => {
				return await ctx.db
					.query("rollups")
					.withIndex("by_site_interval_dimension_key_bucket", (q) =>
						q
							.eq("siteId", siteId)
							.eq("interval", "hour")
							.eq("dimension", "event")
							.eq("key", "plan_selected")
							.eq("bucketStart", hourOne),
					)
					.take(32);
			});
			expect(hourOneRowsAfter).toHaveLength(1);
			expect(hourOneRowsAfter[0]).toMatchObject({ count: 120 });

			const overview = await t.query(api.analytics.getOverview, {
				siteId,
				from: hourOne,
				to: hourTwo + hourMs,
			});
			expect(overview).toEqual({
				events: 600,
				pageviews: 240,
				sessions: 120,
				visitors: 120,
				bounceRate: 0,
				averageSessionDurationMs: 4_000,
			});

			const timeseries = await t.query(api.analytics.getTimeseries, {
				siteId,
				from: hourOne,
				to: hourTwo + hourMs,
				interval: "hour",
			});
			expect(timeseries).toEqual([
				{
					bucketStart: hourOne,
					events: 300,
					pageviews: 120,
					sessions: 60,
					visitors: 60,
				},
				{
					bucketStart: hourTwo,
					events: 300,
					pageviews: 120,
					sessions: 60,
					visitors: 60,
				},
			]);

			const topEvents = await t.query(api.analytics.getTopEvents, {
				siteId,
				from: hourOne,
				to: hourTwo + hourMs,
				limit: 3,
			});
			expect(topEvents).toHaveLength(3);
			expect(topEvents).toEqual(
				expect.arrayContaining([
					{ key: "plan_selected", count: 240, pageviewCount: 0 },
					{ key: "pageview", count: 240, pageviewCount: 240 },
					{ key: "identify", count: 120, pageviewCount: 0 },
				]),
			);

			const byPlan = await t.query(api.analytics.getEventPropertyBreakdown, {
				siteId,
				eventName: "plan_selected",
				propertyKey: "plan",
				from: hourOne,
				to: hourTwo + hourMs,
				limit: 3,
			});
			expect(byPlan).toHaveLength(3);
			expect(byPlan).toEqual(
				expect.arrayContaining([
					{ value: "starter", count: 80 },
					{ value: "pro", count: 80 },
					{ value: "enterprise", count: 80 },
				]),
			);

			const byBillingCycle = await t.query(
				api.analytics.getEventPropertyBreakdown,
				{
					siteId,
					eventName: "plan_selected",
					propertyKey: "billingCycle",
					from: hourOne,
					to: hourTwo + hourMs,
					limit: 2,
				},
			);
			expect(byBillingCycle).toEqual([
				{ value: "monthly", count: 120 },
				{ value: "yearly", count: 120 },
			]);
		} finally {
			vi.useRealTimers();
		}
		},
		45_000,
	);
});
