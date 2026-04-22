import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { initConvexTest } from "./setup.test.js";
import { dayMs, hourMs } from "./constants.js";
import { floorToBucket, shardForEvent } from "./helpers.js";

async function createSite(overrides?: {
	slug?: string;
	writeKeyHash?: string;
	sessionTimeoutMs?: number;
	rollupShardCount?: number;
}) {
	const t = initConvexTest();
	const siteId = await t.mutation(api.sites.createSite, {
		slug:
			overrides?.slug ?? `site-${Math.random().toString(36).slice(2, 8)}`,
		name: "Scale Test",
		writeKeyHash: overrides?.writeKeyHash ?? "write_test",
		sessionTimeoutMs: overrides?.sessionTimeoutMs,
		rollupShardCount: overrides?.rollupShardCount ?? 8,
	});
	return {
		t,
		siteId,
		writeKeyHash: overrides?.writeKeyHash ?? "write_test",
		rollupShardCount: overrides?.rollupShardCount ?? 8,
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
		const events = await ctx.db
			.query("events")
			.withIndex("by_siteId_and_occurredAt", (q) =>
				q.eq("siteId", siteId).lte("occurredAt", now),
			)
			.take(500);
		return {
			visitors,
			sessions,
			events,
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

async function getRollupShardRow(
	t: ReturnType<typeof initConvexTest>,
	args: {
		siteId: Id<"sites">;
		interval: "hour" | "day";
		bucketStart: number;
		dimension: string;
		key: string;
		shard: number;
	},
) {
	return await t.run(async (ctx) => {
		return await ctx.db
			.query("rollupShards")
			.withIndex("by_site_interval_dimension_key_bucket_shard", (q) =>
				q
					.eq("siteId", args.siteId)
					.eq("interval", args.interval)
					.eq("dimension", args.dimension)
					.eq("key", args.key)
					.eq("bucketStart", args.bucketStart)
					.eq("shard", args.shard),
			)
			.unique();
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
				aggregatedAt: null,
			});
			eventIds.push(eventId);
		}
		return eventIds;
	});
}

async function insertPendingPageviewEvent(
	t: ReturnType<typeof initConvexTest>,
	args: {
		siteId: Id<"sites">;
		now: number;
		occurredAt: number;
		visitorId: string;
		sessionId: string;
		path?: string;
		referrer?: string;
		utmSource?: string;
		utmCampaign?: string;
	},
) {
	return await t.run(async (ctx) => {
		return await ctx.db.insert("events", {
			siteId: args.siteId,
			receivedAt: args.now,
			occurredAt: args.occurredAt,
			visitorId: args.visitorId,
			sessionId: args.sessionId,
			eventType: "pageview",
			eventName: "pageview",
			path: args.path ?? "/",
			title: "Page",
			referrer: args.referrer,
			source: "web",
			utmSource: args.utmSource,
			utmCampaign: args.utmCampaign,
			aggregatedAt: null,
		});
	});
}

async function insertCollidingPendingPageviewEvents(
	t: ReturnType<typeof initConvexTest>,
	args: {
		siteId: Id<"sites">;
		now: number;
		occurredAt: number;
		targetCount: number;
		rollupShardCount: number;
	},
) {
	const byShard = new Map<number, Array<Id<"events">>>();
	for (let index = 0; index < 64; index += 1) {
		const eventId = await insertPendingPageviewEvent(t, {
			siteId: args.siteId,
			now: args.now,
			occurredAt: args.occurredAt + index,
			visitorId: `collision-visitor-${index}`,
			sessionId: `collision-session-${index}`,
			path: "/collision",
			referrer: "https://google.com",
			utmSource: "newsletter",
			utmCampaign: "spring",
		});
		const shard = shardForEvent(eventId, args.rollupShardCount);
		const shardIds = byShard.get(shard) ?? [];
		shardIds.push(eventId);
		byShard.set(shard, shardIds);
		if (shardIds.length >= args.targetCount) {
			return {
				shard,
				eventIds: shardIds.slice(0, args.targetCount),
			};
		}
	}
	throw new Error("Could not create colliding event ids");
}

