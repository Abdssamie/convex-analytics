import { mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	contextValidator,
	eventInputValidator,
	propertiesValidator,
} from "./types";
import type { IdOfSite } from "./types";
import {
	maxBatchSize,
	aggregationBatchLimit,
	hourMs,
	dayMs,
} from "./constants";
import {
	normalizeEventName,
	sanitizeProperties,
	floorToBucket,
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
				device: args.context?.device,
				browser: args.context?.browser,
				os: args.context?.os,
				country: args.context?.country,
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

export async function aggregateEventsByIds(
	ctx: MutationCtx,
	eventIds: Array<Id<"events">>,
) {
	let aggregated = 0;
	let skipped = 0;
	let failed = 0;
	const now = Date.now();
	const rollupDeltas = new Map<string, RollupDelta>();
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
			await upsertVisitorRecord(ctx, {
				siteId: event.siteId,
				visitorId: event.visitorId,
				seenAt: event.occurredAt,
				identifiedUserId: event.identifiedUserId,
				traits:
					event.eventType === "identify" ? event.properties : undefined,
			});
			await upsertSessionRecord(ctx, {
				siteId: event.siteId,
				sessionId: event.sessionId,
				visitorId: event.visitorId,
				occurredAt: event.occurredAt,
				path: event.path,
				referrer: event.referrer,
				device: event.device,
				browser: event.browser,
				os: event.os,
				country: event.country,
				utmSource: event.utmSource,
				utmMedium: event.utmMedium,
				utmCampaign: event.utmCampaign,
				identifiedUserId: event.identifiedUserId,
				eventType: event.eventType,
				sessionTimeoutMs: site.settings.sessionTimeoutMs,
			});
			accumulateRollups(rollupDeltas, {
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
			});
			await ctx.db.patch(event._id, {
				aggregatedAt: now,
			});
			aggregated += 1;
		} catch (error) {
			failed += 1;
		}
	}
	await flushRollups(ctx, rollupDeltas);

	return { aggregated, skipped, failed };
}

export const upsertVisitor = internalMutation({
	args: {
		siteId: v.id("sites"),
		visitorId: v.string(),
		seenAt: v.number(),
		identifiedUserId: v.optional(v.string()),
		traits: propertiesValidator,
	},
	returns: v.object({
		created: v.boolean(),
	}),
	handler: async (ctx, args) => {
		return await upsertVisitorRecord(ctx, args);
	},
});

export async function upsertVisitorRecord(
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
		return { created: false };
	}

	await ctx.db.insert("visitors", {
		siteId: args.siteId,
		visitorId: args.visitorId,
		firstSeenAt: args.seenAt,
		lastSeenAt: args.seenAt,
		identifiedUserId: args.identifiedUserId,
		traits: args.traits,
	});
	return { created: true };
}

export const upsertSession = internalMutation({
	args: {
		siteId: v.id("sites"),
		sessionId: v.string(),
		visitorId: v.string(),
		occurredAt: v.number(),
		path: v.optional(v.string()),
		referrer: v.optional(v.string()),
		device: v.optional(v.string()),
		browser: v.optional(v.string()),
		os: v.optional(v.string()),
		country: v.optional(v.string()),
		utmSource: v.optional(v.string()),
		utmMedium: v.optional(v.string()),
		utmCampaign: v.optional(v.string()),
		identifiedUserId: v.optional(v.string()),
		eventType: v.union(
			v.literal("pageview"),
			v.literal("track"),
			v.literal("identify"),
		),
		sessionTimeoutMs: v.number(),
	},
	returns: v.object({
		created: v.boolean(),
	}),
	handler: async (ctx, args) => {
		return await upsertSessionRecord(ctx, args);
	},
});

export async function upsertSessionRecord(
	ctx: MutationCtx,
	args: {
		siteId: IdOfSite;
		sessionId: string;
		visitorId: string;
		occurredAt: number;
		path?: string;
		referrer?: string;
		device?: string;
		browser?: string;
		os?: string;
		country?: string;
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
		await ctx.db.insert("sessions", {
			siteId: args.siteId,
			visitorId: args.visitorId,
			sessionId: args.sessionId,
			startedAt: args.occurredAt,
			lastSeenAt: args.occurredAt,
			entryPath: args.path,
			exitPath: args.path,
			referrer: args.referrer,
			device: args.device,
			browser: args.browser,
			os: args.os,
			country: args.country,
			utmSource: args.utmSource,
			utmMedium: args.utmMedium,
			utmCampaign: args.utmCampaign,
			identifiedUserId: args.identifiedUserId,
			pageviewCount: pageviewIncrement,
		});
		return { created: true };
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
		device: existing.device ?? args.device,
		browser: existing.browser ?? args.browser,
		os: existing.os ?? args.os,
		country: existing.country ?? args.country,
		utmSource: existing.utmSource ?? args.utmSource,
		utmMedium: existing.utmMedium ?? args.utmMedium,
		utmCampaign: existing.utmCampaign ?? args.utmCampaign,
		identifiedUserId: args.identifiedUserId ?? existing.identifiedUserId,
		pageviewCount: nextPageviewCount,
	});
	return { created: false };
}

