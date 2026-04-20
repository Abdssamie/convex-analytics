import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { initConvexTest } from "./setup.test.js";
import { dayMs, hourMs } from "./constants.js";
import { floorToBucket } from "./helpers.js";

async function createSite(overrides?: {
	slug?: string;
	writeKeyHash?: string;
	sessionTimeoutMs?: number;
}) {
	const t = initConvexTest();
	const siteId = await t.mutation(api.sites.createSite, {
		slug:
			overrides?.slug ?? `site-${Math.random().toString(36).slice(2, 8)}`,
		name: "Scale Test",
		writeKeyHash: overrides?.writeKeyHash ?? "write_test",
		sessionTimeoutMs: overrides?.sessionTimeoutMs,
	});
	return {
		t,
		siteId,
		writeKeyHash: overrides?.writeKeyHash ?? "write_test",
	};
}

async function countSiteRows(
	t: ReturnType<typeof initConvexTest>,
	siteId: Id<"sites">,
	now: number,
) {
	return await t.run(async (ctx) => {
		const visitors = await ctx.db
			.query("visitors")
			.withIndex("by_siteId_and_visitorId", (q) => q.eq("siteId", siteId))
			.take(500);
		const sessions = await ctx.db
			.query("sessions")
			.withIndex("by_siteId_and_startedAt", (q) => q.eq("siteId", siteId))
			.take(500);
			const pendingEvents = await ctx.db
				.query("events")
			.withIndex("by_siteId_and_aggregationStatus_and_occurredAt", (q) =>
				q.eq("siteId", siteId).eq("aggregationStatus", "pending").lte("occurredAt", now),
			)
			.take(500);
		const doneEvents = await ctx.db
			.query("events")
			.withIndex("by_siteId_and_aggregationStatus_and_occurredAt", (q) =>
				q.eq("siteId", siteId).eq("aggregationStatus", "done").lte("occurredAt", now),
			)
			.take(500);
			const pageViews = await ctx.db
				.query("pageViews")
				.withIndex("by_siteId_and_occurredAt", (q) => q.eq("siteId", siteId))
				.take(500);
		return {
			visitors,
			sessions,
			pendingEvents,
			doneEvents,
			pageViews,
		};
	});
}

async function getRollupBucketRows(
	t: ReturnType<typeof initConvexTest>,
	args: {
		siteId: Id<"sites">;
		interval: "hour" | "day";
		bucketStart: number;
		dimension: string;
		key: string;
	},
) {
	return await t.run(async (ctx) => {
		return await ctx.db
			.query("rollupShards")
			.withIndex("by_site_interval_dimension_key_bucket", (q) =>
				q
					.eq("siteId", args.siteId)
					.eq("interval", args.interval)
					.eq("dimension", args.dimension)
					.eq("key", args.key)
					.eq("bucketStart", args.bucketStart),
			)
			.take(100);
	});
}

async function insertPendingPageviewEvents(
	t: ReturnType<typeof initConvexTest>,
	args: {
		siteId: Id<"sites">;
		now: number;
		bucketStart: number;
		totalEvents: number;
		visitorCardinality?: number;
		sessionCardinality?: number;
		keyPrefix?: string;
	},
) {
	return await t.run(async (ctx) => {
		const eventIds: Array<Id<"events">> = [];
		for (let index = 0; index < args.totalEvents; index += 1) {
			const eventId = await ctx.db.insert("events", {
				siteId: args.siteId,
				receivedAt: args.now,
				occurredAt: args.bucketStart + index * 1_000,
				visitorId: `${args.keyPrefix ?? "bucket"}-visitor-${index % (args.visitorCardinality ?? args.totalEvents)}`,
				sessionId: `${args.keyPrefix ?? "bucket"}-session-${index % (args.sessionCardinality ?? args.totalEvents)}`,
				eventType: "pageview",
				eventName: "pageview",
				path: index % 2 === 0 ? "/" : "/pricing",
				title: index % 2 === 0 ? "Home" : "Pricing",
				source: "web",
				utmCampaign: "load-test",
				aggregationStatus: "pending",
				aggregationAttempts: 0,
			});
			eventIds.push(eventId);
		}
		return eventIds;
	});
}

