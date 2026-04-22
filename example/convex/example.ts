import { mutation } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import {
  exposeAdminApi,
  exposeAnalyticsApi,
} from "@Abdssamie/convex-analytics";
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
  pruneExpired,
} = exposeAdminApi(components.convexAnalytics, {
  auth: async () => {},
});

export const {
  getOverview,
  getTimeseries,
  getTopPages,
  getTopReferrers,
  getTopSources,
  getTopMediums,
  getTopCampaigns,
  getTopEvents,
  listRawEvents,
  listSessions,
} = exposeAnalyticsApi(components.convexAnalytics, {
  auth: async () => {},
});

export const setupDefaultSite = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.runMutation(components.convexAnalytics.sites.createSite, {
      slug: "default",
      name: "Default site",
      writeKeyHash: await hashWriteKey(
        process.env.ANALYTICS_WRITE_KEY ?? "write_demo_local",
      ),
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
        eventId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.convexAnalytics.ingest.ingestBatch, {
      writeKeyHash: await hashWriteKey(args.writeKey),
      origin: args.origin,
      visitorId: args.visitorId,
      sessionId: args.sessionId,
      events: args.events,
    });
  },
});
