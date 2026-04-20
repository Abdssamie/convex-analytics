/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("component lib", () => {
  test("ingests batched analytics events and reads core reports", async () => {
    const t = initConvexTest();
    const siteId = await t.mutation(api.lib.createSite, {
      slug: "default",
      name: "Default site",
      writeKeyHash: "test-hash",
      allowedOrigins: ["https://app.example.com"],
    });

    const now = Date.UTC(2026, 0, 1, 12);
    const result = await t.mutation(api.lib.ingestBatch, {
      writeKeyHash: "test-hash",
      origin: "https://app.example.com",
      visitorId: "visitor-1",
      sessionId: "session-1",
      context: { source: "browser", utmCampaign: "launch" },
      events: [
        {
          type: "pageview",
          occurredAt: now,
          path: "/",
          title: "Home",
          eventId: "event-1",
        },
        {
          type: "track",
          name: "signup_clicked",
          occurredAt: now + 1000,
          path: "/",
          properties: { plan: "pro" },
          eventId: "event-2",
        },
      ],
    });

    expect(result).toEqual({ accepted: 2, duplicate: 0, rejected: 0 });
    await t.mutation(api.lib.aggregatePending, {
      siteId,
      now: now + 2000,
    });

    const overview = await t.query(api.lib.getOverview, {
      siteId,
      from: now - 1000,
      to: now + 24 * 60 * 60 * 1000,
    });
    expect(overview.events).toBe(2);
    expect(overview.pageviews).toBe(1);
    expect(overview.sessions).toBe(1);
    expect(overview.visitors).toBe(1);

    const topPages = await t.query(api.lib.getTopPages, {
      siteId,
      from: now - 1000,
      to: now + 24 * 60 * 60 * 1000,
    });
    expect(topPages).toEqual([{ key: "/", count: 1, pageviewCount: 1 }]);

    const events = await t.query(api.lib.listRawEvents, { siteId });
    expect(events).toHaveLength(2);
  });

  test("dedupes retried events", async () => {
    const t = initConvexTest();
    await t.mutation(api.lib.createSite, {
      slug: "default",
      name: "Default site",
      writeKeyHash: "test-hash",
    });

    const payload = {
      writeKeyHash: "test-hash",
      visitorId: "visitor-1",
      sessionId: "session-1",
      events: [
        {
          type: "track" as const,
          name: "clicked",
          eventId: "same-event",
        },
      ],
    };

    expect(await t.mutation(api.lib.ingestBatch, payload)).toMatchObject({
      accepted: 1,
      duplicate: 0,
    });
    expect(await t.mutation(api.lib.ingestBatch, payload)).toMatchObject({
      accepted: 0,
      duplicate: 1,
    });
  });
});
