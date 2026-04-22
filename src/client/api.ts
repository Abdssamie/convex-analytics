import { actionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { ComponentApi } from "../component/_generated/component";
import type { AuthFn } from "./types";
import { hashWriteKey } from "./helpers";

export function exposeAnalyticsApi(
	component: ComponentApi,
	options: {
		auth: AuthFn;
	},
) {
	const {
		getOverview,
		getTimeseries,
		getTopPages,
		getTopReferrers,
		getTopSources,
		getTopMediums,
		getTopCampaigns,
		getTopEvents,
		listRawEvents,
		listSessions,
	} = exposeApi(component, options);
	return {
		getOverview,
		getTimeseries,
		getTopPages,
		getTopReferrers,
		getTopSources,
		getTopMediums,
		getTopCampaigns,
		getTopEvents,
		listRawEvents,
		listSessions,
	};
}

export function exposeAdminApi(
	component: ComponentApi,
	options: {
		auth: AuthFn;
	},
) {
	const {
		createSite,
		updateSite,
		rotateWriteKey,
		getSiteBySlug,
		cleanupSite,
	} = exposeApi(component, options);
	return {
		createSite,
		updateSite,
		rotateWriteKey,
		getSiteBySlug,
		cleanupSite,
	};
}

export function exposeApi(
	component: ComponentApi,
	options: {
		auth: AuthFn;
	},
) {
	return {
		createSite: mutationGeneric({
			args: {
				slug: v.string(),
				name: v.string(),
				writeKey: v.string(),
				allowedOrigins: v.optional(v.array(v.string())),
				sessionTimeoutMs: v.optional(v.number()),
				retentionDays: v.optional(v.number()),
				rawEventRetentionDays: v.optional(v.number()),
				hourlyRollupRetentionDays: v.optional(v.number()),
				dailyRollupRetentionDays: v.optional(v.number()),
				allowedPropertyKeys: v.optional(v.array(v.string())),
				deniedPropertyKeys: v.optional(v.array(v.string())),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "admin" });
				const {
					writeKey,
					slug,
					name,
					allowedOrigins,
					sessionTimeoutMs,
					retentionDays,
					rawEventRetentionDays,
					hourlyRollupRetentionDays,
					dailyRollupRetentionDays,
					allowedPropertyKeys,
					deniedPropertyKeys,
				} = args;
				return await ctx.runMutation(component.sites.createSite, {
					slug,
					name,
					allowedOrigins,
					sessionTimeoutMs,
					retentionDays,
					rawEventRetentionDays,
					hourlyRollupRetentionDays,
					dailyRollupRetentionDays,
					allowedPropertyKeys,
					deniedPropertyKeys,
					writeKeyHash: await hashWriteKey(writeKey),
				});
			},
		}),
		updateSite: mutationGeneric({
			args: {
				siteId: v.string(),
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
			handler: async (ctx, args) => {
				await options.auth(ctx, {
					type: "admin",
					siteId: args.siteId,
				});
				return await ctx.runMutation(component.sites.updateSite, args);
			},
		}),
		rotateWriteKey: mutationGeneric({
			args: {
				siteId: v.string(),
				writeKey: v.string(),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, {
					type: "admin",
					siteId: args.siteId,
				});
				return await ctx.runMutation(component.sites.rotateWriteKey, {
					siteId: args.siteId,
					writeKeyHash: await hashWriteKey(args.writeKey),
				});
			},
		}),
		getSiteBySlug: queryGeneric({
			args: { slug: v.string() },
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "admin" });
				return await ctx.runQuery(component.sites.getSiteBySlug, args);
			},
		}),
		getOverview: queryGeneric({
			args: { siteId: v.string(), from: v.number(), to: v.number() },
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.getOverview, args);
			},
		}),
		getTimeseries: queryGeneric({
			args: {
				siteId: v.string(),
				from: v.number(),
				to: v.number(),
				interval: v.union(v.literal("hour"), v.literal("day")),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.getTimeseries, args);
			},
		}),
		getTopPages: queryGeneric({
			args: {
				siteId: v.string(),
				from: v.number(),
				to: v.number(),
				limit: v.optional(v.number()),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.getTopPages, args);
			},
		}),
		getTopReferrers: queryGeneric({
			args: {
				siteId: v.string(),
				from: v.number(),
				to: v.number(),
				limit: v.optional(v.number()),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.getTopReferrers, args);
			},
		}),
		getTopSources: queryGeneric({
			args: {
				siteId: v.string(),
				from: v.number(),
				to: v.number(),
				limit: v.optional(v.number()),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.getTopSources, args);
			},
		}),
		getTopMediums: queryGeneric({
			args: {
				siteId: v.string(),
				from: v.number(),
				to: v.number(),
				limit: v.optional(v.number()),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.getTopMediums, args);
			},
		}),
		getTopCampaigns: queryGeneric({
			args: {
				siteId: v.string(),
				from: v.number(),
				to: v.number(),
				limit: v.optional(v.number()),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.getTopCampaigns, args);
			},
		}),
		getTopEvents: queryGeneric({
			args: {
				siteId: v.string(),
				from: v.number(),
				to: v.number(),
				limit: v.optional(v.number()),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.getTopEvents, args);
			},
		}),
		listRawEvents: queryGeneric({
			args: {
				siteId: v.string(),
				from: v.optional(v.number()),
				to: v.optional(v.number()),
				paginationOpts: paginationOptsValidator,
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.listRawEvents, args);
			},
		}),
		listSessions: queryGeneric({
			args: {
				siteId: v.string(),
				from: v.optional(v.number()),
				to: v.optional(v.number()),
				paginationOpts: paginationOptsValidator,
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.listSessions, args);
			},
		}),
		cleanupSite: actionGeneric({
			args: {
				siteId: v.optional(v.string()),
				slug: v.optional(v.string()),
				now: v.optional(v.number()),
				limit: v.optional(v.number()),
				runUntilComplete: v.optional(v.boolean()),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, {
					type: "admin",
					siteId: args.siteId,
				});
				return await ctx.runAction(component.maintenance.cleanupSite, args);
			},
		}),
	};
}
