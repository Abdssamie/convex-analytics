import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { initConvexTest } from "./setup.test.js";
import { floorToBucket } from "./helpers.js";
import { hourMs } from "./constants.js";

async function insertPendingPageviewEvents(
	t: ReturnType<typeof initConvexTest>,
	args: {
		siteId: Id<"sites">;
		now: number;
		bucketStart: number;
		totalEvents: number;
	},
) {
	return await t.run(async (ctx) => {
		const eventIds: Array<Id<"events">> = [];
		for (let index = 0; index < args.totalEvents; index += 1) {
			eventIds.push(
				await ctx.db.insert("events", {
					siteId: args.siteId,
					receivedAt: args.now,
					occurredAt: args.bucketStart + index,
					visitorId: `visitor-${index}`,
					sessionId: `session-${index}`,
					eventType: "pageview",
					eventName: "pageview",
					path: "/",
					title: "Home",
					aggregationStatus: "pending",
					aggregationAttempts: 0,
				}),
			);
		}
		return eventIds;
	});
}

async function getOverviewRowsForBucket(
	t: ReturnType<typeof initConvexTest>,
	args: {
		siteId: Id<"sites">;
		bucketStart: number;
	},
) {
	return await t.run(async (ctx) => {
		return await ctx.db
			.query("rollupShards")
			.withIndex("by_site_interval_dimension_key_bucket", (q) =>
				q
					.eq("siteId", args.siteId)
					.eq("interval", "hour")
					.eq("dimension", "overview")
					.eq("key", "all")
					.eq("bucketStart", args.bucketStart),
			)
			.take(100);
	});
}

describe("rollup shard count", () => {
	test("sites default to one rollup shard and only write shard zero", async () => {
		const t = initConvexTest();
		const siteId = await t.mutation(api.sites.createSite, {
			slug: `site-${Math.random().toString(36).slice(2, 8)}`,
			name: "Default Shards",
			writeKeyHash: "write_test_default",
		});
		const now = Date.UTC(2026, 0, 21, 12, 0, 0);
		const bucketStart = floorToBucket(now, hourMs);
		const eventIds = await insertPendingPageviewEvents(t, {
			siteId,
			now,
			bucketStart,
			totalEvents: 12,
		});

		await t.mutation(internal.ingest.aggregateEventBatch, { eventIds });

		const site = await t.run(async (ctx) => await ctx.db.get(siteId));
		const rows = await getOverviewRowsForBucket(t, { siteId, bucketStart });
		expect(site?.settings.rollupShardCount).toBe(1);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.shard).toBe(0);
	});

	test("sites can opt into wider shard fanout", async () => {
		const t = initConvexTest();
		const siteId = await t.mutation(api.sites.createSite, {
			slug: `site-${Math.random().toString(36).slice(2, 8)}`,
			name: "Wide Shards",
			writeKeyHash: "write_test_wide",
			rollupShardCount: 8,
		});
		const now = Date.UTC(2026, 0, 21, 13, 0, 0);
		const bucketStart = floorToBucket(now, hourMs);
		const eventIds = await insertPendingPageviewEvents(t, {
			siteId,
			now,
			bucketStart,
			totalEvents: 24,
		});

		await t.mutation(internal.ingest.aggregateEventBatch, { eventIds });

		const rows = await getOverviewRowsForBucket(t, { siteId, bucketStart });
		expect(new Set(rows.map((row) => row.shard)).size).toBeGreaterThan(1);
		expect(rows.some((row) => row.shard !== 0)).toBe(true);
	});
});
