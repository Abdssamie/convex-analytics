import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";
import { hourMs } from "./constants.js";

async function createSite() {
	const t = initConvexTest();
	const siteId = await t.mutation(api.sites.createSite, {
		slug: `site-${Math.random().toString(36).slice(2, 8)}`,
		name: "Scale Test",
		writeKeyHash: "write_test",
	});
	return { t, siteId };
}

describe("component scale flows", () => {
	test("ingestBatch stays append-only and aggregatePending materializes visitors and sessions", async () => {
		const { t, siteId } = await createSite();
		const now = Date.UTC(2026, 0, 1, 12, 0, 0);
		const batchCount = 24;

		const results = await Promise.all(
			Array.from({ length: batchCount }, (_, index) =>
				t.mutation(api.ingest.ingestBatch, {
					writeKeyHash: "write_test",
					visitorId: "visitor-1",
					sessionId: "session-1",
					context: {
						source: "web",
						utmSource: "newsletter",
					},
					events: [
						index === 0
							? {
									type: "pageview" as const,
									path: "/",
									occurredAt: now + index,
									eventId: `event-${index}`,
							  }
							: {
									type: "track" as const,
									name: "cta_click",
									occurredAt: now + index,
									eventId: `event-${index}`,
							  },
					],
				}),
			),
		);
		expect(results.every((result) => result.accepted === 1)).toBe(true);

		const beforeAggregation = await t.run(async (ctx) => {
			const visitors = await ctx.db
				.query("visitors")
				.withIndex("by_siteId_and_visitorId", (q) =>
					q.eq("siteId", siteId).eq("visitorId", "visitor-1"),
				)
				.take(2);
			const sessions = await ctx.db
				.query("sessions")
				.withIndex("by_siteId_and_sessionId", (q) =>
					q.eq("siteId", siteId).eq("sessionId", "session-1"),
				)
				.take(2);
			const pendingEvents = await ctx.db
				.query("events")
				.withIndex("by_siteId_and_aggregationStatus_and_occurredAt", (q) =>
					q
						.eq("siteId", siteId)
						.eq("aggregationStatus", "pending")
						.gte("occurredAt", now),
				)
				.take(100);
			return { visitors, sessions, pendingEvents };
		});
		expect(beforeAggregation.visitors).toHaveLength(0);
		expect(beforeAggregation.sessions).toHaveLength(0);
		expect(beforeAggregation.pendingEvents).toHaveLength(batchCount);

		const aggregateResult = await t.mutation(api.ingest.aggregatePending, {
			siteId,
			now: now + batchCount,
			limit: 100,
		});
		expect(aggregateResult).toEqual({
			aggregated: batchCount,
			skipped: 0,
			remaining: 0,
		});

		const afterAggregation = await t.run(async (ctx) => {
			const visitors = await ctx.db
				.query("visitors")
				.withIndex("by_siteId_and_visitorId", (q) =>
					q.eq("siteId", siteId).eq("visitorId", "visitor-1"),
				)
				.take(2);
			const sessions = await ctx.db
				.query("sessions")
				.withIndex("by_siteId_and_sessionId", (q) =>
					q.eq("siteId", siteId).eq("sessionId", "session-1"),
				)
				.take(2);
			return { visitors, sessions };
		});
		expect(afterAggregation.visitors).toHaveLength(1);
		expect(afterAggregation.sessions).toHaveLength(1);
		expect(afterAggregation.visitors[0]?.firstSeenAt).toBe(now);
		expect(afterAggregation.visitors[0]?.lastSeenAt).toBe(now + batchCount - 1);
		expect(afterAggregation.sessions[0]).toMatchObject({
			eventCount: batchCount,
			pageviewCount: 1,
			bounce: true,
			entryPath: "/",
			exitPath: "/",
		});

		const overview = await t.query(api.analytics.getOverview, {
			siteId,
			from: now - 1,
			to: now + hourMs,
		});
		expect(overview.events).toBe(batchCount);
		expect(overview.pageviews).toBe(1);
		expect(overview.sessions).toBe(1);
		expect(overview.visitors).toBe(1);
	});

	test("compactShards collapses shard fanout without changing totals", async () => {
		const { t, siteId } = await createSite();
		const now = Date.UTC(2026, 0, 5, 12, 0, 0);
		const oldBucketStart = now - 4 * hourMs;
		const recentBucketStart = now - hourMs;

		await t.run(async (ctx) => {
			for (let shard = 0; shard < 16; shard += 1) {
				await ctx.db.insert("rollupShards", {
					siteId,
					interval: "hour",
					bucketStart: oldBucketStart,
					dimension: "overview",
					key: "all",
					shard,
					count: shard + 1,
					uniqueVisitorCount: shard + 2,
					sessionCount: shard + 3,
					pageviewCount: shard + 4,
					bounceCount: shard + 5,
					durationMs: shard + 6,
					updatedAt: oldBucketStart + shard,
				});
			}
			await ctx.db.insert("rollupShards", {
				siteId,
				interval: "hour",
				bucketStart: recentBucketStart,
				dimension: "overview",
				key: "all",
				shard: 0,
				count: 99,
				uniqueVisitorCount: 88,
				sessionCount: 77,
				pageviewCount: 66,
				bounceCount: 55,
				durationMs: 44,
				updatedAt: recentBucketStart,
			});
		});

		const result = await t.mutation(api.compaction.compactShards, {
			siteId,
			interval: "hour",
			now,
		});
		expect(result.compactedBuckets).toBe(1);
		expect(result.hasMore).toBe(false);

		const rows = await t.run(async (ctx) => {
			const oldRows = await ctx.db
				.query("rollupShards")
				.withIndex("by_site_interval_bucket", (q) =>
					q
						.eq("siteId", siteId)
						.eq("interval", "hour")
						.eq("bucketStart", oldBucketStart),
				)
				.take(20);
			const recentRows = await ctx.db
				.query("rollupShards")
				.withIndex("by_site_interval_bucket", (q) =>
					q
						.eq("siteId", siteId)
						.eq("interval", "hour")
						.eq("bucketStart", recentBucketStart),
				)
				.take(20);
			return { oldRows, recentRows };
		});
		expect(rows.oldRows).toHaveLength(1);
		expect(rows.recentRows).toHaveLength(1);
		expect(rows.oldRows[0]).toMatchObject({
			shard: 0,
			count: 136,
			uniqueVisitorCount: 152,
			sessionCount: 168,
			pageviewCount: 184,
			bounceCount: 200,
			durationMs: 216,
			updatedAt: now,
		});
		expect(rows.recentRows[0]?.count).toBe(99);
	});
});
