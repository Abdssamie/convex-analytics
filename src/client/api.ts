import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component";
import type { AuthFn } from "./types";
import { hashWriteKey } from "./helpers";

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
				pageViewRetentionDays: v.optional(v.number()),
				hourlyRollupRetentionDays: v.optional(v.number()),
				dailyRollupRetentionDays: v.optional(v.number()),
				dedupeRetentionMs: v.optional(v.number()),
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
					pageViewRetentionDays,
					hourlyRollupRetentionDays,
					dailyRollupRetentionDays,
					dedupeRetentionMs,
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
					pageViewRetentionDays,
					hourlyRollupRetentionDays,
					dailyRollupRetentionDays,
					dedupeRetentionMs,
					allowedPropertyKeys,
					deniedPropertyKeys,
					writeKeyHash: await hashWriteKey(writeKey),
				});
			},
		}),
		ensureSite: mutationGeneric({
			args: {
				slug: v.string(),
				name: v.string(),
				writeKey: v.string(),
				allowedOrigins: v.optional(v.array(v.string())),
				sessionTimeoutMs: v.optional(v.number()),
				retentionDays: v.optional(v.number()),
				rawEventRetentionDays: v.optional(v.number()),
				pageViewRetentionDays: v.optional(v.number()),
				hourlyRollupRetentionDays: v.optional(v.number()),
				dailyRollupRetentionDays: v.optional(v.number()),
				dedupeRetentionMs: v.optional(v.number()),
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
					pageViewRetentionDays,
					hourlyRollupRetentionDays,
					dailyRollupRetentionDays,
					dedupeRetentionMs,
					allowedPropertyKeys,
					deniedPropertyKeys,
				} = args;
				return await ctx.runMutation(component.sites.ensureSite, {
					slug,
					name,
					allowedOrigins,
					sessionTimeoutMs,
					retentionDays,
					rawEventRetentionDays,
					pageViewRetentionDays,
					hourlyRollupRetentionDays,
					dailyRollupRetentionDays,
					dedupeRetentionMs,
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
				pageViewRetentionDays: v.optional(v.number()),
				hourlyRollupRetentionDays: v.optional(v.number()),
				dailyRollupRetentionDays: v.optional(v.number()),
				dedupeRetentionMs: v.optional(v.number()),
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
		aggregatePending: mutationGeneric({
			args: {
				siteId: v.string(),
				now: v.optional(v.number()),
				limit: v.optional(v.number()),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, {
					type: "admin",
					siteId: args.siteId,
				});
				return await ctx.runMutation(component.ingest.aggregatePending, args);
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
				limit: v.optional(v.number()),
			},
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.listRawEvents, args);
			},
		}),
		listSessions: queryGeneric({
			args: { siteId: v.string(), limit: v.optional(v.number()) },
			handler: async (ctx, args) => {
				await options.auth(ctx, { type: "read", siteId: args.siteId });
				return await ctx.runQuery(component.analytics.listSessions, args);
			},
		}),
	};
}
