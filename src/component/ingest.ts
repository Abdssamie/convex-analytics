import { mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
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
	const visitorUpdates = new Map<string, {
		siteId: IdOfSite;
		visitorId: string;
		firstSeenAt: number;
		lastSeenAt: number;
		identifiedUserId?: string;
		traits?: Record<string, string | number | boolean | null>;
	}>();
	const sessionUpdates = new Map<string, SessionUpdate>();
	const sitesCache = new Map<IdOfSite, Doc<"sites">>();

	const validEvents: Array<Doc<"events">> = [];
	for (const eventId of eventIds.slice(0, aggregationBatchLimit)) {
		const event = await ctx.db.get(eventId);
		if (!event || event.aggregatedAt !== null) {
			skipped += 1;
			continue;
		}

		let site = sitesCache.get(event.siteId);
		if (!site) {
			const loadedSite = await ctx.db.get(event.siteId);
			if (!loadedSite) {
				failed += 1;
				continue;
			}
			site = loadedSite;
			sitesCache.set(event.siteId, site);
		}
		validEvents.push(event);

		// Group visitor updates
		const vKey = `${event.siteId}|${event.visitorId}`;
		const vUpdate = visitorUpdates.get(vKey) ?? {
			siteId: event.siteId,
			visitorId: event.visitorId,
			firstSeenAt: event.occurredAt,
			lastSeenAt: event.occurredAt,
		};
		vUpdate.firstSeenAt = Math.min(vUpdate.firstSeenAt, event.occurredAt);
		vUpdate.lastSeenAt = Math.max(vUpdate.lastSeenAt, event.occurredAt);
		vUpdate.identifiedUserId = event.identifiedUserId ?? vUpdate.identifiedUserId;
		if (event.eventType === "identify") {
			vUpdate.traits = event.properties ?? vUpdate.traits;
		}
		visitorUpdates.set(vKey, vUpdate);
	}

	const eventToSessionUpdateKey = buildSessionUpdates(
		validEvents,
		sitesCache,
		sessionUpdates,
	);

	const visitorsCreated = new Map<string, boolean>();
	const sessionsCreated = new Map<string, boolean>();

	// Apply batched visitor updates
	for (const [vKey, update] of visitorUpdates.entries()) {
		const result = await upsertVisitorRecord(ctx, update);
		visitorsCreated.set(vKey, result.created);
	}

	// Apply batched session updates
	for (const [sKey, update] of sessionUpdates.entries()) {
		const result = await upsertSessionRecord(ctx, update);
		sessionsCreated.set(sKey, result.created);
	}

	const visitorHasRollup = new Set<string>();
	const sessionHasRollup = new Set<string>();

	for (const event of validEvents) {
		try {
			const vKey = `${event.siteId}|${event.visitorId}`;
			const sKey = eventToSessionUpdateKey.get(event._id);
			if (!sKey) {
				failed += 1;
				continue;
			}

			const isNewVisitor = visitorsCreated.get(vKey) && !visitorHasRollup.has(vKey);
			const isNewSession = sessionsCreated.get(sKey) && !sessionHasRollup.has(sKey);

			if (isNewVisitor) visitorHasRollup.add(vKey);
			if (isNewSession) sessionHasRollup.add(sKey);

			accumulateRollups(rollupDeltas, {
				siteId: event.siteId,
				occurredAt: event.occurredAt,
				eventName: event.eventName,
				eventType: event.eventType,
				path: event.path,
				referrer: event.referrer,
				device: event.device,
				browser: event.browser,
				os: event.os,
				country: event.country,
				utmSource: event.utmSource,
				utmMedium: event.utmMedium,
				utmCampaign: event.utmCampaign,
				receivedAt: now,
				isNewVisitor: !!isNewVisitor,
				isNewSession: !!isNewSession,
			});
			await ctx.db.patch(event._id, {
				aggregatedAt: now,
			});
			aggregated += 1;
		} catch {
			failed += 1;
		}
	}

	await flushRollups(ctx, rollupDeltas);

	return { aggregated, skipped, failed };
}

