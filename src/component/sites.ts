import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { siteSettingsFromArgs } from "./helpers";
import { siteValidator } from "./types";

export const createSite = mutation({
	args: {
		slug: v.string(),
		name: v.string(),
		writeKeyHash: v.string(),
		allowedOrigins: v.optional(v.array(v.string())),
		sessionTimeoutMs: v.optional(v.number()),
		retentionDays: v.optional(v.number()),
		rawEventRetentionDays: v.optional(v.number()),
		hourlyRollupRetentionDays: v.optional(v.number()),
		dailyRollupRetentionDays: v.optional(v.number()),
		allowedPropertyKeys: v.optional(v.array(v.string())),
		deniedPropertyKeys: v.optional(v.array(v.string())),
	},
	returns: v.id("sites"),
	handler: async (ctx, args) => {
		const now = Date.now();
		const existing = await ctx.db
			.query("sites")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (existing) {
			throw new Error(`Site slug already exists: ${args.slug}`);
		}
		return await ctx.db.insert("sites", {
			slug: args.slug,
			name: args.name,
			status: "active",
			writeKeyHash: args.writeKeyHash,
			allowedOrigins: args.allowedOrigins ?? [],
			settings: siteSettingsFromArgs(args),
			createdAt: now,
			updatedAt: now,
		});
	},
});
export const updateSite = mutation({
	args: {
		siteId: v.id("sites"),
		name: v.optional(v.string()),
		status: v.optional(v.union(v.literal("active"), v.literal("disabled"))),
		allowedOrigins: v.optional(v.array(v.string())),
		sessionTimeoutMs: v.optional(v.number()),
		retentionDays: v.optional(v.number()),
		rawEventRetentionDays: v.optional(v.number()),
		hourlyRollupRetentionDays: v.optional(v.number()),
		dailyRollupRetentionDays: v.optional(v.number()),
		allowedPropertyKeys: v.optional(v.array(v.string())),
		deniedPropertyKeys: v.optional(v.array(v.string())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const site = await ctx.db.get(args.siteId);
		if (!site) {
			throw new Error("Site not found");
		}
		await ctx.db.patch(args.siteId, {
			name: args.name ?? site.name,
			status: args.status ?? site.status,
			allowedOrigins: args.allowedOrigins ?? site.allowedOrigins,
			settings: siteSettingsFromArgs(args, site.settings),
			updatedAt: Date.now(),
		});
		return null;
	},
});
export const rotateWriteKey = mutation({
	args: {
		siteId: v.id("sites"),
		writeKeyHash: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.siteId, {
			writeKeyHash: args.writeKeyHash,
			updatedAt: Date.now(),
		});
		return null;
	},
});
export const getSiteBySlug = query({
	args: { slug: v.string() },
	returns: v.union(v.null(), siteValidator),
	handler: async (ctx, args) => {
		return await ctx.db
			.query("sites")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
	},
});
