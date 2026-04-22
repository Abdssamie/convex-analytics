import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

function buildVisitorBatch(args: {
	index: number;
	base: number;
}) {
	const plan = args.index % 2 === 0 ? "pro" : "starter";

	return {
		visitorId: `visitor-${args.index}`,
		sessionId: `session-${args.index}`,
		events: [
			{
				type: "identify" as const,
				occurredAt: args.base,
				userId: `user-${args.index}`,
				properties: { plan },
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
				properties: { plan },
			},
			{
				type: "pageview" as const,
				occurredAt: args.base + 3_000,
				path: "/pricing",
				title: "Pricing",
				referrer: "https://app.example.com/",
			},
		],
	};
}

describe("example app integration under high event volume", () => {
	test(
		"public wrappers ingest and query exact results under sustained load",
		async () => {
		vi.useFakeTimers();
		try {
			const t = initConvexTest();
			const siteId = await t.mutation(api.example.createSite, {
				slug: "default",
				name: "Default site",
				writeKey: "write_test",
				allowedOrigins: ["https://app.example.com"],
				rollupShardCount: 8,
				allowedPropertyKeys: ["plan"],
			});

			const hourOne = Date.UTC(2026, 0, 12, 12, 0, 0);
			const hourTwo = hourOne + 60 * 60 * 1000;
			for (let index = 0; index < 100; index += 1) {
				const hourBase = index < 50 ? hourOne : hourTwo;
				const slotOffset =
					(index % 25) * 20_000 +
					(index % 2) * 10 * 60 * 1000;
				const batch = buildVisitorBatch({
					index,
					base: hourBase + slotOffset,
				});
				const result = await t.mutation(api.example.ingestExampleBatch, {
					writeKey: "write_test",
					origin: "https://app.example.com",
					visitorId: batch.visitorId,
					sessionId: batch.sessionId,
					events: batch.events,
				});
				expect(result).toEqual({
					accepted: 4,
					rejected: 0,
				});
			}

			await t.finishAllScheduledFunctions(() => vi.runAllTimers());

			const overview = await t.query(api.example.getOverview, {
				siteId,
				from: hourOne,
				to: hourTwo + 60 * 60 * 1000,
			});
			expect(overview).toEqual({
				events: 400,
				pageviews: 200,
				sessions: 100,
				visitors: 100,
				bounceRate: 0,
				averageSessionDurationMs: 3_000,
			});

			const timeseries = await t.query(api.example.getTimeseries, {
				siteId,
				from: hourOne,
				to: hourTwo + 60 * 60 * 1000,
				interval: "hour",
			});
			expect(timeseries).toEqual([
				{
					bucketStart: hourOne,
					events: 200,
					pageviews: 100,
					sessions: 50,
					visitors: 50,
				},
				{
					bucketStart: hourTwo,
					events: 200,
					pageviews: 100,
					sessions: 50,
					visitors: 50,
				},
			]);

			const topEvents = await t.query(api.example.getTopEvents, {
				siteId,
				from: hourOne,
				to: hourTwo + 60 * 60 * 1000,
				limit: 3,
			});
			expect(topEvents).toHaveLength(3);
			expect(topEvents).toEqual(
				expect.arrayContaining([
					{ key: "pageview", count: 200, pageviewCount: 200 },
					{ key: "plan_selected", count: 100, pageviewCount: 0 },
					{ key: "identify", count: 100, pageviewCount: 0 },
				]),
			);

			const topPages = await t.query(api.example.getTopPages, {
				siteId,
				from: hourOne,
				to: hourTwo + 60 * 60 * 1000,
				limit: 2,
			});
			expect(topPages).toEqual([
				{ key: "/", count: 100, pageviewCount: 100 },
				{ key: "/pricing", count: 100, pageviewCount: 100 },
			]);

			const sessionsPage = await t.query(api.example.listSessions, {
				siteId,
				from: hourOne,
				to: hourTwo + 60 * 60 * 1000,
				paginationOpts: {
					numItems: 5,
					cursor: null,
				},
			});
			expect(sessionsPage.page).toHaveLength(5);
			expect(sessionsPage.page[0]).toMatchObject({
				pageviewCount: 2,
			});
			expect(sessionsPage.isDone).toBe(false);

			const rawEventsPage = await t.query(api.example.listRawEvents, {
				siteId,
				from: hourOne,
				to: hourTwo + 60 * 60 * 1000,
				paginationOpts: {
					numItems: 5,
					cursor: null,
				},
			});
			expect(rawEventsPage.page).toHaveLength(5);
			expect(rawEventsPage.page[0]?.eventName).toBe("pageview");
			expect(rawEventsPage.isDone).toBe(false);
		} finally {
			vi.useRealTimers();
		}
		},
		20_000,
	);
});
