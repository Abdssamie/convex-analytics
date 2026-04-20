import { v } from "convex/values";
import { api, internal } from "./_generated/api.js";
import { internalMutation, mutation, query } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";

const propertyValue = v.union(v.string(), v.number(), v.boolean(), v.null());

const propertiesValidator = v.optional(v.record(v.string(), propertyValue));

const eventInputValidator = v.object({
  type: v.union(
    v.literal("pageview"),
    v.literal("track"),
    v.literal("identify"),
  ),
  name: v.optional(v.string()),
  occurredAt: v.optional(v.number()),
  path: v.optional(v.string()),
  title: v.optional(v.string()),
  referrer: v.optional(v.string()),
  properties: propertiesValidator,
  userId: v.optional(v.string()),
  eventId: v.optional(v.string()),
});

const contextValidator = v.optional(
  v.object({
    source: v.optional(v.string()),
    device: v.optional(v.string()),
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
    country: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
  }),
);

const siteValidator = v.object({
  _id: v.id("sites"),
  _creationTime: v.number(),
  slug: v.string(),
  name: v.string(),
  status: v.union(v.literal("active"), v.literal("disabled")),
  writeKeyHash: v.string(),
  allowedOrigins: v.array(v.string()),
  settings: v.object({
    sessionTimeoutMs: v.number(),
    retentionDays: v.number(),
    rawEventRetentionDays: v.optional(v.number()),
    pageViewRetentionDays: v.optional(v.number()),
    hourlyRollupRetentionDays: v.optional(v.number()),
    dailyRollupRetentionDays: v.optional(v.number()),
    dedupeRetentionMs: v.optional(v.number()),
    allowedPropertyKeys: v.optional(v.array(v.string())),
    deniedPropertyKeys: v.optional(v.array(v.string())),
  }),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const eventValidator = v.object({
  _id: v.id("events"),
  _creationTime: v.number(),
  siteId: v.id("sites"),
  receivedAt: v.number(),
  occurredAt: v.number(),
  visitorId: v.string(),
  sessionId: v.string(),
  eventType: v.union(
    v.literal("pageview"),
    v.literal("track"),
    v.literal("identify"),
  ),
  eventName: v.string(),
  path: v.optional(v.string()),
  title: v.optional(v.string()),
  referrer: v.optional(v.string()),
  source: v.optional(v.string()),
  utmSource: v.optional(v.string()),
  utmMedium: v.optional(v.string()),
  utmCampaign: v.optional(v.string()),
  properties: propertiesValidator,
  identifiedUserId: v.optional(v.string()),
  dedupeKey: v.optional(v.string()),
  contributesVisitor: v.optional(v.boolean()),
  contributesSession: v.optional(v.boolean()),
  aggregationStatus: v.optional(
    v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
  ),
  aggregationAttempts: v.optional(v.number()),
  aggregationError: v.optional(v.string()),
  aggregatedAt: v.optional(v.number()),
});

const sessionValidator = v.object({
  _id: v.id("sessions"),
  _creationTime: v.number(),
  siteId: v.id("sites"),
  visitorId: v.string(),
  sessionId: v.string(),
  startedAt: v.number(),
  lastSeenAt: v.number(),
  entryPath: v.optional(v.string()),
  exitPath: v.optional(v.string()),
  referrer: v.optional(v.string()),
  utmSource: v.optional(v.string()),
  utmMedium: v.optional(v.string()),
  utmCampaign: v.optional(v.string()),
  device: v.optional(v.string()),
  browser: v.optional(v.string()),
  os: v.optional(v.string()),
  country: v.optional(v.string()),
  identifiedUserId: v.optional(v.string()),
  eventCount: v.number(),
  pageviewCount: v.number(),
  durationMs: v.number(),
  bounce: v.boolean(),
});

const topRowValidator = v.object({
  key: v.string(),
  count: v.number(),
  pageviewCount: v.number(),
});

const defaultSettings = {
  sessionTimeoutMs: 30 * 60 * 1000,
  retentionDays: 90,
  rawEventRetentionDays: 90,
  pageViewRetentionDays: 90,
  hourlyRollupRetentionDays: 90,
  dedupeRetentionMs: 24 * 60 * 60 * 1000,
};

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const maxBatchSize = 50;
const maxPropertyKeys = 32;
const rollupShardCount = 16;
const aggregationBatchLimit = 100;
const cleanupBatchLimit = 100;

export const createSite = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    writeKeyHash: v.string(),
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

export const ensureSite = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    writeKeyHash: v.string(),
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
  returns: v.id("sites"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!existing) {
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
    }
    const nextAllowedOrigins = args.allowedOrigins ?? existing.allowedOrigins;
    const nextSettings = siteSettingsFromArgs(args, existing.settings);
    if (
      existing.name === args.name &&
      existing.status === "active" &&
      existing.writeKeyHash === args.writeKeyHash &&
      sameStringArray(existing.allowedOrigins, nextAllowedOrigins) &&
      sameSiteSettings(existing.settings, nextSettings)
    ) {
      return existing._id;
    }
    await ctx.db.patch(existing._id, {
      name: args.name,
      status: "active",
      writeKeyHash: args.writeKeyHash,
      allowedOrigins: nextAllowedOrigins,
      settings: nextSettings,
      updatedAt: now,
    });
    return existing._id;
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
    pageViewRetentionDays: v.optional(v.number()),
    hourlyRollupRetentionDays: v.optional(v.number()),
    dailyRollupRetentionDays: v.optional(v.number()),
    dedupeRetentionMs: v.optional(v.number()),
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

export const getOverview = query({
  args: {
    siteId: v.id("sites"),
    from: v.number(),
    to: v.number(),
  },
  returns: v.object({
    events: v.number(),
    pageviews: v.number(),
    sessions: v.number(),
    visitors: v.number(),
    bounceRate: v.number(),
    averageSessionDurationMs: v.number(),
  }),
  handler: async (ctx, args) => {
    const rows = await queryDailyRollups(ctx, args, "overview", "all");
    const totals = sumRollups(rows);
    return {
      events: totals.count,
      pageviews: totals.pageviewCount,
      sessions: totals.sessionCount,
      visitors: totals.uniqueVisitorCount,
      bounceRate:
        totals.sessionCount === 0 ? 0 : totals.bounceCount / totals.sessionCount,
      averageSessionDurationMs:
        totals.sessionCount === 0 ? 0 : totals.durationMs / totals.sessionCount,
    };
  },
});

export const getTimeseries = query({
  args: {
    siteId: v.id("sites"),
    from: v.number(),
    to: v.number(),
    interval: v.union(v.literal("hour"), v.literal("day")),
  },
  returns: v.array(
    v.object({
      bucketStart: v.number(),
      events: v.number(),
      pageviews: v.number(),
      sessions: v.number(),
      visitors: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows =
      args.interval === "hour"
        ? await queryHourlyRollups(ctx, args, "overview", "all")
        : await queryDailyRollups(ctx, args, "overview", "all");
    return rows.map((row) => ({
      bucketStart: row.bucketStart,
      events: row.count,
      pageviews: row.pageviewCount,
      sessions: row.sessionCount,
      visitors: row.uniqueVisitorCount,
    }));
  },
});

export const getTopPages = query({
  args: {
    siteId: v.id("sites"),
    from: v.number(),
    to: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(topRowValidator),
  handler: async (ctx, args) => {
    return await topDimension(ctx, args, "page", args.limit ?? 10);
  },
});

export const getTopReferrers = query({
  args: {
    siteId: v.id("sites"),
    from: v.number(),
    to: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(topRowValidator),
  handler: async (ctx, args) => {
    return await topDimension(ctx, args, "referrer", args.limit ?? 10);
  },
});

export const getTopCampaigns = query({
  args: {
    siteId: v.id("sites"),
    from: v.number(),
    to: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(topRowValidator),
  handler: async (ctx, args) => {
    return await topDimension(ctx, args, "utmCampaign", args.limit ?? 10);
  },
});

export const getTopEvents = query({
  args: {
    siteId: v.id("sites"),
    from: v.number(),
    to: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(topRowValidator),
  handler: async (ctx, args) => {
    return await topDimension(ctx, args, "event", args.limit ?? 10);
  },
});

export const listRawEvents = query({
  args: {
    siteId: v.id("sites"),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(eventValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_siteId_and_occurredAt", (q) =>
        q
          .eq("siteId", args.siteId)
          .gte("occurredAt", args.from ?? 0)
          .lt("occurredAt", args.to ?? Number.MAX_SAFE_INTEGER),
      )
      .order("desc")
      .take(Math.min(args.limit ?? 100, 500));
  },
});

export const listSessions = query({
  args: {
    siteId: v.id("sites"),
    limit: v.optional(v.number()),
  },
  returns: v.array(sessionValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_siteId_and_startedAt", (q) =>
        q.eq("siteId", args.siteId),
      )
      .order("desc")
      .take(Math.min(args.limit ?? 100, 500));
  },
});

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

async function aggregateEventsByIds(
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

async function resolveSite(
  ctx: MutationCtx,
  args: { siteId?: Id<"sites">; slug?: string },
) {
  if (args.siteId) {
    const site = await ctx.db.get(args.siteId);
    if (!site) {
      throw new Error("Site not found");
    }
    return site;
  }
  if (args.slug) {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug!))
      .unique();
    if (!site) {
      throw new Error("Site not found");
    }
    return site;
  }
  throw new Error("siteId or slug is required");
}

async function deleteDoneEventsBefore(
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

async function deletePageViewsBefore(
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

async function deleteRollupShardsBefore(
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

async function deleteRows(
  ctx: MutationCtx,
  rows: Array<{
    _id: Id<"events"> | Id<"pageViews"> | Id<"rollupShards">;
  }>,
) {
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}

async function upsertVisitor(
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

type IdOfSite = Id<"sites">;

type SiteSettings = {
  sessionTimeoutMs: number;
  retentionDays: number;
  rawEventRetentionDays?: number;
  pageViewRetentionDays?: number;
  hourlyRollupRetentionDays?: number;
  dailyRollupRetentionDays?: number;
  dedupeRetentionMs?: number;
  allowedPropertyKeys?: string[];
  deniedPropertyKeys?: string[];
};

type SiteSettingsArgs = {
  sessionTimeoutMs?: number;
  retentionDays?: number;
  rawEventRetentionDays?: number;
  pageViewRetentionDays?: number;
  hourlyRollupRetentionDays?: number;
  dailyRollupRetentionDays?: number;
  dedupeRetentionMs?: number;
  allowedPropertyKeys?: string[];
  deniedPropertyKeys?: string[];
};

function siteSettingsFromArgs(
  args: SiteSettingsArgs,
  existing?: SiteSettings,
): SiteSettings {
  const retentionDays =
    args.retentionDays ??
    existing?.retentionDays ??
    defaultSettings.retentionDays;
  return {
    sessionTimeoutMs:
      args.sessionTimeoutMs ??
      existing?.sessionTimeoutMs ??
      defaultSettings.sessionTimeoutMs,
    retentionDays,
    rawEventRetentionDays:
      args.rawEventRetentionDays ??
      existing?.rawEventRetentionDays ??
      retentionDays,
    pageViewRetentionDays:
      args.pageViewRetentionDays ??
      existing?.pageViewRetentionDays ??
      retentionDays,
    hourlyRollupRetentionDays:
      args.hourlyRollupRetentionDays ??
      existing?.hourlyRollupRetentionDays ??
      retentionDays,
    dailyRollupRetentionDays:
      args.dailyRollupRetentionDays ?? existing?.dailyRollupRetentionDays,
    dedupeRetentionMs:
      args.dedupeRetentionMs ??
      existing?.dedupeRetentionMs ??
      defaultSettings.dedupeRetentionMs,
    allowedPropertyKeys:
      args.allowedPropertyKeys ?? existing?.allowedPropertyKeys,
    deniedPropertyKeys:
      args.deniedPropertyKeys ?? existing?.deniedPropertyKeys,
  };
}

function sameSiteSettings(left: SiteSettings, right: SiteSettings) {
  return (
    left.sessionTimeoutMs === right.sessionTimeoutMs &&
    left.retentionDays === right.retentionDays &&
    left.rawEventRetentionDays === right.rawEventRetentionDays &&
    left.pageViewRetentionDays === right.pageViewRetentionDays &&
    left.hourlyRollupRetentionDays === right.hourlyRollupRetentionDays &&
    left.dailyRollupRetentionDays === right.dailyRollupRetentionDays &&
    left.dedupeRetentionMs === right.dedupeRetentionMs &&
    sameOptionalStringArray(left.allowedPropertyKeys, right.allowedPropertyKeys) &&
    sameOptionalStringArray(left.deniedPropertyKeys, right.deniedPropertyKeys)
  );
}

function daysToMs(days: number) {
  return days * dayMs;
}

function normalizeEventName(event: {
  type: "pageview" | "track" | "identify";
  name?: string;
}) {
  if (event.type === "pageview") {
    return "pageview";
  }
  if (event.type === "identify") {
    return "identify";
  }
  return event.name?.trim() || null;
}

function sameOptionalStringArray(left?: string[], right?: string[]) {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return sameStringArray(left, right);
}

function sameStringArray(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function sanitizeProperties(
  properties:
    | Record<string, string | number | boolean | null>
    | undefined,
  settings: {
    allowedPropertyKeys?: string[];
    deniedPropertyKeys?: string[];
  },
) {
  if (!properties) {
    return undefined;
  }
  const allowed = settings.allowedPropertyKeys
    ? new Set(settings.allowedPropertyKeys)
    : null;
  const denied = new Set(settings.deniedPropertyKeys ?? []);
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(properties).slice(0, maxPropertyKeys)) {
    if (allowed && !allowed.has(key)) {
      continue;
    }
    if (denied.has(key)) {
      continue;
    }
    output[key] = value;
  }
  return output;
}

function firstPagePath(events: Array<{ type: string; path?: string }>) {
  return events.find((event) => event.type === "pageview" && event.path)?.path;
}

function firstReferrer(events: Array<{ referrer?: string }>) {
  return events.find((event) => event.referrer)?.referrer;
}

function latestIdentifyTraits(
  events: Array<{
    type: string;
    properties?: Record<string, string | number | boolean | null>;
  }>,
) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "identify") {
      return event.properties;
    }
  }
  return undefined;
}

async function updateRollupShards(
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

async function incrementRollupShard(
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

function floorToBucket(value: number, bucketMs: number) {
  return Math.floor(value / bucketMs) * bucketMs;
}

function shardForEvent(eventId: Id<"events">) {
  let hash = 0;
  for (let index = 0; index < eventId.length; index += 1) {
    hash = (hash * 31 + eventId.charCodeAt(index)) >>> 0;
  }
  return hash % rollupShardCount;
}

async function queryHourlyRollups(
  ctx: QueryCtx,
  args: { siteId: IdOfSite; from: number; to: number },
  dimension: string,
  key: string,
) {
  return await ctx.db
    .query("rollupShards")
    .withIndex("by_site_interval_dimension_key_bucket", (q) =>
      q
        .eq("siteId", args.siteId)
        .eq("interval", "hour")
        .eq("dimension", dimension)
        .eq("key", key)
        .gte("bucketStart", floorToBucket(args.from, hourMs))
        .lt("bucketStart", args.to),
    )
    .take(2000 * rollupShardCount);
}

async function queryDailyRollups(
  ctx: QueryCtx,
  args: { siteId: IdOfSite; from: number; to: number },
  dimension: string,
  key: string,
) {
  return await ctx.db
    .query("rollupShards")
    .withIndex("by_site_interval_dimension_key_bucket", (q) =>
      q
        .eq("siteId", args.siteId)
        .eq("interval", "day")
        .eq("dimension", dimension)
        .eq("key", key)
        .gte("bucketStart", floorToBucket(args.from, dayMs))
        .lt("bucketStart", args.to),
    )
    .take(1000 * rollupShardCount);
}

function sumRollups(
  rows: Array<{
    count: number;
    uniqueVisitorCount: number;
    sessionCount: number;
    pageviewCount: number;
    bounceCount: number;
    durationMs: number;
  }>,
) {
  return rows.reduce(
    (sum, row) => ({
      count: sum.count + row.count,
      uniqueVisitorCount: sum.uniqueVisitorCount + row.uniqueVisitorCount,
      sessionCount: sum.sessionCount + row.sessionCount,
      pageviewCount: sum.pageviewCount + row.pageviewCount,
      bounceCount: sum.bounceCount + row.bounceCount,
      durationMs: sum.durationMs + row.durationMs,
    }),
    {
      count: 0,
      uniqueVisitorCount: 0,
      sessionCount: 0,
      pageviewCount: 0,
      bounceCount: 0,
      durationMs: 0,
    },
  );
}

async function topDimension(
  ctx: QueryCtx,
  args: { siteId: IdOfSite; from: number; to: number },
  dimension: string,
  limit: number,
) {
  const rows = await ctx.db
    .query("rollupShards")
    .withIndex("by_site_interval_dimension_bucket", (q) =>
      q
        .eq("siteId", args.siteId)
        .eq("interval", "day")
        .eq("dimension", dimension)
        .gte("bucketStart", floorToBucket(args.from, dayMs))
        .lt("bucketStart", args.to),
    )
    .take(5000 * rollupShardCount);
  const byKey = new Map<string, { count: number; pageviewCount: number }>();
  for (const row of rows) {
    const current = byKey.get(row.key) ?? { count: 0, pageviewCount: 0 };
    current.count += row.count;
    current.pageviewCount += row.pageviewCount;
    byKey.set(row.key, current);
  }
  return [...byKey.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((left, right) => right.count - left.count)
    .slice(0, Math.min(limit, 100));
}
