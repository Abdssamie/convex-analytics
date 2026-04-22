import { action, internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { IdOfSite } from "./types";
import { cleanupBatchLimit } from "./constants";
import { daysToMs, deleteRows } from "./helpers";
import { siteValidator } from "./types";

const cleanupPageSize = 100;

export const cleanupSite = action({
	args: {
		siteId: v.optional(v.id("sites")),
		slug: v.optional(v.string()),
		now: v.optional(v.number()),
		limit: v.optional(v.number()),
		runUntilComplete: v.optional(v.boolean()),
	},
	returns: v.object({
		events: v.number(),
		hourlyRollupShards: v.number(),
		dailyRollupShards: v.number(),
		hasMore: v.boolean(),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		events: number;
		hourlyRollupShards: number;
		dailyRollupShards: number;
		hasMore: boolean;
	}> => {
		const site: {
			_id: IdOfSite;
			settings: {
				retentionDays: number;
				rawEventRetentionDays?: number;
				hourlyRollupRetentionDays?: number;
				dailyRollupRetentionDays?: number;
			};
		} = await ctx.runQuery(internal.maintenance.resolveSiteForCleanup, {
			siteId: args.siteId,
			slug: args.slug,
		});
		const now = args.now ?? Date.now();
		const limit = Math.max(
			1,
			Math.min(args.limit ?? cleanupBatchLimit, 500),
		);
		const runUntilComplete = args.runUntilComplete ?? true;
		const rawEventCutoff =
			now -
			daysToMs(
				site.settings.rawEventRetentionDays ?? site.settings.retentionDays,
			);
		const hourlyRollupCutoff =
			now -
			daysToMs(
				site.settings.hourlyRollupRetentionDays ?? site.settings.retentionDays,
			);
		const dailyRollupCutoff =
			site.settings.dailyRollupRetentionDays === undefined
				? null
				: now - daysToMs(site.settings.dailyRollupRetentionDays);

		const events = await deleteEventsBudget(ctx, {
			siteId: site._id,
			cutoff: rawEventCutoff,
			limit,
		});
		const hourlyBudget = Math.max(0, limit - events.deleted);
		const hourlyRollupShards = await deleteRollupShardsBudget(ctx, {
			siteId: site._id,
			interval: "hour",
			cutoff: hourlyRollupCutoff,
			limit: hourlyBudget,
		});
		const dailyBudget = Math.max(
			0,
			limit - events.deleted - hourlyRollupShards.deleted,
		);
		const dailyRollupShards: { deleted: number; hasMore: boolean } =
			dailyRollupCutoff === null
				? { deleted: 0, hasMore: false }
				: await deleteRollupShardsBudget(ctx, {
						siteId: site._id,
						interval: "day",
						cutoff: dailyRollupCutoff,
						limit: dailyBudget,
					});

		const hasMore =
			events.hasMore || hourlyRollupShards.hasMore || dailyRollupShards.hasMore;
		if (hasMore && runUntilComplete) {
			await ctx.scheduler.runAfter(0, api.maintenance.cleanupSite, {
				siteId: site._id,
				now,
				limit,
				runUntilComplete: true,
			});
		}

		return {
			events: events.deleted,
			hourlyRollupShards: hourlyRollupShards.deleted,
			dailyRollupShards: dailyRollupShards.deleted,
			hasMore,
		};
	},
});

export const resolveSiteForCleanup = internalQuery({
	args: {
		siteId: v.optional(v.id("sites")),
		slug: v.optional(v.string()),
	},
	returns: siteValidator,
	handler: async (ctx, args) => {
		if (args.siteId) {
			const site = await ctx.db.get(args.siteId);
			if (!site) {
				throw new Error("Site not found");
			}
			return site;
		}

		if (args.slug) {
			const site = await ctx.db
				.query("sites")
				.withIndex("by_slug", (q) => q.eq("slug", args.slug!))
				.unique();
			if (!site) {
				throw new Error("Site not found");
			}
			return site;
		}

		throw new Error("siteId or slug is required");
	},
});

export const deleteEventsPage = internalMutation({
	args: {
		siteId: v.id("sites"),
		cutoff: v.number(),
		cursor: v.union(v.string(), v.null()),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		deleted: v.number(),
		continueCursor: v.union(v.string(), v.null()),
		isDone: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query("events")
			.withIndex("by_siteId_and_occurredAt", (q) =>
				q.eq("siteId", args.siteId).lt("occurredAt", args.cutoff),
			)
			.paginate({
				numItems: Math.max(
					1,
					Math.min(args.limit ?? cleanupPageSize, cleanupPageSize),
				),
				cursor: args.cursor,
			});
		await deleteRows(ctx, page.page);
		return {
			deleted: page.page.length,
			continueCursor: page.isDone ? null : page.continueCursor,
			isDone: page.isDone,
		};
	},
});

export const deleteRollupShardsPage = internalMutation({
	args: {
		siteId: v.id("sites"),
		interval: v.union(v.literal("hour"), v.literal("day")),
		cutoff: v.number(),
		cursor: v.union(v.string(), v.null()),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		deleted: v.number(),
		continueCursor: v.union(v.string(), v.null()),
		isDone: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query("rollupShards")
			.withIndex("by_site_interval_bucket", (q) =>
				q
					.eq("siteId", args.siteId)
					.eq("interval", args.interval)
					.lt("bucketStart", args.cutoff),
			)
			.paginate({
				numItems: Math.max(
					1,
					Math.min(args.limit ?? cleanupPageSize, cleanupPageSize),
				),
				cursor: args.cursor,
			});
		await deleteRows(ctx, page.page);
		return {
			deleted: page.page.length,
			continueCursor: page.isDone ? null : page.continueCursor,
			isDone: page.isDone,
		};
	},
});

async function deleteEventsBudget(
	ctx: ActionCtx,
	args: {
		siteId: IdOfSite;
		cutoff: number;
		limit: number;
	},
) {
	let deleted = 0;
	let cursor: string | null = null;
	if (args.limit <= 0) {
		return { deleted: 0, hasMore: false };
	}
	while (true) {
		const remaining = args.limit - deleted;
		if (remaining <= 0) {
			return { deleted, hasMore: true };
		}
		const page: {
			deleted: number;
			continueCursor: string | null;
			isDone: boolean;
		} = await ctx.runMutation(internal.maintenance.deleteEventsPage, {
			siteId: args.siteId,
			cutoff: args.cutoff,
			cursor,
			limit: remaining,
		});
		deleted += page.deleted;
		if (page.isDone) {
			return { deleted, hasMore: false };
		}
		cursor = page.continueCursor;
	}
}

async function deleteRollupShardsBudget(
	ctx: ActionCtx,
	args: {
		siteId: IdOfSite;
		interval: "hour" | "day";
		cutoff: number;
		limit: number;
	},
) {
	let deleted = 0;
	let cursor: string | null = null;
	if (args.limit <= 0) {
		return { deleted: 0, hasMore: false };
	}
	while (true) {
		const remaining = args.limit - deleted;
		if (remaining <= 0) {
			return { deleted, hasMore: true };
		}
		const page: {
			deleted: number;
			continueCursor: string | null;
			isDone: boolean;
		} = await ctx.runMutation(
			internal.maintenance.deleteRollupShardsPage,
			{
				siteId: args.siteId,
				interval: args.interval,
				cutoff: args.cutoff,
				cursor,
				limit: remaining,
			},
		);
		deleted += page.deleted;
		if (page.isDone) {
			return { deleted, hasMore: false };
		}
		cursor = page.continueCursor;
	}
}

export async function deleteEventsBefore(
	ctx: MutationCtx,
	args: { siteId: IdOfSite; cutoff: number; limit: number },
) {
	const rows = await ctx.db
		.query("events")
		.withIndex("by_siteId_and_occurredAt", (q) =>
			q.eq("siteId", args.siteId).lt("occurredAt", args.cutoff),
		)
		.take(args.limit);
	await deleteRows(ctx, rows);
	return rows.length;
}

export async function deleteRollupShardsBefore(
	ctx: MutationCtx,
	args: {
		siteId: IdOfSite;
		interval: "hour" | "day";
		cutoff: number;
		limit: number;
	},
) {
	const rows = await ctx.db
		.query("rollupShards")
		.withIndex("by_site_interval_bucket", (q) =>
			q
				.eq("siteId", args.siteId)
				.eq("interval", args.interval)
				.lt("bucketStart", args.cutoff),
		)
		.take(args.limit);
	await deleteRows(ctx, rows);
	return rows.length;
}
