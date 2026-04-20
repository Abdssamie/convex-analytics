import { mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
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
	firstPagePath,
	firstReferrer,
	normalizeEventName,
	sanitizeProperties,
	latestIdentifyTraits,
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
		duplicate: v.number(),
		rejected: v.number(),
	}),
	handler: async (ctx, args) => {
		if (args.events.length === 0) {
			return { accepted: 0, duplicate: 0, rejected: 0 };
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
		const firstOccurredAt = args.events[0]?.occurredAt ?? receivedAt;
		const visitor = await upsertVisitor(ctx, {
			siteId: site._id,
			visitorId: args.visitorId,
			seenAt: firstOccurredAt,
		});

		let session = await ctx.db
			.query("sessions")
			.withIndex("by_siteId_and_sessionId", (q) =>
				q.eq("siteId", site._id).eq("sessionId", args.sessionId),
			)
			.unique();
		let newSession = false;
		if (
			!session ||
			firstOccurredAt - session.lastSeenAt > site.settings.sessionTimeoutMs
		) {
			const sessionDbId = await ctx.db.insert("sessions", {
				siteId: site._id,
				visitorId: args.visitorId,
				sessionId: args.sessionId,
				startedAt: firstOccurredAt,
				lastSeenAt: firstOccurredAt,
				entryPath: firstPagePath(args.events),
				exitPath: firstPagePath(args.events),
				referrer: firstReferrer(args.events),
				utmSource: args.context?.utmSource,
				utmMedium: args.context?.utmMedium,
				utmCampaign: args.context?.utmCampaign,
				device: args.context?.device,
				browser: args.context?.browser,
				os: args.context?.os,
				country: args.context?.country,
				identifiedUserId: visitor.identifiedUserId,
				eventCount: 0,
				pageviewCount: 0,
				durationMs: 0,
				bounce: true,
			});
			session = (await ctx.db.get(sessionDbId))!;
			newSession = true;
		}

		let accepted = 0;
		let duplicate = 0;
		let rejected = 0;
		let eventCount = 0;
		let pageviewCount = 0;
		let lastSeenAt = session.lastSeenAt;
		let exitPath = session.exitPath;
		let identifiedUserId = visitor.identifiedUserId;
		const insertedEventIds: Array<Id<"events">> = [];

		for (const event of args.events) {
			const occurredAt = event.occurredAt ?? receivedAt;
			const eventName = normalizeEventName(event);
			if (!eventName) {
				rejected += 1;
				continue;
			}
			const dedupeKey =
				event.eventId ??
				`${args.visitorId}:${args.sessionId}:${occurredAt}:${event.type}:${eventName}:${event.path ?? ""}`;
			const duplicateDedupe = await ctx.db
				.query("ingestDedupes")
				.withIndex("by_siteId_and_dedupeKey", (q) =>
					q.eq("siteId", site._id).eq("dedupeKey", dedupeKey),
				)
				.unique();
			if (duplicateDedupe && duplicateDedupe.expiresAt > receivedAt) {
				duplicate += 1;
				continue;
			}
			if (!duplicateDedupe) {
				await ctx.db.insert("ingestDedupes", {
					siteId: site._id,
					dedupeKey,
					expiresAt:
						receivedAt +
						(site.settings.dedupeRetentionMs ??
							defaultSettings.dedupeRetentionMs),
				});
			}

			const properties = sanitizeProperties(event.properties, site.settings);
			if (event.type === "identify" && event.userId) {
				identifiedUserId = event.userId;
			}
			const contributesSession = accepted === 0 && newSession;
			const contributesVisitor =
				visitor.firstSeenAt === visitor.lastSeenAt && accepted === 0;

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
				dedupeKey,
				contributesVisitor,
				contributesSession,
				aggregationStatus: "pending",
				aggregationAttempts: 0,
			});
			insertedEventIds.push(eventDbId);

			if (event.type === "pageview" && event.path) {
				await ctx.db.insert("pageViews", {
					siteId: site._id,
					occurredAt,
					visitorId: args.visitorId,
					sessionId: args.sessionId,
					path: event.path,
					title: event.title,
					referrer: event.referrer,
					utmSource: args.context?.utmSource,
					utmMedium: args.context?.utmMedium,
					utmCampaign: args.context?.utmCampaign,
				});
				exitPath = event.path;
				pageviewCount += 1;
			}

			accepted += 1;
			eventCount += 1;
			lastSeenAt = Math.max(lastSeenAt, occurredAt);
		}

		const durationMs = Math.max(0, lastSeenAt - session.startedAt);
		await ctx.db.patch(session._id, {
			lastSeenAt,
			exitPath,
			identifiedUserId,
			eventCount: session.eventCount + eventCount,
			pageviewCount: session.pageviewCount + pageviewCount,
			durationMs,
			bounce: session.pageviewCount + pageviewCount <= 1,
		});
		await ctx.db.patch(visitor._id, {
			lastSeenAt,
			identifiedUserId,
			traits: latestIdentifyTraits(args.events) ?? visitor.traits,
		});
		if (insertedEventIds.length > 0) {
			await ctx.scheduler.runAfter(0, internal.lib.aggregateEventBatch, {
				eventIds: insertedEventIds,
			});
		}

		return { accepted, duplicate, rejected };
	},
});
export const aggregateEventBatch = internalMutation({
	args: {
		eventIds: v.array(v.id("events")),
	},
	returns: v.object({
		aggregated: v.number(),
		skipped: v.number(),
	}),
	handler: async (ctx, args) => {
		return await aggregateEventsByIds(ctx, args.eventIds);
	},
});
export const aggregatePending = mutation({
	args: {
		siteId: v.id("sites"),
		now: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		aggregated: v.number(),
		skipped: v.number(),
		remaining: v.number(),
	}),
	handler: async (ctx, args) => {
		const limit = Math.min(args.limit ?? aggregationBatchLimit, 500);
		const rows = await ctx.db
			.query("events")
			.withIndex("by_siteId_and_aggregationStatus_and_occurredAt", (q) =>
				q
					.eq("siteId", args.siteId)
					.eq("aggregationStatus", "pending")
					.lte("occurredAt", args.now ?? Date.now()),
			)
			.take(limit + 1);
		const eventIds = rows.slice(0, limit).map((row) => row._id);
		const result =
			eventIds.length === 0
				? { aggregated: 0, skipped: 0 }
				: await aggregateEventsByIds(ctx, eventIds);
		if (rows.length > limit) {
			await ctx.scheduler.runAfter(0, api.lib.aggregatePending, {
				siteId: args.siteId,
				now: args.now,
				limit,
			});
		}
		return {
			aggregated: result.aggregated,
			skipped: result.skipped,
			remaining: Math.max(0, rows.length - limit),
		};
	},
});

