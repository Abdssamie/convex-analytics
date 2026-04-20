import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
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
  properties: propertiesValidator,
  identifiedUserId: v.optional(v.string()),
  dedupeKey: v.optional(v.string()),
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
};

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const dedupeTtlMs = 24 * hourMs;
const maxBatchSize = 50;
const maxPropertyKeys = 32;

export const createSite = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    writeKeyHash: v.string(),
    allowedOrigins: v.optional(v.array(v.string())),
    sessionTimeoutMs: v.optional(v.number()),
    retentionDays: v.optional(v.number()),
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
      settings: {
        sessionTimeoutMs:
          args.sessionTimeoutMs ?? defaultSettings.sessionTimeoutMs,
        retentionDays: args.retentionDays ?? defaultSettings.retentionDays,
        allowedPropertyKeys: args.allowedPropertyKeys,
        deniedPropertyKeys: args.deniedPropertyKeys,
      },
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
        settings: {
          sessionTimeoutMs:
            args.sessionTimeoutMs ?? defaultSettings.sessionTimeoutMs,
          retentionDays: args.retentionDays ?? defaultSettings.retentionDays,
          allowedPropertyKeys: args.allowedPropertyKeys,
          deniedPropertyKeys: args.deniedPropertyKeys,
        },
        createdAt: now,
        updatedAt: now,
      });
    }
    const nextAllowedOrigins = args.allowedOrigins ?? existing.allowedOrigins;
    const nextSettings = {
      sessionTimeoutMs:
        args.sessionTimeoutMs ?? existing.settings.sessionTimeoutMs,
      retentionDays: args.retentionDays ?? existing.settings.retentionDays,
      allowedPropertyKeys:
        args.allowedPropertyKeys ?? existing.settings.allowedPropertyKeys,
      deniedPropertyKeys:
        args.deniedPropertyKeys ?? existing.settings.deniedPropertyKeys,
    };
    if (
      existing.name === args.name &&
      existing.status === "active" &&
      existing.writeKeyHash === args.writeKeyHash &&
      sameStringArray(existing.allowedOrigins, nextAllowedOrigins) &&
      existing.settings.sessionTimeoutMs === nextSettings.sessionTimeoutMs &&
      existing.settings.retentionDays === nextSettings.retentionDays &&
      sameOptionalStringArray(
        existing.settings.allowedPropertyKeys,
        nextSettings.allowedPropertyKeys,
      ) &&
      sameOptionalStringArray(
        existing.settings.deniedPropertyKeys,
        nextSettings.deniedPropertyKeys,
      )
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
      settings: {
        sessionTimeoutMs:
          args.sessionTimeoutMs ?? site.settings.sessionTimeoutMs,
        retentionDays: args.retentionDays ?? site.settings.retentionDays,
        allowedPropertyKeys:
          args.allowedPropertyKeys ?? site.settings.allowedPropertyKeys,
        deniedPropertyKeys:
          args.deniedPropertyKeys ?? site.settings.deniedPropertyKeys,
      },
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
          expiresAt: receivedAt + dedupeTtlMs,
        });
      }

      const properties = sanitizeProperties(event.properties, site.settings);
      if (event.type === "identify" && event.userId) {
        identifiedUserId = event.userId;
      }

      await ctx.db.insert("events", {
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
        properties,
        identifiedUserId,
        dedupeKey,
      });

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

      await updateRollups(ctx, {
        siteId: site._id,
        occurredAt,
        eventName,
        eventType: event.type,
        path: event.path,
        referrer: event.referrer,
        utmSource: args.context?.utmSource,
        utmMedium: args.context?.utmMedium,
        utmCampaign: args.context?.utmCampaign,
        receivedAt,
        newSession: accepted === 0 && newSession,
        newVisitor: visitor.firstSeenAt === visitor.lastSeenAt && accepted === 0,
      });

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
    const rows = await ctx.db.query("ingestDedupes").take(args.limit ?? 100);
    let deleted = 0;
    for (const row of rows) {
      if (row.expiresAt <= now) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    return deleted;
  },
});

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

async function updateRollups(
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
    await incrementRollup(ctx, "rollupsHourly", {
      ...args,
      bucketStart: floorToBucket(args.occurredAt, hourMs),
      dimension: item.dimension,
      key: item.key,
    });
    await incrementRollup(ctx, "rollupsDaily", {
      ...args,
      bucketStart: floorToBucket(args.occurredAt, dayMs),
      dimension: item.dimension,
      key: item.key,
    });
  }
}

async function incrementRollup(
  ctx: MutationCtx,
  table: "rollupsHourly" | "rollupsDaily",
  args: {
    siteId: IdOfSite;
    bucketStart: number;
    dimension: string;
    key: string;
    eventType: "pageview" | "track" | "identify";
    receivedAt: number;
    newVisitor: boolean;
    newSession: boolean;
  },
) {
  const existing = await ctx.db
    .query(table)
    .withIndex("by_siteId_and_dimension_and_key_and_bucketStart", (q) =>
      q
        .eq("siteId", args.siteId)
        .eq("dimension", args.dimension)
        .eq("key", args.key)
        .eq("bucketStart", args.bucketStart),
    )
    .unique();
  const pageviewIncrement = args.eventType === "pageview" ? 1 : 0;
  if (!existing) {
    await ctx.db.insert(table, {
      siteId: args.siteId,
      bucketStart: args.bucketStart,
      dimension: args.dimension,
      key: args.key,
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

async function queryHourlyRollups(
  ctx: QueryCtx,
  args: { siteId: IdOfSite; from: number; to: number },
  dimension: string,
  key: string,
) {
  return await ctx.db
    .query("rollupsHourly")
    .withIndex("by_siteId_and_dimension_and_key_and_bucketStart", (q) =>
      q
        .eq("siteId", args.siteId)
        .eq("dimension", dimension)
        .eq("key", key)
        .gte("bucketStart", floorToBucket(args.from, hourMs))
        .lt("bucketStart", args.to),
    )
    .take(2000);
}

async function queryDailyRollups(
  ctx: QueryCtx,
  args: { siteId: IdOfSite; from: number; to: number },
  dimension: string,
  key: string,
) {
  return await ctx.db
    .query("rollupsDaily")
    .withIndex("by_siteId_and_dimension_and_key_and_bucketStart", (q) =>
      q
        .eq("siteId", args.siteId)
        .eq("dimension", dimension)
        .eq("key", key)
        .gte("bucketStart", floorToBucket(args.from, dayMs))
        .lt("bucketStart", args.to),
    )
    .take(1000);
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
    .query("rollupsDaily")
    .withIndex("by_siteId_and_bucketStart", (q) =>
      q
        .eq("siteId", args.siteId)
        .gte("bucketStart", floorToBucket(args.from, dayMs))
        .lt("bucketStart", args.to),
    )
    .take(5000);
  const byKey = new Map<string, { count: number; pageviewCount: number }>();
  for (const row of rows) {
    if (row.dimension !== dimension) {
      continue;
    }
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
