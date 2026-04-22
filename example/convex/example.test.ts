import { describe, expect, test, vi } from "vitest";
import { initConvexTest } from "./setup.test";
import { api } from "./_generated/api";

describe("example", () => {
  test("bootstraps default site once", async () => {
    const t = initConvexTest();

    const siteId = await t.mutation(api.example.setupDefaultSite, {});
    expect(siteId).toBeDefined();

    const site = await t.query(api.example.getSiteBySlug, {
      slug: "default",
    });
    expect(site?._id).toBe(siteId);
    expect(site?.name).toBe("Default site");
    expect(site?.writeKeyHash).not.toBe("write_demo_local");
  });

  test("reconciles the default site write key on repeated setup", async () => {
    vi.stubEnv("ANALYTICS_WRITE_KEY", "write_first");
    const t = initConvexTest();

    const siteId = await t.mutation(api.example.setupDefaultSite, {});

    vi.stubEnv("ANALYTICS_WRITE_KEY", "write_second");
    const repeatedSiteId = await t.mutation(api.example.setupDefaultSite, {});

    expect(repeatedSiteId).toBe(siteId);

    const result = await t.mutation(api.example.ingestExampleBatch, {
      writeKey: "write_second",
      visitorId: "visitor-1",
      sessionId: "session-1",
      events: [{ type: "pageview", path: "/" }],
    });

    expect(result).toEqual({ accepted: 1, rejected: 0 });
    vi.unstubAllEnvs();
  });

  test("creates a site and ingests events through app wrappers", async () => {
    vi.useFakeTimers();
    try {
    const t = initConvexTest();
    const siteId = await t.mutation(api.example.createSite, {
      slug: "default",
      name: "Default site",
      writeKey: "write_test",
      allowedOrigins: ["https://app.example.com"],
    });

    const now = Date.UTC(2026, 0, 1, 12);
    const result = await t.mutation(api.example.ingestExampleBatch, {
      writeKey: "write_test",
      origin: "https://app.example.com",
      visitorId: "visitor-1",
      sessionId: "session-1",
      events: [
        { type: "pageview", path: "/", occurredAt: now },
      ],
    });
    expect(result.accepted).toBe(1);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    const overview = await t.query(api.example.getOverview, {
      siteId,
      from: now - 1000,
      to: now + 24 * 60 * 60 * 1000,
    });
    expect(overview.pageviews).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