export async function aggregateEventsByIds(
	ctx: MutationCtx,
	eventIds: Array<Id<"events">>,
) {
	let aggregated = 0;
	let skipped = 0;
	const now = Date.now();
	for (const eventId of eventIds.slice(0, aggregationBatchLimit)) {
		const event = await ctx.db.get(eventId);
		if (!event || event.aggregationStatus === "done") {
			skipped += 1;
			continue;
		}
		try {
			await updateRollupShards(ctx, {
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
				newSession: event.contributesSession ?? false,
				newVisitor: event.contributesVisitor ?? false,
				shard: shardForEvent(event._id),
			});
			await ctx.db.patch(event._id, {
				aggregationStatus: "done",
				aggregationAttempts: (event.aggregationAttempts ?? 0) + 1,
				aggregationError: "",
				aggregatedAt: now,
			});
			aggregated += 1;
		} catch (error) {
			await ctx.db.patch(event._id, {
				aggregationStatus: "failed",
				aggregationAttempts: (event.aggregationAttempts ?? 0) + 1,
				aggregationError:
					error instanceof Error ? error.message : "Aggregation failed",
			});
			throw error;
		}
	}

	return { aggregated, skipped };
}

export async function upsertVisitor(
	ctx: MutationCtx,
	args: {
		siteId: IdOfSite;
		visitorId: string;
		seenAt: number;
	},
) {
	const existing = await ctx.db
		.query("visitors")
		.withIndex("by_siteId_and_visitorId", (q) =>
			q.eq("siteId", args.siteId).eq("visitorId", args.visitorId),
		)
		.unique();
	if (existing) {
		await ctx.db.patch(existing._id, { lastSeenAt: args.seenAt });
		return existing;
	}

	const id = await ctx.db.insert("visitors", {
		siteId: args.siteId,
		visitorId: args.visitorId,
		firstSeenAt: args.seenAt,
		lastSeenAt: args.seenAt,
	});
	return (await ctx.db.get(id))!;
}

export async function updateRollupShards(
	ctx: MutationCtx,
	args: {
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
	},
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
	for (const item of dimensions) {
		await incrementRollupShard(ctx, {
			...args,
			interval: "hour",
			bucketStart: floorToBucket(args.occurredAt, hourMs),
			dimension: item.dimension,
			key: item.key,
		});
		await incrementRollupShard(ctx, {
			...args,
			interval: "day",
			bucketStart: floorToBucket(args.occurredAt, dayMs),
			dimension: item.dimension,
			key: item.key,
		});
	}
}

export async function incrementRollupShard(
	ctx: MutationCtx,
	args: {
		siteId: IdOfSite;
		interval: "hour" | "day";
		bucketStart: number;
		dimension: string;
		key: string;
		shard: number;
		eventType: "pageview" | "track" | "identify";
		receivedAt: number;
		newVisitor: boolean;
		newSession: boolean;
	},
) {
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
	const pageviewIncrement = args.eventType === "pageview" ? 1 : 0;
	if (!existing) {
		await ctx.db.insert("rollupShards", {
			siteId: args.siteId,
			interval: args.interval,
			bucketStart: args.bucketStart,
			dimension: args.dimension,
			key: args.key,
			shard: args.shard,
			count: 1,
			uniqueVisitorCount: args.newVisitor ? 1 : 0,
			sessionCount: args.newSession ? 1 : 0,
			pageviewCount: pageviewIncrement,
			bounceCount: 0,
			durationMs: 0,
			updatedAt: args.receivedAt,
		});
		return;
	}

	await ctx.db.patch(existing._id, {
		count: existing.count + 1,
		uniqueVisitorCount: existing.uniqueVisitorCount + (args.newVisitor ? 1 : 0),
		sessionCount: existing.sessionCount + (args.newSession ? 1 : 0),
		pageviewCount: existing.pageviewCount + pageviewIncrement,
		updatedAt: args.receivedAt,
	});
}