type SessionUpdate = {
	siteId: IdOfSite;
	sessionId: string;
	visitorId: string;
	firstSeenAt: number;
	lastSeenAt: number;
	entryPath?: string;
	exitPath?: string;
	referrer?: string;
	device?: string;
	browser?: string;
	os?: string;
	country?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
	identifiedUserId?: string;
	pageviewCount: number;
	sessionTimeoutMs: number;
};

function buildSessionUpdates(
	events: Array<Doc<"events">>,
	sitesCache: Map<IdOfSite, Doc<"sites">>,
	sessionUpdates: Map<string, SessionUpdate>,
) {
	const eventsBySessionId = new Map<string, Array<Doc<"events">>>();
	for (const event of events) {
		const key = `${event.siteId}|${event.sessionId}`;
		const bucket = eventsBySessionId.get(key) ?? [];
		bucket.push(event);
		eventsBySessionId.set(key, bucket);
	}

	const eventToSessionUpdateKey = new Map<Id<"events">, string>();
	for (const [groupKey, sessionEvents] of eventsBySessionId.entries()) {
		const sortedEvents = [...sessionEvents].sort(
			(left, right) => left.occurredAt - right.occurredAt,
		);
		const firstEvent = sortedEvents[0];
		if (!firstEvent) {
			continue;
		}
		const site = sitesCache.get(firstEvent.siteId);
		if (!site) {
			continue;
		}

		let batchIndex = 0;
		let currentKey = `${groupKey}|${batchIndex}`;
		let currentUpdate = createSessionUpdate(firstEvent, site);
		sessionUpdates.set(currentKey, currentUpdate);
		eventToSessionUpdateKey.set(firstEvent._id, currentKey);

		for (const event of sortedEvents.slice(1)) {
			if (
				event.occurredAt - currentUpdate.lastSeenAt >
				currentUpdate.sessionTimeoutMs
			) {
				batchIndex += 1;
				currentKey = `${groupKey}|${batchIndex}`;
				currentUpdate = createSessionUpdate(event, site);
				sessionUpdates.set(currentKey, currentUpdate);
				eventToSessionUpdateKey.set(event._id, currentKey);
				continue;
			}
			mergeSessionEvent(currentUpdate, event);
			eventToSessionUpdateKey.set(event._id, currentKey);
		}
	}

	return eventToSessionUpdateKey;
}

function createSessionUpdate(
	event: Doc<"events">,
	site: Doc<"sites">,
): SessionUpdate {
	const update: SessionUpdate = {
		siteId: event.siteId,
		sessionId: event.sessionId,
		visitorId: event.visitorId,
		firstSeenAt: event.occurredAt,
		lastSeenAt: event.occurredAt,
		entryPath: event.path,
		exitPath: event.path,
		referrer: event.referrer,
		device: event.device,
		browser: event.browser,
		os: event.os,
		country: event.country,
		utmSource: event.utmSource,
		utmMedium: event.utmMedium,
		utmCampaign: event.utmCampaign,
		identifiedUserId: event.identifiedUserId,
		pageviewCount: event.eventType === "pageview" ? 1 : 0,
		sessionTimeoutMs: site.settings.sessionTimeoutMs,
	};
	return update;
}

function mergeSessionEvent(update: SessionUpdate, event: Doc<"events">) {
	if (event.occurredAt <= update.firstSeenAt) {
		update.firstSeenAt = event.occurredAt;
		update.entryPath = event.path ?? update.entryPath;
		update.referrer = event.referrer ?? update.referrer;
	}
	if (event.occurredAt >= update.lastSeenAt) {
		update.lastSeenAt = event.occurredAt;
		update.exitPath = event.path ?? update.exitPath;
	}
	update.identifiedUserId = event.identifiedUserId ?? update.identifiedUserId;
	if (event.eventType === "pageview") {
		update.pageviewCount += 1;
	}
}

