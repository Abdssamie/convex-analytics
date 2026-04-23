import { mutation } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import {
  exposeAdminApi,
  exposeAnalyticsApi,
} from "../../src/client/index.js";
import { v } from "convex/values";

async function hashWriteKey(writeKey: string) {
  const bytes = new TextEncoder().encode(writeKey);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const {
  createSite,
  updateSite,
  rotateWriteKey,
  getSiteBySlug,
  cleanupSite,
} = exposeAdminApi(components.convexAnalytics, {
  auth: async () => {},
});

export const {
  getDashboardSummary,
  getOverview,
  getTimeseries,
  getEventPropertyBreakdown,
  getTopPages,
  getTopReferrers,
  getTopSources,
  getTopMediums,
  getTopCampaigns,
  getTopEvents,
  getTopDevices,
  getTopBrowsers,
  getTopOs,
  getTopCountries,
  listRawEvents,
  listPageviews,
  listSessions,
  listVisitors,
} = exposeAnalyticsApi(components.convexAnalytics, {
  auth: async () => {},
});

export const setupDefaultSite = mutation({
  args: {},
  handler: async (ctx) => {
    const writeKeyHash = await hashWriteKey(
      process.env.ANALYTICS_WRITE_KEY ?? "write_demo_local",
    );
    const existing = await ctx.runQuery(
      components.convexAnalytics.sites.getSiteBySlug,
      { slug: "default" },
    );
    if (existing) {
      if (existing.writeKeyHash !== writeKeyHash) {
        await ctx.runMutation(components.convexAnalytics.sites.rotateWriteKey, {
          siteId: existing._id,
          writeKeyHash,
        });
      }
      return existing._id;
    }
    return await ctx.runMutation(components.convexAnalytics.sites.createSite, {
      slug: "default",
      name: "Default site",
      writeKeyHash,
      allowedOrigins: [],
    });
  },
});

export const ingestExampleBatch = mutation({
  args: {
    writeKey: v.string(),
    origin: v.optional(v.string()),
    visitorId: v.string(),
    sessionId: v.string(),
    events: v.array(
      v.object({
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
        properties: v.optional(
          v.record(
            v.string(),
            v.union(v.string(), v.number(), v.boolean(), v.null()),
          ),
        ),
        userId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.convexAnalytics.ingest.ingestBatch,
      {
        writeKeyHash: await hashWriteKey(args.writeKey),
        origin: args.origin,
        visitorId: args.visitorId,
        sessionId: args.sessionId,
        events: args.events,
      },
    );
  },
});
