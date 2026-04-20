import { anyApi, type ApiFromModules } from "convex/server";
import { describe, expect, test } from "vitest";
import { components, initConvexTest } from "./setup.test.js";
import { exposeAdminApi, exposeAnalyticsApi } from "./index.js";

export const { createSite, getSiteBySlug } = exposeAdminApi(
	components.convexAnalytics,
	{
		auth: async () => {},
	},
);
export const { getOverview } = exposeAnalyticsApi(components.convexAnalytics, {
	auth: async () => {},
});

const testApi = (
	anyApi as unknown as ApiFromModules<{
		"index.test": {
			createSite: typeof createSite;
			getSiteBySlug: typeof getSiteBySlug;
			getOverview: typeof getOverview;
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

		const overview = await t.query(testApi.getOverview, {
			siteId,
			from: 0,
			to: Date.now(),
		});
		expect(overview.events).toBe(0);
	});
});