export const upsertVisitor = internalMutation({
	args: {
		siteId: v.id("sites"),
		visitorId: v.string(),
		firstSeenAt: v.number(),
		lastSeenAt: v.number(),
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
		firstSeenAt: number;
		lastSeenAt: number;
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
		const firstSeenAt = Math.min(existing.firstSeenAt, args.firstSeenAt);
		const lastSeenAt = Math.max(existing.lastSeenAt, args.lastSeenAt);
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
		firstSeenAt: args.firstSeenAt,
		lastSeenAt: args.lastSeenAt,
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
		firstSeenAt: v.number(),
		lastSeenAt: v.number(),
		entryPath: v.optional(v.string()),
		exitPath: v.optional(v.string()),
		referrer: v.optional(v.string()),
		device: v.optional(v.string()),
		browser: v.optional(v.string()),
		os: v.optional(v.string()),
		country: v.optional(v.string()),
		utmSource: v.optional(v.string()),
		utmMedium: v.optional(v.string()),
		utmCampaign: v.optional(v.string()),
		identifiedUserId: v.optional(v.string()),
		pageviewCount: v.number(),
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
		firstSeenAt: number;
		lastSeenAt: number;
		entryPath?: string;
		exitPath?: string;
		referrer?: string;
		device?: string;
		browser?: string;
		os?: string;
		country?: string;
		utmSource?: string;
		utmMedium?: string;
		utmCampaign?: string;
		identifiedUserId?: string;
		pageviewCount: number;
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
	const isNewSession =
		!existing ||
		args.firstSeenAt - existing.lastSeenAt > args.sessionTimeoutMs;
	if (isNewSession) {
		await ctx.db.insert("sessions", {
			siteId: args.siteId,
			visitorId: args.visitorId,
			sessionId: args.sessionId,
			startedAt: args.firstSeenAt,
			lastSeenAt: args.lastSeenAt,
			entryPath: args.entryPath,
			exitPath: args.exitPath,
			referrer: args.referrer,
			device: args.device,
			browser: args.browser,
			os: args.os,
			country: args.country,
			utmSource: args.utmSource,
			utmMedium: args.utmMedium,
			utmCampaign: args.utmCampaign,
			identifiedUserId: args.identifiedUserId,
			pageviewCount: args.pageviewCount,
		});
		return { created: true };
	}

	const startedAt = Math.min(existing.startedAt, args.firstSeenAt);
	const lastSeenAt = Math.max(existing.lastSeenAt, args.lastSeenAt);
	const nextPageviewCount = existing.pageviewCount + args.pageviewCount;
	await ctx.db.patch(existing._id, {
		visitorId: args.visitorId,
		startedAt,
		lastSeenAt,
		entryPath:
			args.firstSeenAt < existing.startedAt && args.entryPath
				? args.entryPath
				: existing.entryPath,
		exitPath:
			args.exitPath && args.lastSeenAt >= existing.lastSeenAt
				? args.exitPath
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
	isNewVisitor: boolean;
	isNewSession: boolean;
};

type RollupDelta = {
	siteId: IdOfSite;
	interval: "hour" | "day";
	bucketStart: number;
	dimension: string;
	key: string;
	count: number;
	pageviewCount: number;
	visitorCount: number;
	sessionCount: number;
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
	const visitorIncrement = args.isNewVisitor ? 1 : 0;
	const sessionIncrement = args.isNewSession ? 1 : 0;
	for (const item of dimensions) {
		mergeRollupDelta(deltas, {
			siteId: args.siteId,
			interval: "hour",
			bucketStart: floorToBucket(args.occurredAt, hourMs),
			dimension: item.dimension,
			key: item.key,
			count: 1,
			pageviewCount: pageviewIncrement,
			visitorCount: visitorIncrement,
			sessionCount: sessionIncrement,
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
			visitorCount: visitorIncrement,
			sessionCount: sessionIncrement,
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
	existing.visitorCount += args.visitorCount;
	existing.sessionCount += args.sessionCount;
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
				visitorCount: args.visitorCount,
				sessionCount: args.sessionCount,
				bounceCount: 0,
				durationMs: 0,
				updatedAt: args.updatedAt,
			});
			continue;
		}

		await ctx.db.patch(existing._id, {
			count: existing.count + args.count,
			pageviewCount: existing.pageviewCount + args.pageviewCount,
			visitorCount: (existing.visitorCount ?? 0) + args.visitorCount,
			sessionCount: (existing.sessionCount ?? 0) + args.sessionCount,
			updatedAt: Math.max(existing.updatedAt, args.updatedAt),
		});
	}
}
