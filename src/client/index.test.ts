import { anyApi, type ApiFromModules } from "convex/server";
import { describe, expect, test } from "vitest";
import { components, initConvexTest } from "./setup.test.js";
import { exposeApi } from "./index.js";

export const { createSite, getSiteBySlug } = exposeApi(
  components.convexAnalytics,
  {
    auth: async () => {},
  },
);

const testApi = (
  anyApi as unknown as ApiFromModules<{
    "index.test": {
      createSite: typeof createSite;
      getSiteBySlug: typeof getSiteBySlug;
    };
  }>
)["index.test"];

describe("client helpers", () => {
  test("wraps site admin functions", async () => {
    const t = initConvexTest();
    const siteId = await t.mutation(testApi.createSite, {
      slug: "default",
      name: "Default site",
      writeKey: "write_test",
    });
    expect(siteId).toBeDefined();

    const site = await t.query(testApi.getSiteBySlug, {
      slug: "default",
    });
    expect(site?.name).toBe("Default site");
    expect(site?.writeKeyHash).not.toBe("write_test");
  });
});
