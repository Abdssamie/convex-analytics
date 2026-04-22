import {
	internalAction,
	internalMutation,
	internalQuery,
} from "./_generated/server";
import { v } from "convex/values";

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
	handler: async () => {
		return { compactedPairs: 0, hasMore: false };
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
	handler: async () => {
		return [];
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
	handler: async () => {
		return {
			compactedRows: 0,
			continueCursor: null,
			isDone: true,
		};
	},
});
