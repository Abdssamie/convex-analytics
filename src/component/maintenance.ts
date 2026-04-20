import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { IdOfSite } from "./types";
import { cleanupBatchLimit } from "./constants";
import { resolveSite, daysToMs, deleteRows } from "./helpers";

export const pruneExpired = mutation({
	args: {
		now: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const now = args.now ?? Date.now();
		const rows = await ctx.db
			.query("ingestDedupes")
			.withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
			.take(Math.min(args.limit ?? 100, 500));
		let deleted = 0;
		for (const row of rows) {
			await ctx.db.delete(row._id);
			deleted += 1;
		}
		return deleted;
	},
});
export const cleanupSite = mutation({
	args: {
		siteId: v.optional(v.id("sites")),
		slug: v.optional(v.string()),
		now: v.optional(v.number()),
		limit: v.optional(v.number()),
		runUntilComplete: v.optional(v.boolean()),
	},
	returns: v.object({
		events: v.number(),
		pageViews: v.number(),
		hourlyRollupShards: v.number(),
		dailyRollupShards: v.number(),
		hasMore: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const site = await resolveSite(ctx, args);
		const now = args.now ?? Date.now();
		const limit = Math.min(args.limit ?? cleanupBatchLimit, 500);
		const rawEventCutoff =
			now -
			daysToMs(
				site.settings.rawEventRetentionDays ?? site.settings.retentionDays,
			);
		const pageViewCutoff =
			now -
			daysToMs(
				site.settings.pageViewRetentionDays ?? site.settings.retentionDays,
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
		const activeCategories = dailyRollupCutoff === null ? 3 : 4;
		const perCategoryLimit = Math.max(1, Math.floor(limit / activeCategories));

		const events = await deleteDoneEventsBefore(ctx, {
			siteId: site._id,
			cutoff: rawEventCutoff,
			limit: perCategoryLimit,
		});
		const pageViews = await deletePageViewsBefore(ctx, {
			siteId: site._id,
			cutoff: pageViewCutoff,
			limit: perCategoryLimit,
		});
		const hourlyRollupShards = await deleteRollupShardsBefore(ctx, {
			siteId: site._id,
			interval: "hour",
			cutoff: hourlyRollupCutoff,
			limit: perCategoryLimit,
		});
		const dailyRollupShards =
			dailyRollupCutoff === null
				? 0
				: await deleteRollupShardsBefore(ctx, {
						siteId: site._id,
						interval: "day",
						cutoff: dailyRollupCutoff,
						limit: perCategoryLimit,
					});

		const hasMore =
			events === perCategoryLimit ||
			pageViews === perCategoryLimit ||
			hourlyRollupShards === perCategoryLimit ||
			dailyRollupShards === perCategoryLimit;
		if (hasMore && args.runUntilComplete) {
			await ctx.scheduler.runAfter(0, api.lib.cleanupSite, {
				siteId: site._id,
				now,
				limit,
				runUntilComplete: true,
			});
		}
		return {
			events,
			pageViews,
			hourlyRollupShards,
			dailyRollupShards,
			hasMore,
		};
	},
});

export async function deleteDoneEventsBefore(
	ctx: MutationCtx,
	args: { siteId: IdOfSite; cutoff: number; limit: number },
) {
	const rows = await ctx.db
		.query("events")
		.withIndex("by_siteId_and_aggregationStatus_and_occurredAt", (q) =>
			q
				.eq("siteId", args.siteId)
				.eq("aggregationStatus", "done")
				.lt("occurredAt", args.cutoff),
		)
		.take(args.limit);
	await deleteRows(ctx, rows);
	return rows.length;
}

export async function deletePageViewsBefore(
	ctx: MutationCtx,
	args: { siteId: IdOfSite; cutoff: number; limit: number },
) {
	const rows = await ctx.db
		.query("pageViews")
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
