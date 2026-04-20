import { mutation } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { exposeApi } from "@Abdssamie/convex-analytics";
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
  ensureSite,
  updateSite,
  rotateWriteKey,
  aggregatePending,
  getSiteBySlug,
  getOverview,
  getTimeseries,
  getTopPages,
  getTopReferrers,
  getTopCampaigns,
  getTopEvents,
  listRawEvents,
  listSessions,
} = exposeApi(components.convexAnalytics, {
  auth: async () => {},
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
