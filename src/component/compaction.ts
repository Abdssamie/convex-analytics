import {
	internalAction,
	internalMutation,
	internalQuery,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { IdOfSite } from "./types";
import { dayMs, hourMs } from "./constants";
import { sumRollups } from "./helpers";

const compactionTargetBatchSize = 8;
const compactionTargetScanPageSize = 256;
const compactionRowPageSize = 256;

const compactionTargetValidator = v.object({
	bucketStart: v.number(),
	dimension: v.string(),
});

export const compactShards = internalAction({
	args: {
		siteId: v.id("sites"),
		interval: v.union(v.literal("hour"), v.literal("day")),
		now: v.optional(v.number()),
	},
	returns: v.object({
		compactedPairs: v.number(),
		hasMore: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const now = args.now ?? Date.now();
		const threshold =
			args.interval === "hour" ? now - 2 * hourMs : now - 2 * dayMs;
		let compactedPairs = 0;

		while (true) {
			const targets: Array<{ bucketStart: number; dimension: string }> =
				await ctx.runQuery(internal.compaction.listCompactionTargets, {
					siteId: args.siteId,
					interval: args.interval,
					threshold,
					limit: compactionTargetBatchSize,
				});
			if (targets.length === 0) {
				return { compactedPairs, hasMore: false };
			}

			for (const target of targets) {
				let cursor: string | null = null;
				let touchedRows = 0;
				while (true) {
					const page: {
						compactedRows: number;
						continueCursor: string | null;
						isDone: boolean;
					} = await ctx.runMutation(
						internal.compaction.compactShardPairPage,
						{
							siteId: args.siteId,
							interval: args.interval,
							bucketStart: target.bucketStart,
							dimension: target.dimension,
							now,
							cursor,
							limit: compactionRowPageSize,
						},
					);
					touchedRows += page.compactedRows;
					if (page.isDone) {
						if (touchedRows > 0) {
							compactedPairs += 1;
						}
						break;
					}
					cursor = page.continueCursor;
				}
			}
		}
	},
});

export const listCompactionTargets = internalQuery({
	args: {
		siteId: v.id("sites"),
		interval: v.union(v.literal("hour"), v.literal("day")),
		threshold: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(compactionTargetValidator),
	handler: async (ctx, args) => {
		return await findCompactionTargets(ctx, {
			siteId: args.siteId,
			interval: args.interval,
			threshold: args.threshold,
			limit: Math.max(1, Math.min(args.limit ?? compactionTargetBatchSize, 32)),
		});
	},
});

export const compactShardPairPage = internalMutation({
	args: {
		siteId: v.id("sites"),
		interval: v.union(v.literal("hour"), v.literal("day")),
		bucketStart: v.number(),
		dimension: v.string(),
		now: v.number(),
		cursor: v.union(v.string(), v.null()),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		compactedRows: v.number(),
		continueCursor: v.union(v.string(), v.null()),
		isDone: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query("rollupShards")
			.withIndex("by_site_interval_dimension_bucket", (q) =>
				q
					.eq("siteId", args.siteId)
					.eq("interval", args.interval)
					.eq("dimension", args.dimension)
					.eq("bucketStart", args.bucketStart),
			)
			.paginate({
				numItems: Math.max(1, Math.min(args.limit ?? compactionRowPageSize, 1024)),
				cursor: args.cursor,
			});

		const byKey = new Map<
			string,
			Array<(typeof page.page)[number]>
		>();
		for (const row of page.page) {
			if (row.shard === 0) {
				continue;
			}
			const group = byKey.get(row.key) ?? [];
			group.push(row);
			byKey.set(row.key, group);
		}

		let compactedRows = 0;
		for (const [key, group] of byKey.entries()) {
			const totals = sumRollups(group);
			const shardZero = await ctx.db
				.query("rollupShards")
				.withIndex("by_site_interval_dimension_key_bucket_shard", (q) =>
					q
						.eq("siteId", args.siteId)
						.eq("interval", args.interval)
						.eq("dimension", args.dimension)
						.eq("key", key)
						.eq("bucketStart", args.bucketStart)
						.eq("shard", 0),
				)
				.unique();

			if (shardZero) {
				await ctx.db.patch(shardZero._id, {
					count: shardZero.count + totals.count,
					pageviewCount: shardZero.pageviewCount + totals.pageviewCount,
					bounceCount: shardZero.bounceCount + totals.bounceCount,
					durationMs: shardZero.durationMs + totals.durationMs,
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
					pageviewCount: totals.pageviewCount,
					bounceCount: totals.bounceCount,
					durationMs: totals.durationMs,
					updatedAt: args.now,
				});
			}

			for (const row of group) {
				await ctx.db.delete(row._id);
				compactedRows += 1;
			}
		}

		return {
			compactedRows,
			continueCursor: page.isDone ? null : page.continueCursor,
			isDone: page.isDone,
		};
	},
});

async function findCompactionTargets(
	ctx: QueryCtx,
	args: {
		siteId: IdOfSite;
		interval: "hour" | "day";
		threshold: number;
		limit: number;
	},
) {
	const targets: Array<{ bucketStart: number; dimension: string }> = [];
	const seen = new Set<string>();
	let cursor: string | null = null;

	while (targets.length < args.limit) {
		const page: {
			page: Array<{
				bucketStart: number;
				dimension: string;
				shard: number;
			}>;
			isDone: boolean;
			continueCursor: string;
		} = await ctx.db
			.query("rollupShards")
			.withIndex("by_site_interval_bucket", (q) =>
				q
					.eq("siteId", args.siteId)
					.eq("interval", args.interval)
					.lt("bucketStart", args.threshold),
			)
			.paginate({
				numItems: compactionTargetScanPageSize,
				cursor,
			});

		for (const row of page.page) {
			if (row.shard === 0) {
				continue;
			}
			const dedupeKey = `${row.bucketStart}\u0000${row.dimension}`;
			if (seen.has(dedupeKey)) {
				continue;
			}
			seen.add(dedupeKey);
			targets.push({
				bucketStart: row.bucketStart,
				dimension: row.dimension,
			});
			if (targets.length === args.limit) {
				return targets;
			}
		}

		if (page.isDone) {
			return targets;
		}
		cursor = page.continueCursor;
	}

	return targets;
}
