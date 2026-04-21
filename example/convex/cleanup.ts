import { components } from "./_generated/api.js";
import { internalAction, internalMutation } from "./_generated/server.js";
import { v } from "convex/values";

export const site = internalAction({
  args: {
    siteId: v.optional(v.string()),
    slug: v.optional(v.string()),
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
    runUntilComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runAction(
      components.convexAnalytics.maintenance.cleanupSite,
      args,
    );
  },
});

export const dedupes = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.convexAnalytics.maintenance.pruneExpired,
      args,
    );
  },
});