describe("realistic ingestion, sharding, and compaction flows", () => {
	test("scheduled worker materializes visitors, sessions, and rollups after append-only ingest", async () => {
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
				},
				{
					type: "track",
					name: "signup_click",
					occurredAt: base + 60_000,
				},
				{
					type: "identify",
					occurredAt: base + 120_000,
					userId: "user-1",
					properties: { plan: "pro", company: "Acme" },
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
				},
				{
					type: "pageview",
					path: "/checkout",
					title: "Checkout",
					occurredAt: base + 6 * 60_000,
				},
				{
					type: "track",
					name: "purchase",
					occurredAt: base + 7 * 60_000,
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
				},
				{
					type: "track",
					name: "search",
					occurredAt: base + 2 * hourMs + 30_000,
				},
			],
		});

		const before = await countSiteRows(t, siteId, base + 3 * hourMs);
		expect(before.visitors).toHaveLength(0);
		expect(before.sessions).toHaveLength(0);
		expect(before.events).toHaveLength(8);
		expect(before.events.every((row) => row.aggregatedAt === null)).toBe(true);

		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		const after = await countSiteRows(t, siteId, base + 3 * hourMs);
		expect(after.events).toHaveLength(8);
		expect(after.events.every((row) => row.aggregatedAt !== null)).toBe(true);
		expect(after.visitors).toHaveLength(2);
		expect(after.sessions).toHaveLength(3);

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
			pageviewCount: 1,
			identifiedUserId: "user-1",
			startedAt: base,
			lastSeenAt: base + 120_000,
		});
		expect(sessions.get("session-b")).toMatchObject({
			visitorId: "visitor-2",
			entryPath: "/pricing",
			exitPath: "/checkout",
			pageviewCount: 2,
			startedAt: base + 5 * 60_000,
			lastSeenAt: base + 7 * 60_000,
		});
		expect(sessions.get("session-c")).toMatchObject({
			visitorId: "visitor-1",
			entryPath: "/docs",
			exitPath: "/docs",
			pageviewCount: 1,
			startedAt: base + 2 * hourMs,
			lastSeenAt: base + 2 * hourMs + 30_000,
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

		const signupPlanBreakdown = await t.query(
			api.analytics.getEventPropertyBreakdown,
			{
				siteId,
				eventName: "signup_click",
				propertyKey: "plan",
				from: base - 1,
				to: base + dayMs,
				limit: 10,
			},
		);
		expect(signupPlanBreakdown).toEqual([]);

		const rawEvents = await t.query(api.analytics.listRawEvents, {
			siteId,
			from: base - 1,
			to: base + dayMs,
			paginationOpts: {
				numItems: 20,
				cursor: null,
			},
		});
		expect(rawEvents.page).toHaveLength(8);
		expect(rawEvents.isDone).toBe(true);
		expect(
			rawEvents.page.every(
				(row: { aggregatedAt?: number | null }) => row.aggregatedAt !== null,
			),
		).toBe(true);

		const rawEventsPageOne = await t.query(api.analytics.listRawEvents, {
			siteId,
			from: base - 1,
			to: base + dayMs,
			paginationOpts: {
				numItems: 3,
				cursor: null,
			},
		});
		expect(rawEventsPageOne.page).toHaveLength(3);
		expect(rawEventsPageOne.isDone).toBe(false);
		const rawEventsPageTwo = await t.query(api.analytics.listRawEvents, {
			siteId,
			from: base - 1,
			to: base + dayMs,
			paginationOpts: {
				numItems: 3,
				cursor: rawEventsPageOne.continueCursor,
			},
		});
		expect(rawEventsPageTwo.page).toHaveLength(3);

		const partialOverview = await t.query(api.analytics.getOverview, {
			siteId,
			from: base + 30_000,
			to: base + 6 * 60_000 + 30_000,
		});
		expect(partialOverview).toMatchObject({
			events: 4,
			pageviews: 2,
			sessions: 1,
			visitors: 1,
		});

		const partialTopEvents = await t.query(api.analytics.getTopEvents, {
			siteId,
			from: base + 30_000,
			to: base + 6 * 60_000 + 30_000,
			limit: 10,
		});
		expect(partialTopEvents).toEqual([
			{ key: "pageview", count: 2, pageviewCount: 2 },
			{ key: "signup_click", count: 1, pageviewCount: 0 },
			{ key: "identify", count: 1, pageviewCount: 0 },
		]);

		const partialTopSources = await t.query(api.analytics.getTopSources, {
			siteId,
			from: base + 30_000,
			to: base + 6 * 60_000 + 30_000,
			limit: 10,
		});
		expect(partialTopSources).toEqual([
			{ key: "newsletter", count: 2, pageviewCount: 0 },
			{ key: "ads", count: 2, pageviewCount: 2 },
		]);
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
		expect(timeseriesBefore).toEqual([
			{
				bucketStart: oldHour,
				events: totalEvents,
				pageviews: totalEvents,
				sessions: totalEvents,
				visitors: totalEvents,
			},
		]);
		const timeseriesBeforeTotals = timeseriesBefore.reduce(
			(
				sum: { events: number; pageviews: number; sessions: number; visitors: number },
				row: { events: number; pageviews: number; sessions: number; visitors: number },
			) => ({
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

		await t.action(internal.compaction.compactShards, {
			siteId,
			interval: "hour",
			now,
		});
		await t.action(internal.compaction.compactShards, {
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

		await t.action(internal.compaction.compactShards, {
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
		const oldRows = timeseries.filter(
			(row: { bucketStart: number }) => row.bucketStart === oldHour,
		);
		const recentRows = timeseries.filter(
			(row: { bucketStart: number }) => row.bucketStart === recentHour,
		);
		expect(oldRows).toEqual([
			{
				bucketStart: oldHour,
				events: 48,
				pageviews: 48,
				sessions: 3,
				visitors: 3,
			},
		]);
		expect(recentRows).toEqual([
			{
				bucketStart: recentHour,
				events: 24,
				pageviews: 24,
				sessions: 3,
				visitors: 3,
			},
		]);
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
				aggregatedAt: null,
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
				aggregatedAt: null,
			});
			return [first, second];
		});

		await t.mutation(internal.ingest.aggregateEventBatch, { eventIds });

		const sessions = await t.query(api.analytics.listSessions, {
			siteId,
			paginationOpts: {
				numItems: 10,
				cursor: null,
			},
		});
		expect(sessions.page).toHaveLength(2);
		expect(sessions.isDone).toBe(true);
		expect(
			sessions.page.map((row: { sessionId: string }) => row.sessionId),
		).toEqual([
			"shared-session",
			"shared-session",
		]);
		expect(sessions.page[0]).toMatchObject({
			startedAt: now + 120_000,
			entryPath: "/pricing",
			exitPath: "/pricing",
			pageviewCount: 1,
		});
		expect(sessions.page[1]).toMatchObject({
			startedAt: now,
			entryPath: "/",
			exitPath: "/",
			pageviewCount: 1,
		});
	});

	test("aggregateEventBatch merges same-shard rollup deltas within batch", async () => {
		const { t, siteId, rollupShardCount } = await createSite();
		const now = Date.UTC(2026, 0, 11, 12, 0, 0);
		const bucketStart = floorToBucket(now, hourMs);
		const { shard, eventIds } = await insertCollidingPendingPageviewEvents(t, {
			siteId,
			now,
			occurredAt: bucketStart,
			targetCount: 3,
			rollupShardCount,
		});

		await t.mutation(internal.ingest.aggregateEventBatch, { eventIds });

		const hourlyOverview = await getRollupShardRow(t, {
			siteId,
			interval: "hour",
			bucketStart,
			dimension: "overview",
			key: "all",
			shard,
		});
		const hourlyPage = await getRollupShardRow(t, {
			siteId,
			interval: "hour",
			bucketStart,
			dimension: "page",
			key: "/collision",
			shard,
		});
		const hourlySource = await getRollupShardRow(t, {
			siteId,
			interval: "hour",
			bucketStart,
			dimension: "utmSource",
			key: "newsletter",
			shard,
		});
		const dailyOverview = await getRollupShardRow(t, {
			siteId,
			interval: "day",
			bucketStart: floorToBucket(bucketStart, dayMs),
			dimension: "overview",
			key: "all",
			shard,
		});

		expect(hourlyOverview).toMatchObject({
			count: 3,
			uniqueVisitorCount: 3,
			sessionCount: 3,
			pageviewCount: 3,
		});
		expect(hourlyPage).toMatchObject({
			count: 3,
			uniqueVisitorCount: 3,
			sessionCount: 3,
			pageviewCount: 3,
		});
		expect(hourlySource).toMatchObject({
			count: 3,
			uniqueVisitorCount: 3,
			sessionCount: 3,
			pageviewCount: 3,
		});
		expect(dailyOverview).toMatchObject({
			count: 3,
			uniqueVisitorCount: 3,
			sessionCount: 3,
			pageviewCount: 3,
		});

		const hourlyOverviewRows = await getRollupBucketRows(t, {
			siteId,
			interval: "hour",
			bucketStart,
			dimension: "overview",
			key: "all",
		});
		expect(hourlyOverviewRows.filter((row) => row.shard === shard)).toHaveLength(1);
	});

	test("aggregateEventBatch patches existing rollup shard once with merged batch totals", async () => {
		const { t, siteId, rollupShardCount } = await createSite();
		const now = Date.UTC(2026, 0, 11, 14, 0, 0);
		const bucketStart = floorToBucket(now, hourMs);
		const { shard, eventIds } = await insertCollidingPendingPageviewEvents(t, {
			siteId,
			now,
			occurredAt: bucketStart,
			targetCount: 2,
			rollupShardCount,
		});
		const dayBucketStart = floorToBucket(bucketStart, dayMs);

		await t.run(async (ctx) => {
			await ctx.db.insert("rollupShards", {
				siteId,
				interval: "hour",
				bucketStart,
				dimension: "overview",
				key: "all",
				shard,
				count: 7,
				uniqueVisitorCount: 4,
				sessionCount: 5,
				pageviewCount: 6,
				bounceCount: 0,
				durationMs: 0,
				updatedAt: now - 1_000,
			});
			await ctx.db.insert("rollupShards", {
				siteId,
				interval: "day",
				bucketStart: dayBucketStart,
				dimension: "overview",
				key: "all",
				shard,
				count: 10,
				uniqueVisitorCount: 6,
				sessionCount: 7,
				pageviewCount: 9,
				bounceCount: 0,
				durationMs: 0,
				updatedAt: now - 1_000,
			});
		});

		await t.mutation(internal.ingest.aggregateEventBatch, { eventIds });

		const hourlyOverview = await getRollupShardRow(t, {
			siteId,
			interval: "hour",
			bucketStart,
			dimension: "overview",
			key: "all",
			shard,
		});
		const dailyOverview = await getRollupShardRow(t, {
			siteId,
			interval: "day",
			bucketStart: dayBucketStart,
			dimension: "overview",
			key: "all",
			shard,
		});

		expect(hourlyOverview).toMatchObject({
			count: 9,
			uniqueVisitorCount: 6,
			sessionCount: 7,
			pageviewCount: 8,
		});
		expect(dailyOverview).toMatchObject({
			count: 12,
			uniqueVisitorCount: 8,
			sessionCount: 9,
			pageviewCount: 11,
		});
		expect(hourlyOverview!.updatedAt).toBeGreaterThan(now - 1_000);
		expect(dailyOverview!.updatedAt).toBeGreaterThan(now - 1_000);
	});

	test("compaction page mutation only folds one bucket dimension at a time", async () => {
		const { t, siteId } = await createSite();
		const now = Date.UTC(2026, 0, 14, 12, 0, 0);
		const bucketStart = floorToBucket(now - 4 * hourMs, hourMs);

		await t.run(async (ctx) => {
			for (let shard = 1; shard <= 3; shard += 1) {
				await ctx.db.insert("rollupShards", {
					siteId,
					interval: "hour",
					bucketStart,
					dimension: "overview",
					key: "all",
					shard,
					count: 2,
					uniqueVisitorCount: 2,
					sessionCount: 2,
					pageviewCount: 2,
					bounceCount: 0,
					durationMs: 0,
					updatedAt: now,
				});
				await ctx.db.insert("rollupShards", {
					siteId,
					interval: "hour",
					bucketStart,
					dimension: "event",
					key: "pageview",
					shard,
					count: 1,
					uniqueVisitorCount: 0,
					sessionCount: 0,
					pageviewCount: 1,
					bounceCount: 0,
					durationMs: 0,
					updatedAt: now,
				});
			}
		});

		const firstPage = await t.mutation(internal.compaction.compactShardPairPage, {
			siteId,
			interval: "hour",
			bucketStart,
			dimension: "overview",
			now,
			cursor: null,
			limit: 2,
		});
		expect(firstPage.compactedRows).toBe(2);
		expect(firstPage.isDone).toBe(false);

		const overviewRowsMidway = await getRollupBucketRows(t, {
			siteId,
			interval: "hour",
			bucketStart,
			dimension: "overview",
			key: "all",
		});
		const eventRowsMidway = await getRollupBucketRows(t, {
			siteId,
			interval: "hour",
			bucketStart,
			dimension: "event",
			key: "pageview",
		});
		expect(overviewRowsMidway.some((row) => row.shard === 0)).toBe(true);
		expect(eventRowsMidway.every((row) => row.shard !== 0)).toBe(true);

		let cursor = firstPage.continueCursor;
		while (cursor !== null) {
			const nextPage = await t.mutation(internal.compaction.compactShardPairPage, {
				siteId,
				interval: "hour",
				bucketStart,
				dimension: "overview",
				now,
				cursor,
				limit: 2,
			});
			cursor = nextPage.continueCursor;
		}

		const overviewRowsAfter = await getRollupBucketRows(t, {
			siteId,
			interval: "hour",
			bucketStart,
			dimension: "overview",
			key: "all",
		});
		const eventRowsAfter = await getRollupBucketRows(t, {
			siteId,
			interval: "hour",
			bucketStart,
			dimension: "event",
			key: "pageview",
		});
		expect(overviewRowsAfter).toHaveLength(1);
		expect(overviewRowsAfter[0]).toMatchObject({
			shard: 0,
			count: 6,
			uniqueVisitorCount: 6,
			sessionCount: 6,
			pageviewCount: 6,
		});
		expect(eventRowsAfter).toHaveLength(3);
	});

	test("failed aggregations mark event failed once without auto requeue", async () => {
		const { t } = await createSite();
		const now = Date.UTC(2026, 0, 12, 12, 0, 0);
		const eventId = await t.run(async (ctx) => {
			const orphanSiteId = await ctx.db.insert("sites", {
				slug: "orphan-site",
				name: "Orphan",
				status: "active",
				writeKeyHash: "orphan",
				allowedOrigins: [],
				settings: {
					sessionTimeoutMs: 30 * 60 * 1000,
					retentionDays: 90,
					rawEventRetentionDays: 90,
					hourlyRollupRetentionDays: 90,
					rollupShardCount: 1,
				},
				createdAt: now,
				updatedAt: now,
			});
			const id = await ctx.db.insert("events", {
				siteId: orphanSiteId,
				receivedAt: now,
				occurredAt: now,
				visitorId: "visitor-1",
				sessionId: "session-1",
				eventType: "pageview",
				eventName: "pageview",
				path: "/broken",
				aggregatedAt: null,
			});
			await ctx.db.delete(orphanSiteId);
			return id;
		});

		const result = await t.mutation(internal.ingest.aggregateEventBatch, {
			eventIds: [eventId],
		});
		expect(result).toEqual({
			aggregated: 0,
			skipped: 0,
			failed: 1,
		});

		const failedEvent = await t.run(async (ctx) => {
			return await ctx.db.get(eventId);
		});
		expect(failedEvent).toMatchObject({
			aggregatedAt: null,
		});
	});

	test("event property breakdown groups custom track events by requested property", async () => {
		vi.useFakeTimers();
		try {
			const { t, siteId, writeKeyHash } = await createSite();
			const base = Date.UTC(2026, 0, 13, 9, 0, 0);

			await t.mutation(api.ingest.ingestBatch, {
				writeKeyHash,
				visitorId: "visitor-1",
				sessionId: "session-1",
				context: {
					source: "web",
				},
				events: [
					{
						type: "track",
						name: "plan_selected",
						occurredAt: base,
						properties: { plan: "pro", billingCycle: "monthly" },
					},
					{
						type: "track",
						name: "plan_selected",
						occurredAt: base + 1_000,
						properties: { plan: "starter", billingCycle: "monthly" },
					},
					{
						type: "track",
						name: "plan_selected",
						occurredAt: base + 2_000,
						properties: { plan: "pro", billingCycle: "yearly" },
					},
					{
						type: "track",
						name: "checkout_started",
						occurredAt: base + 3_000,
						properties: { plan: "enterprise" },
					},
				],
			});

			await t.finishAllScheduledFunctions(() => vi.runAllTimers());

			const byPlan = await t.query(api.analytics.getEventPropertyBreakdown, {
				siteId,
				eventName: "plan_selected",
				propertyKey: "plan",
				from: base - 1,
				to: base + hourMs,
				limit: 10,
			});
			expect(byPlan).toEqual([
				{ value: "pro", count: 2 },
				{ value: "starter", count: 1 },
			]);

			const byBillingCycle = await t.query(
				api.analytics.getEventPropertyBreakdown,
				{
					siteId,
					eventName: "plan_selected",
					propertyKey: "billingCycle",
					from: base - 1,
					to: base + hourMs,
					limit: 10,
				},
			);
			expect(byBillingCycle).toEqual([
				{ value: "monthly", count: 2 },
				{ value: "yearly", count: 1 },
			]);

			const missingProperty = await t.query(
				api.analytics.getEventPropertyBreakdown,
				{
					siteId,
					eventName: "plan_selected",
					propertyKey: "variant",
					from: base - 1,
					to: base + hourMs,
					limit: 10,
				},
			);
			expect(missingProperty).toEqual([]);
		} finally {
			vi.useRealTimers();
		}
	});
});
