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
					aggregatedAt: null,
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
			.query("rollups")
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

async function aggregatePendingEvents(
	t: ReturnType<typeof initConvexTest>,
	eventIds: Array<Id<"events">>,
) {
	const siteId = await t.run(async (ctx) => {
		const event = await ctx.db.get(eventIds[0]!);
		if (!event) {
			throw new Error("Event not found");
		}
		return event.siteId;
	});
	const result = await t.mutation(internal.ingest.reducePendingSiteEvents, {
		siteId,
	});
	await t.finishAllScheduledFunctions(() => {});
	return result;
}

describe("rollups", () => {
	test("sites create a single rollup row per bucket key", async () => {
		const t = initConvexTest();
		const siteId = await t.mutation(api.sites.createSite, {
			slug: `site-${Math.random().toString(36).slice(2, 8)}`,
			name: "Rollup Site",
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

		await aggregatePendingEvents(t, eventIds);

		const rows = await getOverviewRowsForBucket(t, { siteId, bucketStart });
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			count: 12,
			pageviewCount: 12,
		});
	});

	test("re-running aggregation adds into the existing rollup row", async () => {
		const t = initConvexTest();
		const siteId = await t.mutation(api.sites.createSite, {
			slug: `site-${Math.random().toString(36).slice(2, 8)}`,
			name: "Rollup Updates",
			writeKeyHash: "write_test_update",
		});
		const now = Date.UTC(2026, 0, 21, 13, 0, 0);
		const bucketStart = floorToBucket(now, hourMs);

		const firstBatch = await insertPendingPageviewEvents(t, {
			siteId,
			now,
			bucketStart,
			totalEvents: 10,
		});
		await aggregatePendingEvents(t, firstBatch);

		const secondBatch = await insertPendingPageviewEvents(t, {
			siteId,
			now: now + 1_000,
			bucketStart,
			totalEvents: 14,
		});
		await aggregatePendingEvents(t, secondBatch);

		const rows = await getOverviewRowsForBucket(t, { siteId, bucketStart });
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			count: 24,
			pageviewCount: 24,
		});
	});
});
