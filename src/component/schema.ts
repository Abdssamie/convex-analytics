import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const propertyValue = v.union(v.string(), v.number(), v.boolean(), v.null());

export default defineSchema({
  sites: defineTable({
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
  })
    .index("by_slug", ["slug"])
    .index("by_writeKeyHash", ["writeKeyHash"]),

  visitors: defineTable({
    siteId: v.id("sites"),
    visitorId: v.string(),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    identifiedUserId: v.optional(v.string()),
    traits: v.optional(v.record(v.string(), propertyValue)),
  })
    .index("by_siteId_and_visitorId", ["siteId", "visitorId"])
    .index("by_siteId_and_identifiedUserId", [
      "siteId",
      "identifiedUserId",
    ]),

  sessions: defineTable({
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
  })
    .index("by_siteId_and_sessionId", ["siteId", "sessionId"])
    .index("by_siteId_and_startedAt", ["siteId", "startedAt"])
    .index("by_siteId_and_visitorId_and_startedAt", [
      "siteId",
      "visitorId",
      "startedAt",
    ]),

  events: defineTable({
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
    properties: v.optional(v.record(v.string(), propertyValue)),
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
  })
    .index("by_siteId_and_occurredAt", ["siteId", "occurredAt"])
    .index("by_siteId_and_eventName_and_occurredAt", [
      "siteId",
      "eventName",
      "occurredAt",
    ])
    .index("by_siteId_and_sessionId", ["siteId", "sessionId"])
    .index("by_siteId_and_aggregationStatus_and_occurredAt", [
      "siteId",
      "aggregationStatus",
      "occurredAt",
    ]),

  pageViews: defineTable({
    siteId: v.id("sites"),
    occurredAt: v.number(),
    visitorId: v.string(),
    sessionId: v.string(),
    path: v.string(),
    title: v.optional(v.string()),
    referrer: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
  })
    .index("by_siteId_and_occurredAt", ["siteId", "occurredAt"])
    .index("by_siteId_and_path_and_occurredAt", [
      "siteId",
      "path",
      "occurredAt",
    ]),

  rollupShards: defineTable({
    siteId: v.id("sites"),
    interval: v.union(v.literal("hour"), v.literal("day")),
    bucketStart: v.number(),
    dimension: v.string(),
    key: v.string(),
    shard: v.number(),
    count: v.number(),
    uniqueVisitorCount: v.number(),
    sessionCount: v.number(),
    pageviewCount: v.number(),
    bounceCount: v.number(),
    durationMs: v.number(),
    updatedAt: v.number(),
  })
    .index("by_site_interval_dimension_key_bucket_shard", [
      "siteId",
      "interval",
      "dimension",
      "key",
      "bucketStart",
      "shard",
    ])
    .index("by_site_interval_dimension_key_bucket", [
      "siteId",
      "interval",
      "dimension",
      "key",
      "bucketStart",
    ])
    .index("by_site_interval_dimension_bucket", [
      "siteId",
      "interval",
      "dimension",
      "bucketStart",
    ])
    .index("by_site_interval_bucket", [
      "siteId",
      "interval",
      "bucketStart",
    ]),

  ingestDedupes: defineTable({
    siteId: v.id("sites"),
    dedupeKey: v.string(),
    expiresAt: v.number(),
  })
    .index("by_siteId_and_dedupeKey", ["siteId", "dedupeKey"])
    .index("by_expiresAt", ["expiresAt"]),
});