type RollupInput = {
	siteId: IdOfSite;
	occurredAt: number;
	eventName: string;
	eventType: "pageview" | "track" | "identify";
	path?: string;
	referrer?: string;
	device?: string;
	browser?: string;
	os?: string;
	country?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
	receivedAt: number;
};

type RollupDelta = {
	siteId: IdOfSite;
	interval: "hour" | "day";
	bucketStart: number;
	dimension: string;
	key: string;
	count: number;
	pageviewCount: number;
	updatedAt: number;
};

export function accumulateRollups(
	deltas: Map<string, RollupDelta>,
	args: RollupInput,
) {
	const dimensions = [
		{ dimension: "overview", key: "all" },
		{ dimension: "event", key: args.eventName },
		args.eventType === "pageview" && args.path
			? { dimension: "page", key: args.path }
			: null,
		args.referrer ? { dimension: "referrer", key: args.referrer } : null,
		args.device ? { dimension: "device", key: args.device } : null,
		args.browser ? { dimension: "browser", key: args.browser } : null,
		args.os ? { dimension: "os", key: args.os } : null,
		args.country ? { dimension: "country", key: args.country } : null,
		args.utmSource ? { dimension: "utmSource", key: args.utmSource } : null,
		args.utmMedium ? { dimension: "utmMedium", key: args.utmMedium } : null,
		args.utmCampaign
			? { dimension: "utmCampaign", key: args.utmCampaign }
			: null,
	].filter((item): item is { dimension: string; key: string } => item !== null);
	const pageviewIncrement = args.eventType === "pageview" ? 1 : 0;
	for (const item of dimensions) {
		mergeRollupDelta(deltas, {
			siteId: args.siteId,
			interval: "hour",
			bucketStart: floorToBucket(args.occurredAt, hourMs),
			dimension: item.dimension,
			key: item.key,
			count: 1,
			pageviewCount: pageviewIncrement,
			updatedAt: args.receivedAt,
		});
		mergeRollupDelta(deltas, {
			siteId: args.siteId,
			interval: "day",
			bucketStart: floorToBucket(args.occurredAt, dayMs),
			dimension: item.dimension,
			key: item.key,
			count: 1,
			pageviewCount: pageviewIncrement,
			updatedAt: args.receivedAt,
		});
	}
}

export function mergeRollupDelta(
	deltas: Map<string, RollupDelta>,
	args: RollupDelta,
) {
	const mapKey = [
		args.siteId,
		args.interval,
		args.bucketStart,
		args.dimension,
		args.key,
	].join("|");
	const existing = deltas.get(mapKey);
	if (!existing) {
		deltas.set(mapKey, args);
		return;
	}
	existing.count += args.count;
	existing.pageviewCount += args.pageviewCount;
	existing.updatedAt = Math.max(existing.updatedAt, args.updatedAt);
}

export async function flushRollups(
	ctx: MutationCtx,
	deltas: Map<string, RollupDelta>,
) {
	for (const args of deltas.values()) {
		const existing = await ctx.db
		.query("rollups")
		.withIndex("by_site_interval_dimension_key_bucket", (q) =>
			q
				.eq("siteId", args.siteId)
				.eq("interval", args.interval)
				.eq("dimension", args.dimension)
				.eq("key", args.key)
				.eq("bucketStart", args.bucketStart),
		)
		.unique();
		if (!existing) {
			await ctx.db.insert("rollups", {
				siteId: args.siteId,
				interval: args.interval,
				bucketStart: args.bucketStart,
				dimension: args.dimension,
				key: args.key,
				count: args.count,
				pageviewCount: args.pageviewCount,
				bounceCount: 0,
				durationMs: 0,
				updatedAt: args.updatedAt,
			});
			continue;
		}

		await ctx.db.patch(existing._id, {
			count: existing.count + args.count,
			pageviewCount: existing.pageviewCount + args.pageviewCount,
			updatedAt: Math.max(existing.updatedAt, args.updatedAt),
		});
	}
}
