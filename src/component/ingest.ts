import { mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { contextValidator, eventInputValidator } from "./types";
import type { IdOfSite } from "./types";
import {
	maxBatchSize,
	defaultSettings,
	aggregationBatchLimit,
	hourMs,
	dayMs,
} from "./constants";
import {
	normalizeEventName,
	sanitizeProperties,
	floorToBucket,
	shardForEvent,
} from "./helpers";

export const ingestBatch = mutation({
	args: {
		writeKeyHash: v.string(),
		origin: v.optional(v.string()),
		visitorId: v.string(),
		sessionId: v.string(),
		context: contextValidator,
		events: v.array(eventInputValidator),
	},
	returns: v.object({
		accepted: v.number(),
		rejected: v.number(),
	}),
	handler: async (ctx, args) => {
		if (args.events.length === 0) {
			return { accepted: 0, rejected: 0 };
		}
		if (args.events.length > maxBatchSize) {
			throw new Error(`Batch too large. Max ${maxBatchSize} events.`);
		}

		const site = await ctx.db
			.query("sites")
			.withIndex("by_writeKeyHash", (q) =>
				q.eq("writeKeyHash", args.writeKeyHash),
			)
			.unique();
		if (!site || site.status !== "active") {
			throw new Error("Invalid analytics write key");
		}
		if (
			args.origin &&
			site.allowedOrigins.length > 0 &&
			!site.allowedOrigins.includes(args.origin)
		) {
			throw new Error("Origin not allowed");
		}

		const receivedAt = Date.now();
		let accepted = 0;
		let rejected = 0;
		let identifiedUserId: string | undefined;
		const insertedEventIds: Array<Id<"events">> = [];

		for (const event of args.events) {
			const occurredAt = event.occurredAt ?? receivedAt;
			const eventName = normalizeEventName(event);
			if (!eventName) {
				rejected += 1;
				continue;
			}

			const properties = sanitizeProperties(event.properties, site.settings);
			if (event.type === "identify" && event.userId) {
				identifiedUserId = event.userId;
			}

			const eventDbId = await ctx.db.insert("events", {
				siteId: site._id,
				receivedAt,
				occurredAt,
				visitorId: args.visitorId,
				sessionId: args.sessionId,
				eventType: event.type,
				eventName,
				path: event.path,
				title: event.title,
				referrer: event.referrer,
				source: args.context?.source,
				utmSource: args.context?.utmSource,
				utmMedium: args.context?.utmMedium,
				utmCampaign: args.context?.utmCampaign,
				properties,
				identifiedUserId,
				aggregatedAt: null,
			});
			insertedEventIds.push(eventDbId);

			accepted += 1;
		}


		if (insertedEventIds.length > 0) {
			await ctx.scheduler.runAfter(0, internal.ingest.reducePendingSiteEvents, {
				siteId: site._id,
			});
		}

		return { accepted, rejected };
	},
});

export const reducePendingSiteEvents = internalMutation({
	args: {
		siteId: v.id("sites"),
	},
	returns: v.object({
		aggregated: v.number(),
		skipped: v.number(),
		failed: v.number(),
		hasMore: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const pendingEvents = await ctx.db
			.query("events")
			.withIndex("by_siteId_and_aggregatedAt_and_occurredAt", (q) =>
				q.eq("siteId", args.siteId).eq("aggregatedAt", null),
			)
			.take(aggregationBatchLimit + 1);
		const eventIds = pendingEvents
			.slice(0, aggregationBatchLimit)
			.map((event) => event._id);
		const result = await aggregateEventsByIds(ctx, eventIds);
		const hasMore = pendingEvents.length > aggregationBatchLimit;
		if (hasMore) {
			await ctx.scheduler.runAfter(0, internal.ingest.reducePendingSiteEvents, {
				siteId: args.siteId,
			});
		}
		return {
			...result,
			hasMore,
		};
	},
});

export const aggregateEventBatch = internalMutation({
	args: {
		eventIds: v.array(v.id("events")),
	},
	returns: v.object({
		aggregated: v.number(),
		skipped: v.number(),
		failed: v.number(),
	}),
	handler: async (ctx, args) => {
		return await aggregateEventsByIds(ctx, args.eventIds);
	},
});

export async function aggregateEventsByIds(
	ctx: MutationCtx,
	eventIds: Array<Id<"events">>,
) {
	let aggregated = 0;
	let skipped = 0;
	let failed = 0;
	const now = Date.now();
	const rollupDeltas = new Map<string, RollupShardDelta>();
	for (const eventId of eventIds.slice(0, aggregationBatchLimit)) {
		const event = await ctx.db.get(eventId);
		if (!event || event.aggregatedAt !== null) {
			skipped += 1;
			continue;
		}
		try {
			const site = await ctx.db.get(event.siteId);
			if (!site) {
				throw new Error("Site not found");
			}
			const visitor = await upsertVisitor(ctx, {
				siteId: event.siteId,
				visitorId: event.visitorId,
				seenAt: event.occurredAt,
				identifiedUserId: event.identifiedUserId,
				traits:
					event.eventType === "identify" ? event.properties : undefined,
			});
			const session = await upsertSession(ctx, {
				siteId: event.siteId,
				sessionId: event.sessionId,
				visitorId: event.visitorId,
				occurredAt: event.occurredAt,
				path: event.path,
				referrer: event.referrer,
				utmSource: event.utmSource,
				utmMedium: event.utmMedium,
				utmCampaign: event.utmCampaign,
				identifiedUserId: event.identifiedUserId ?? visitor.identifiedUserId,
				eventType: event.eventType,
				sessionTimeoutMs: site.settings.sessionTimeoutMs,
			});
			accumulateRollupShards(rollupDeltas, {
				siteId: event.siteId,
				occurredAt: event.occurredAt,
				eventName: event.eventName,
				eventType: event.eventType,
				path: event.path,
				referrer: event.referrer,
				utmSource: event.utmSource,
				utmMedium: event.utmMedium,
				utmCampaign: event.utmCampaign,
				receivedAt: now,
				newSession: session.created,
				newVisitor: visitor.created,
				shard: shardForEvent(
					event._id,
					site.settings.rollupShardCount ?? defaultSettings.rollupShardCount,
				),
			});
			await ctx.db.patch(event._id, {
				aggregatedAt: now,
			});
			aggregated += 1;
		} catch (error) {
			failed += 1;
		}
	}
	await flushRollupShards(ctx, rollupDeltas);

	return { aggregated, skipped, failed };
}

export async function upsertVisitor(
	ctx: MutationCtx,
	args: {
		siteId: IdOfSite;
		visitorId: string;
		seenAt: number;
		identifiedUserId?: string;
		traits?: Record<string, string | number | boolean | null>;
	},
	) {
	const existing = await ctx.db
		.query("visitors")
		.withIndex("by_siteId_and_visitorId", (q) =>
			q.eq("siteId", args.siteId).eq("visitorId", args.visitorId),
		)
		.unique();
	if (existing) {
		const firstSeenAt = Math.min(existing.firstSeenAt, args.seenAt);
		const lastSeenAt = Math.max(existing.lastSeenAt, args.seenAt);
		await ctx.db.patch(existing._id, {
			firstSeenAt,
			lastSeenAt,
			identifiedUserId: args.identifiedUserId ?? existing.identifiedUserId,
			traits: args.traits ?? existing.traits,
		});
		return {
			...(await ctx.db.get(existing._id))!,
			created: false,
		};
	}

	const id = await ctx.db.insert("visitors", {
		siteId: args.siteId,
		visitorId: args.visitorId,
		firstSeenAt: args.seenAt,
		lastSeenAt: args.seenAt,
		identifiedUserId: args.identifiedUserId,
		traits: args.traits,
	});
	return {
		...(await ctx.db.get(id))!,
		created: true,
	};
}

export async function upsertSession(
	ctx: MutationCtx,
	args: {
		siteId: IdOfSite;
		sessionId: string;
		visitorId: string;
		occurredAt: number;
		path?: string;
		referrer?: string;
		utmSource?: string;
		utmMedium?: string;
		utmCampaign?: string;
		identifiedUserId?: string;
		eventType: "pageview" | "track" | "identify";
		sessionTimeoutMs: number;
	},
) {
	const existing = await ctx.db
		.query("sessions")
		.withIndex("by_siteId_and_sessionId_and_startedAt", (q) =>
			q.eq("siteId", args.siteId).eq("sessionId", args.sessionId),
		)
		.order("desc")
		.first();
	const pageviewIncrement = args.eventType === "pageview" ? 1 : 0;
	const isNewSession =
		!existing ||
		args.occurredAt - existing.lastSeenAt > args.sessionTimeoutMs;
	if (isNewSession) {
		const id = await ctx.db.insert("sessions", {
			siteId: args.siteId,
			visitorId: args.visitorId,
			sessionId: args.sessionId,
			startedAt: args.occurredAt,
			lastSeenAt: args.occurredAt,
			entryPath: args.path,
			exitPath: args.path,
			referrer: args.referrer,
			utmSource: args.utmSource,
			utmMedium: args.utmMedium,
			utmCampaign: args.utmCampaign,
			identifiedUserId: args.identifiedUserId,
			pageviewCount: pageviewIncrement,
		});
		return {
			...(await ctx.db.get(id))!,
			created: true,
		};
	}

	const startedAt = Math.min(existing.startedAt, args.occurredAt);
	const lastSeenAt = Math.max(existing.lastSeenAt, args.occurredAt);
	const nextPageviewCount = existing.pageviewCount + pageviewIncrement;
	await ctx.db.patch(existing._id, {
		visitorId: args.visitorId,
		startedAt,
		lastSeenAt,
		entryPath:
			args.occurredAt < existing.startedAt && args.path
				? args.path
				: existing.entryPath,
		exitPath:
			args.path && args.occurredAt >= existing.lastSeenAt
				? args.path
				: existing.exitPath,
		referrer: existing.referrer ?? args.referrer,
		utmSource: existing.utmSource ?? args.utmSource,
		utmMedium: existing.utmMedium ?? args.utmMedium,
		utmCampaign: existing.utmCampaign ?? args.utmCampaign,
		identifiedUserId: args.identifiedUserId ?? existing.identifiedUserId,
		pageviewCount: nextPageviewCount,
	});
	return {
		...(await ctx.db.get(existing._id))!,
		created: false,
	};
}

type RollupShardInput = {
	siteId: IdOfSite;
	occurredAt: number;
	eventName: string;
	eventType: "pageview" | "track" | "identify";
	path?: string;
	referrer?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
	receivedAt: number;
	newVisitor: boolean;
	newSession: boolean;
	shard: number;
};

type RollupShardDelta = {
	siteId: IdOfSite;
	interval: "hour" | "day";
	bucketStart: number;
	dimension: string;
	key: string;
	shard: number;
	count: number;
	uniqueVisitorCount: number;
	sessionCount: number;
	pageviewCount: number;
	updatedAt: number;
};

export function accumulateRollupShards(
	deltas: Map<string, RollupShardDelta>,
	args: RollupShardInput,
) {
	const dimensions = [
		{ dimension: "overview", key: "all" },
		{ dimension: "event", key: args.eventName },
		args.eventType === "pageview" && args.path
			? { dimension: "page", key: args.path }
			: null,
		args.referrer ? { dimension: "referrer", key: args.referrer } : null,
		args.utmSource ? { dimension: "utmSource", key: args.utmSource } : null,
		args.utmMedium ? { dimension: "utmMedium", key: args.utmMedium } : null,
		args.utmCampaign
			? { dimension: "utmCampaign", key: args.utmCampaign }
			: null,
	].filter((item): item is { dimension: string; key: string } => item !== null);
	const pageviewIncrement = args.eventType === "pageview" ? 1 : 0;
	for (const item of dimensions) {
		mergeRollupShardDelta(deltas, {
			siteId: args.siteId,
			interval: "hour",
			bucketStart: floorToBucket(args.occurredAt, hourMs),
			dimension: item.dimension,
			key: item.key,
			shard: args.shard,
			count: 1,
			uniqueVisitorCount: args.newVisitor ? 1 : 0,
			sessionCount: args.newSession ? 1 : 0,
			pageviewCount: pageviewIncrement,
			updatedAt: args.receivedAt,
		});
		mergeRollupShardDelta(deltas, {
			siteId: args.siteId,
			interval: "day",
			bucketStart: floorToBucket(args.occurredAt, dayMs),
			dimension: item.dimension,
			key: item.key,
			shard: args.shard,
			count: 1,
			uniqueVisitorCount: args.newVisitor ? 1 : 0,
			sessionCount: args.newSession ? 1 : 0,
			pageviewCount: pageviewIncrement,
			updatedAt: args.receivedAt,
		});
	}
}

export function mergeRollupShardDelta(
	deltas: Map<string, RollupShardDelta>,
	args: RollupShardDelta,
) {
	const mapKey = [
		args.siteId,
		args.interval,
		args.bucketStart,
		args.dimension,
		args.key,
		args.shard,
	].join("|");
	const existing = deltas.get(mapKey);
	if (!existing) {
		deltas.set(mapKey, args);
		return;
	}
	existing.count += args.count;
	existing.uniqueVisitorCount += args.uniqueVisitorCount;
	existing.sessionCount += args.sessionCount;
	existing.pageviewCount += args.pageviewCount;
	existing.updatedAt = Math.max(existing.updatedAt, args.updatedAt);
}

export async function flushRollupShards(
	ctx: MutationCtx,
	deltas: Map<string, RollupShardDelta>,
) {
	for (const args of deltas.values()) {
	const existing = await ctx.db
		.query("rollupShards")
		.withIndex("by_site_interval_dimension_key_bucket_shard", (q) =>
			q
				.eq("siteId", args.siteId)
				.eq("interval", args.interval)
				.eq("dimension", args.dimension)
				.eq("key", args.key)
				.eq("bucketStart", args.bucketStart)
				.eq("shard", args.shard),
		)
		.unique();
		if (!existing) {
			await ctx.db.insert("rollupShards", {
				siteId: args.siteId,
				interval: args.interval,
				bucketStart: args.bucketStart,
				dimension: args.dimension,
				key: args.key,
				shard: args.shard,
				count: args.count,
				uniqueVisitorCount: args.uniqueVisitorCount,
				sessionCount: args.sessionCount,
				pageviewCount: args.pageviewCount,
				bounceCount: 0,
				durationMs: 0,
				updatedAt: args.updatedAt,
			});
			continue;
		}

		await ctx.db.patch(existing._id, {
			count: existing.count + args.count,
			uniqueVisitorCount:
				existing.uniqueVisitorCount + args.uniqueVisitorCount,
			sessionCount: existing.sessionCount + args.sessionCount,
			pageviewCount: existing.pageviewCount + args.pageviewCount,
			updatedAt: Math.max(existing.updatedAt, args.updatedAt),
		});
	}
}
