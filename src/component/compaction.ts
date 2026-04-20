import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { IdOfSite } from "./types";
import { dayMs, hourMs } from "./constants";
import { sumRollups } from "./helpers";

const compactionBucketBatchSize = 8;
const compactionRowBatchSize = 10_000;

export const compactShards = internalMutation({
	args: {
		siteId: v.id("sites"),
		interval: v.union(v.literal("hour"), v.literal("day")),
		now: v.optional(v.number()),
		bucketStart: v.optional(v.number()),
	},
	returns: v.object({
		compactedBuckets: v.number(),
		hasMore: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const now = args.now ?? Date.now();
		const threshold =
			args.interval === "hour" ? now - 2 * hourMs : now - 2 * dayMs;
		if (args.bucketStart !== undefined) {
			const bucket = await compactBucket(ctx, {
				siteId: args.siteId,
				interval: args.interval,
				bucketStart: args.bucketStart,
				now,
			});
			if (bucket.hasMore) {
				await ctx.scheduler.runAfter(0, internal.compaction.compactShards, {
					siteId: args.siteId,
					interval: args.interval,
					now,
					bucketStart: args.bucketStart,
				});
			}
			return {
				compactedBuckets: bucket.compacted ? 1 : 0,
				hasMore: bucket.hasMore,
			};
		}
		const bucketStarts: number[] = [];
		let hasMore = false;
		const query = ctx.db
			.query("rollupShards")
			.withIndex("by_site_interval_bucket", (q) =>
				q
					.eq("siteId", args.siteId)
					.eq("interval", args.interval)
					.lt("bucketStart", threshold),
			);

		for await (const row of query) {
			const lastBucketStart = bucketStarts[bucketStarts.length - 1];
			if (lastBucketStart !== row.bucketStart) {
				if (bucketStarts.length === compactionBucketBatchSize) {
					hasMore = true;
					break;
				}
				bucketStarts.push(row.bucketStart);
			}
		}

		for (const bucketStart of bucketStarts) {
			const bucket = await compactBucket(ctx, {
				siteId: args.siteId,
				interval: args.interval,
				bucketStart,
				now,
			});
			if (bucket.hasMore) {
				hasMore = true;
				await ctx.scheduler.runAfter(0, internal.compaction.compactShards, {
					siteId: args.siteId,
					interval: args.interval,
					now,
					bucketStart,
				});
			}
		}

		if (hasMore) {
			await ctx.scheduler.runAfter(0, internal.compaction.compactShards, {
				siteId: args.siteId,
				interval: args.interval,
				now,
			});
		}

		return { compactedBuckets: bucketStarts.length, hasMore };
	},
});

async function compactBucket(
	ctx: MutationCtx,
	args: {
		siteId: IdOfSite;
		interval: "hour" | "day";
		bucketStart: number;
		now: number;
	},
) {
	const rows = await ctx.db
		.query("rollupShards")
		.withIndex("by_site_interval_bucket", (q) =>
			q
				.eq("siteId", args.siteId)
				.eq("interval", args.interval)
				.eq("bucketStart", args.bucketStart),
		)
		.take(compactionRowBatchSize);
	if (rows.length === 0) {
		return { compacted: false, hasMore: false };
	}
	const groups = new Map<string, typeof rows>();
	for (const row of rows) {
		const key = `${row.dimension}\u0000${row.key}`;
		const group = groups.get(key) ?? [];
		group.push(row);
		groups.set(key, group);
	}

	for (const group of groups.values()) {
		const totals = sumRollups(group);
		const shardZero = group.find((row) => row.shard === 0);
		if (shardZero) {
			await ctx.db.patch(shardZero._id, {
				count: totals.count,
				uniqueVisitorCount: totals.uniqueVisitorCount,
				sessionCount: totals.sessionCount,
				pageviewCount: totals.pageviewCount,
				bounceCount: totals.bounceCount,
				durationMs: totals.durationMs,
				updatedAt: args.now,
			});
		} else {
			const exemplar = group[0];
			await ctx.db.insert("rollupShards", {
				siteId: exemplar.siteId,
				interval: exemplar.interval,
				bucketStart: exemplar.bucketStart,
				dimension: exemplar.dimension,
				key: exemplar.key,
				shard: 0,
				count: totals.count,
				uniqueVisitorCount: totals.uniqueVisitorCount,
				sessionCount: totals.sessionCount,
				pageviewCount: totals.pageviewCount,
				bounceCount: totals.bounceCount,
				durationMs: totals.durationMs,
				updatedAt: args.now,
			});
		}
		for (const row of group) {
			if (row.shard !== 0) {
				await ctx.db.delete(row._id);
			}
		}
	}
	return {
		compacted: true,
		hasMore: rows.length === compactionRowBatchSize,
	};
}
