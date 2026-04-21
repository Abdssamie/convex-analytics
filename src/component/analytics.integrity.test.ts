import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";
import { hourMs } from "./constants.js";

describe("analytics integrity regressions", () => {
	test(
		"analytics scans past old rollup take limits without dropping buckets",
		async () => {
			const t = initConvexTest();
			const siteId = await t.mutation(api.sites.createSite, {
				slug: `site-${Math.random().toString(36).slice(2, 8)}`,
				name: "Integrity Test",
				writeKeyHash: "write_test",
			});
			const firstBucketStart = Date.UTC(2026, 0, 7, 0, 0, 0);
			const rowCount = 12_001;
			const shardsPerBucket = 6;

			await t.run(async (ctx) => {
				for (let index = 0; index < rowCount; index += 1) {
					await ctx.db.insert("rollupShards", {
						siteId,
						interval: "hour",
						bucketStart: firstBucketStart,
						dimension: "overview",
						key: "all",
						shard: index % shardsPerBucket,
						count: 1,
						uniqueVisitorCount: 0,
						sessionCount: 0,
						pageviewCount: 1,
						bounceCount: 0,
						durationMs: 0,
						updatedAt: firstBucketStart + index,
					});
				}
			});

			const from = firstBucketStart;
			const to = firstBucketStart + hourMs;
			const overview = await t.query(api.analytics.getOverview, {
				siteId,
				from,
				to,
			});
			expect(overview).toMatchObject({
				events: rowCount,
				pageviews: rowCount,
				sessions: 0,
				visitors: 0,
			});

			const timeseries = await t.query(api.analytics.getTimeseries, {
				siteId,
				from,
				to,
				interval: "hour",
			});
			expect(timeseries).toHaveLength(1);
			expect(timeseries[0]).toEqual({
				bucketStart: firstBucketStart,
				events: rowCount,
				pageviews: rowCount,
				sessions: 0,
				visitors: 0,
			});
		},
		30_000,
	);
});
