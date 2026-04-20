import { query } from "./_generated/server.js";
import type { QueryCtx } from "./_generated/server.js";
import { v } from "convex/values";
import { topRowValidator, eventValidator, sessionValidator } from "./types.js";
import type { IdOfSite } from "./types.js";
import { hourMs, dayMs, rollupShardCount } from "./constants.js";
import { floorToBucket, sumRollups } from "./helpers.js";

export const getOverview = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
	},
	returns: v.object({
		events: v.number(),
		pageviews: v.number(),
		sessions: v.number(),
		visitors: v.number(),
		bounceRate: v.number(),
		averageSessionDurationMs: v.number(),
	}),
	handler: async (ctx, args) => {
		const rows = await queryDailyRollups(ctx, args, "overview", "all");
		const totals = sumRollups(rows);
		return {
			events: totals.count,
			pageviews: totals.pageviewCount,
			sessions: totals.sessionCount,
			visitors: totals.uniqueVisitorCount,
			bounceRate:
				totals.sessionCount === 0
					? 0
					: totals.bounceCount / totals.sessionCount,
			averageSessionDurationMs:
				totals.sessionCount === 0 ? 0 : totals.durationMs / totals.sessionCount,
		};
	},
});

export const getTimeseries = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		interval: v.union(v.literal("hour"), v.literal("day")),
	},
	returns: v.array(
		v.object({
			bucketStart: v.number(),
			events: v.number(),
			pageviews: v.number(),
			sessions: v.number(),
			visitors: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const rows =
			args.interval === "hour"
				? await queryHourlyRollups(ctx, args, "overview", "all")
				: await queryDailyRollups(ctx, args, "overview", "all");
		return rows.map((row) => ({
			bucketStart: row.bucketStart,
			events: row.count,
			pageviews: row.pageviewCount,
			sessions: row.sessionCount,
			visitors: row.uniqueVisitorCount,
		}));
	},
});

export const getTopPages = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(topRowValidator),
	handler: async (ctx, args) => {
		return await topDimension(ctx, args, "page", args.limit ?? 10);
	},
});

export const getTopReferrers = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(topRowValidator),
	handler: async (ctx, args) => {
		return await topDimension(ctx, args, "referrer", args.limit ?? 10);
	},
});

export const getTopCampaigns = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(topRowValidator),
	handler: async (ctx, args) => {
		return await topDimension(ctx, args, "utmCampaign", args.limit ?? 10);
	},
});
export const getTopEvents = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(topRowValidator),
	handler: async (ctx, args) => {
		return await topDimension(ctx, args, "event", args.limit ?? 10);
	},
});
export const listRawEvents = query({
	args: {
		siteId: v.id("sites"),
		from: v.optional(v.number()),
		to: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	returns: v.array(eventValidator),
	handler: async (ctx, args) => {
		return await ctx.db
			.query("events")
			.withIndex("by_siteId_and_occurredAt", (q) =>
				q
					.eq("siteId", args.siteId)
					.gte("occurredAt", args.from ?? 0)
					.lt("occurredAt", args.to ?? Number.MAX_SAFE_INTEGER),
			)
			.order("desc")
			.take(Math.min(args.limit ?? 100, 500));
	},
});
export const listSessions = query({
	args: {
		siteId: v.id("sites"),
		limit: v.optional(v.number()),
	},
	returns: v.array(sessionValidator),
	handler: async (ctx, args) => {
		return await ctx.db
			.query("sessions")
			.withIndex("by_siteId_and_startedAt", (q) => q.eq("siteId", args.siteId))
			.order("desc")
			.take(Math.min(args.limit ?? 100, 500));
	},
});

export async function queryHourlyRollups(
	ctx: QueryCtx,
	args: { siteId: IdOfSite; from: number; to: number },
	dimension: string,
	key: string,
) {
	return await ctx.db
		.query("rollupShards")
		.withIndex("by_site_interval_dimension_key_bucket", (q) =>
			q
				.eq("siteId", args.siteId)
				.eq("interval", "hour")
				.eq("dimension", dimension)
				.eq("key", key)
				.gte("bucketStart", floorToBucket(args.from, hourMs))
				.lt("bucketStart", args.to),
		)
		.take(2000 * rollupShardCount);
}

export async function queryDailyRollups(
	ctx: QueryCtx,
	args: { siteId: IdOfSite; from: number; to: number },
	dimension: string,
	key: string,
) {
	return await ctx.db
		.query("rollupShards")
		.withIndex("by_site_interval_dimension_key_bucket", (q) =>
			q
				.eq("siteId", args.siteId)
				.eq("interval", "day")
				.eq("dimension", dimension)
				.eq("key", key)
				.gte("bucketStart", floorToBucket(args.from, dayMs))
				.lt("bucketStart", args.to),
		)
		.take(1000 * rollupShardCount);
}

export async function topDimension(
	ctx: QueryCtx,
	args: { siteId: IdOfSite; from: number; to: number },
	dimension: string,
	limit: number,
) {
	const rows = await ctx.db
		.query("rollupShards")
		.withIndex("by_site_interval_dimension_bucket", (q) =>
			q
				.eq("siteId", args.siteId)
				.eq("interval", "day")
				.eq("dimension", dimension)
				.gte("bucketStart", floorToBucket(args.from, dayMs))
				.lt("bucketStart", args.to),
		)
		.take(5000 * rollupShardCount);
	const byKey = new Map<string, { count: number; pageviewCount: number }>();
	for (const row of rows) {
		const current = byKey.get(row.key) ?? { count: 0, pageviewCount: 0 };
		current.count += row.count;
		current.pageviewCount += row.pageviewCount;
		byKey.set(row.key, current);
	}

	return [...byKey.entries()]
		.map(([key, value]) => ({ key, ...value }))
		.sort((left, right) => right.count - left.count)
		.slice(0, Math.min(limit, 100));
}