describe("realistic ingestion, sharding, and compaction flows", () => {
	test("scheduled worker materializes visitors, sessions, pageviews, and rollups after append-only ingest", async () => {
		vi.useFakeTimers();
		try {
		const { t, siteId, writeKeyHash } = await createSite();
		const base = Date.UTC(2026, 0, 1, 9, 0, 0);

		await t.mutation(api.ingest.ingestBatch, {
			writeKeyHash,
			visitorId: "visitor-1",
			sessionId: "session-a",
			context: {
				source: "web",
				utmSource: "newsletter",
				utmCampaign: "launch",
			},
			events: [
				{
					type: "pageview",
					path: "/",
					title: "Home",
					occurredAt: base,
					eventId: "event-a1",
				},
				{
					type: "track",
					name: "signup_click",
					occurredAt: base + 60_000,
					eventId: "event-a2",
				},
				{
					type: "identify",
					occurredAt: base + 120_000,
					userId: "user-1",
					properties: { plan: "pro", company: "Acme" },
					eventId: "event-a3",
				},
			],
		});
		await t.mutation(api.ingest.ingestBatch, {
			writeKeyHash,
			visitorId: "visitor-2",
			sessionId: "session-b",
			context: {
				source: "web",
				utmSource: "ads",
				utmCampaign: "launch",
			},
			events: [
				{
					type: "pageview",
					path: "/pricing",
					title: "Pricing",
					referrer: "https://google.com",
					occurredAt: base + 5 * 60_000,
					eventId: "event-b1",
				},
				{
					type: "pageview",
					path: "/checkout",
					title: "Checkout",
					occurredAt: base + 6 * 60_000,
					eventId: "event-b2",
				},
				{
					type: "track",
					name: "purchase",
					occurredAt: base + 7 * 60_000,
					eventId: "event-b3",
				},
			],
		});
		await t.mutation(api.ingest.ingestBatch, {
			writeKeyHash,
			visitorId: "visitor-1",
			sessionId: "session-c",
			context: {
				source: "web",
				utmSource: "newsletter",
				utmCampaign: "docs",
			},
			events: [
				{
					type: "pageview",
					path: "/docs",
					title: "Docs",
					occurredAt: base + 2 * hourMs,
					eventId: "event-c1",
				},
				{
					type: "track",
					name: "search",
					occurredAt: base + 2 * hourMs + 30_000,
					eventId: "event-c2",
				},
			],
		});

		const before = await countSiteRows(t, siteId, base + 3 * hourMs);
		expect(before.visitors).toHaveLength(0);
		expect(before.sessions).toHaveLength(0);
		expect(before.pendingEvents).toHaveLength(8);
		expect(before.pageViews).toHaveLength(0);

		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		const after = await countSiteRows(t, siteId, base + 3 * hourMs);
		expect(after.pendingEvents).toHaveLength(0);
		expect(after.doneEvents).toHaveLength(8);
		expect(after.visitors).toHaveLength(2);
		expect(after.sessions).toHaveLength(3);
		expect(after.pageViews).toHaveLength(4);

		const visitorOne = after.visitors.find((row) => row.visitorId === "visitor-1");
		expect(visitorOne).toMatchObject({
			firstSeenAt: base,
			lastSeenAt: base + 2 * hourMs + 30_000,
			identifiedUserId: "user-1",
			traits: { plan: "pro", company: "Acme" },
		});

		const sessions = new Map(after.sessions.map((row) => [row.sessionId, row]));
		expect(sessions.get("session-a")).toMatchObject({
			visitorId: "visitor-1",
			entryPath: "/",
			exitPath: "/",
			eventCount: 3,
			pageviewCount: 1,
			identifiedUserId: "user-1",
			bounce: true,
			durationMs: 120_000,
		});
		expect(sessions.get("session-b")).toMatchObject({
			visitorId: "visitor-2",
			entryPath: "/pricing",
			exitPath: "/checkout",
			eventCount: 3,
			pageviewCount: 2,
			bounce: false,
			durationMs: 120_000,
		});
		expect(sessions.get("session-c")).toMatchObject({
			visitorId: "visitor-1",
			entryPath: "/docs",
			exitPath: "/docs",
			eventCount: 2,
			pageviewCount: 1,
			bounce: true,
			durationMs: 30_000,
		});

		const overview = await t.query(api.analytics.getOverview, {
			siteId,
			from: base - 1,
			to: base + dayMs,
		});
		expect(overview.events).toBe(8);
		expect(overview.pageviews).toBe(4);
		expect(overview.sessions).toBe(3);
		expect(overview.visitors).toBe(2);

		const topPages = await t.query(api.analytics.getTopPages, {
			siteId,
			from: base - 1,
			to: base + dayMs,
			limit: 10,
		});
		expect(topPages).toEqual([
			{ key: "/", count: 1, pageviewCount: 1 },
			{ key: "/pricing", count: 1, pageviewCount: 1 },
			{ key: "/checkout", count: 1, pageviewCount: 1 },
			{ key: "/docs", count: 1, pageviewCount: 1 },
		]);

		const topEvents = await t.query(api.analytics.getTopEvents, {
			siteId,
			from: base - 1,
			to: base + dayMs,
			limit: 10,
		});
		expect(topEvents).toEqual([
			{ key: "pageview", count: 4, pageviewCount: 4 },
			{ key: "signup_click", count: 1, pageviewCount: 0 },
			{ key: "identify", count: 1, pageviewCount: 0 },
			{ key: "purchase", count: 1, pageviewCount: 0 },
			{ key: "search", count: 1, pageviewCount: 0 },
		]);

		const rawEvents = await t.query(api.analytics.listRawEvents, {
			siteId,
			from: base - 1,
			to: base + dayMs,
			limit: 20,
		});
		expect(rawEvents).toHaveLength(8);
		expect(rawEvents.every((row) => row.aggregationStatus === "done")).toBe(true);
		expect(rawEvents.filter((row) => row.contributesVisitor)).toHaveLength(2);
		expect(rawEvents.filter((row) => row.contributesSession)).toHaveLength(3);
		} finally {
			vi.useRealTimers();
		}
	});

	test("backfilled raw events create shard fanout, compaction collapses it, analytics stay exact", async () => {
		const { t, siteId } = await createSite();
		const now = Date.UTC(2026, 0, 5, 12, 0, 0);
		const oldHour = floorToBucket(now - 4 * hourMs, hourMs);
		const oldDay = floorToBucket(oldHour, dayMs);
		const totalEvents = 64;

		const eventIds = await insertPendingPageviewEvents(t, {
			siteId,
			now,
			bucketStart: oldHour,
			totalEvents,
		});
		for (let index = 0; index < eventIds.length; index += 25) {
			await t.mutation(internal.ingest.aggregateEventBatch, {
				eventIds: eventIds.slice(index, index + 25),
			});
		}

		const hourlyOverviewBefore = await getRollupBucketRows(t, {
			siteId,
			interval: "hour",
			bucketStart: oldHour,
			dimension: "overview",
			key: "all",
		});
		const dailyOverviewBefore = await getRollupBucketRows(t, {
			siteId,
			interval: "day",
			bucketStart: oldDay,
			dimension: "overview",
			key: "all",
		});
		expect(hourlyOverviewBefore.length).toBeGreaterThan(1);
		expect(dailyOverviewBefore.length).toBeGreaterThan(1);

		const timeseriesBefore = await t.query(api.analytics.getTimeseries, {
			siteId,
			from: oldHour,
			to: oldHour + hourMs,
			interval: "hour",
		});
		expect(timeseriesBefore.length).toBeGreaterThan(1);
		const timeseriesBeforeTotals = timeseriesBefore.reduce(
			(sum, row) => ({
				events: sum.events + row.events,
				pageviews: sum.pageviews + row.pageviews,
				sessions: sum.sessions + row.sessions,
				visitors: sum.visitors + row.visitors,
			}),
			{ events: 0, pageviews: 0, sessions: 0, visitors: 0 },
		);
		expect(timeseriesBeforeTotals).toEqual({
			events: totalEvents,
			pageviews: totalEvents,
			sessions: totalEvents,
			visitors: totalEvents,
		});

		const overviewBefore = await t.query(api.analytics.getOverview, {
			siteId,
			from: oldDay,
			to: oldDay + dayMs,
		});
		const topPagesBefore = await t.query(api.analytics.getTopPages, {
			siteId,
			from: oldDay,
			to: oldDay + dayMs,
			limit: 10,
		});

		await t.mutation(internal.compaction.compactShards, {
			siteId,
			interval: "hour",
			now,
		});
		await t.mutation(internal.compaction.compactShards, {
			siteId,
			interval: "day",
			now,
		});

		const hourlyOverviewAfter = await getRollupBucketRows(t, {
			siteId,
			interval: "hour",
			bucketStart: oldHour,
			dimension: "overview",
			key: "all",
		});
		const dailyOverviewAfter = await getRollupBucketRows(t, {
			siteId,
			interval: "day",
			bucketStart: oldDay,
			dimension: "overview",
			key: "all",
		});
		expect(hourlyOverviewAfter).toHaveLength(1);
		expect(dailyOverviewAfter.length).toBeGreaterThan(1);
		expect(hourlyOverviewAfter[0]).toMatchObject({
			shard: 0,
			count: totalEvents,
			pageviewCount: totalEvents,
			sessionCount: totalEvents,
			uniqueVisitorCount: totalEvents,
		});

		const timeseriesAfter = await t.query(api.analytics.getTimeseries, {
			siteId,
			from: oldHour,
			to: oldHour + hourMs,
			interval: "hour",
		});
		expect(timeseriesAfter).toEqual([
			{
				bucketStart: oldHour,
				events: totalEvents,
				pageviews: totalEvents,
				sessions: totalEvents,
				visitors: totalEvents,
			},
		]);

		const overviewAfter = await t.query(api.analytics.getOverview, {
			siteId,
			from: oldDay,
			to: oldDay + dayMs,
		});
		const topPagesAfter = await t.query(api.analytics.getTopPages, {
			siteId,
			from: oldDay,
			to: oldDay + dayMs,
			limit: 10,
		});
		expect(overviewAfter).toEqual(overviewBefore);
		expect(topPagesAfter).toEqual(topPagesBefore);
		expect(topPagesAfter).toEqual([
			{ key: "/", count: 32, pageviewCount: 32 },
			{ key: "/pricing", count: 32, pageviewCount: 32 },
		]);
	});

	test("compaction only collapses old buckets and leaves recent shard fanout intact", async () => {
		const { t, siteId } = await createSite();
		const now = Date.UTC(2026, 0, 8, 12, 0, 0);
		const oldHour = floorToBucket(now - 5 * hourMs, hourMs);
		const recentHour = floorToBucket(now - hourMs, hourMs);
		const oldEventIds = await insertPendingPageviewEvents(t, {
			siteId,
			now,
			bucketStart: oldHour,
			totalEvents: 48,
			visitorCardinality: 3,
			sessionCardinality: 3,
			keyPrefix: "old",
		});
		const recentEventIds = await insertPendingPageviewEvents(t, {
			siteId,
			now,
			bucketStart: recentHour,
			totalEvents: 24,
			visitorCardinality: 3,
			sessionCardinality: 3,
			keyPrefix: "recent",
		});
		for (const chunk of [oldEventIds, recentEventIds]) {
			for (let index = 0; index < chunk.length; index += 25) {
				await t.mutation(internal.ingest.aggregateEventBatch, {
					eventIds: chunk.slice(index, index + 25),
				});
			}
		}

		const oldRowsBefore = await getRollupBucketRows(t, {
			siteId,
			interval: "hour",
			bucketStart: oldHour,
			dimension: "overview",
			key: "all",
		});
		const recentRowsBefore = await getRollupBucketRows(t, {
			siteId,
			interval: "hour",
			bucketStart: recentHour,
			dimension: "overview",
			key: "all",
		});
		expect(oldRowsBefore.length).toBeGreaterThan(1);
		expect(recentRowsBefore.length).toBeGreaterThan(1);

		await t.mutation(internal.compaction.compactShards, {
			siteId,
			interval: "hour",
			now,
		});

		const oldBucketRows = await getRollupBucketRows(t, {
			siteId,
			interval: "hour",
			bucketStart: oldHour,
			dimension: "overview",
			key: "all",
		});
		expect(oldBucketRows).toHaveLength(1);
		expect(oldBucketRows[0]).toMatchObject({
			shard: 0,
			count: 48,
			pageviewCount: 48,
			sessionCount: 3,
			uniqueVisitorCount: 3,
		});
		const recentRowsAfter = await getRollupBucketRows(t, {
			siteId,
			interval: "hour",
			bucketStart: recentHour,
			dimension: "overview",
			key: "all",
		});
		expect(recentRowsAfter.length).toBe(recentRowsBefore.length);

		const timeseries = await t.query(api.analytics.getTimeseries, {
			siteId,
			from: oldHour,
			to: recentHour + hourMs,
			interval: "hour",
		});
		const oldRows = timeseries.filter((row) => row.bucketStart === oldHour);
		const recentRows = timeseries.filter((row) => row.bucketStart === recentHour);
		expect(oldRows).toEqual([
			{
				bucketStart: oldHour,
				events: 48,
				pageviews: 48,
				sessions: 3,
				visitors: 3,
			},
		]);
		expect(recentRows.length).toBeGreaterThan(1);
	});

	test("reused sessionId after timeout creates new session row instead of colliding", async () => {
		const { t, siteId } = await createSite({ sessionTimeoutMs: 30_000 });
		const now = Date.UTC(2026, 0, 10, 12, 0, 0);
		const eventIds = await t.run(async (ctx) => {
			const first = await ctx.db.insert("events", {
				siteId,
				receivedAt: now,
				occurredAt: now,
				visitorId: "visitor-1",
				sessionId: "shared-session",
				eventType: "pageview",
				eventName: "pageview",
				path: "/",
				title: "Home",
				aggregationStatus: "pending",
				aggregationAttempts: 0,
			});
			const second = await ctx.db.insert("events", {
				siteId,
				receivedAt: now,
				occurredAt: now + 120_000,
				visitorId: "visitor-1",
				sessionId: "shared-session",
				eventType: "pageview",
				eventName: "pageview",
				path: "/pricing",
				title: "Pricing",
				aggregationStatus: "pending",
				aggregationAttempts: 0,
			});
			return [first, second];
		});

		await t.mutation(internal.ingest.aggregateEventBatch, { eventIds });

		const sessions = await t.query(api.analytics.listSessions, {
			siteId,
			limit: 10,
		});
		expect(sessions).toHaveLength(2);
		expect(sessions.map((row) => row.sessionId)).toEqual([
			"shared-session",
			"shared-session",
		]);
		expect(sessions[0]).toMatchObject({
			startedAt: now + 120_000,
			entryPath: "/pricing",
			exitPath: "/pricing",
			pageviewCount: 1,
			eventCount: 1,
		});
		expect(sessions[1]).toMatchObject({
			startedAt: now,
			entryPath: "/",
			exitPath: "/",
			pageviewCount: 1,
			eventCount: 1,
		});
	});
});
