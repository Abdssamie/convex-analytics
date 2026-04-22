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
			await t.run(async (ctx) => {
				await ctx.db.insert("rollups", {
					siteId,
					interval: "hour",
					bucketStart: firstBucketStart,
					dimension: "overview",
					key: "all",
					count: rowCount,
					pageviewCount: rowCount,
					bounceCount: 0,
					durationMs: 0,
					updatedAt: firstBucketStart,
				});
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

	test(
		"partial-hour top sources use full-hour rollup plus small prefix correction",
		async () => {
			const t = initConvexTest();
			const siteId = await t.mutation(api.sites.createSite, {
				slug: `site-${Math.random().toString(36).slice(2, 8)}`,
				name: "Edge Hour Test",
				writeKeyHash: "write_edge_hour",
			});
			const bucketStart = Date.UTC(2026, 0, 8, 12, 0, 0);
			const queryFrom = bucketStart + 15 * 60 * 1000;
			const queryTo = bucketStart + hourMs;
			const prefixEnd = queryFrom;

			await t.run(async (ctx) => {
				await ctx.db.insert("rollups", {
					siteId,
					interval: "hour",
					bucketStart,
					dimension: "utmSource",
					key: "newsletter",
					count: 36_000,
					pageviewCount: 0,
					bounceCount: 0,
					durationMs: 0,
					updatedAt: bucketStart,
				});
				await ctx.db.insert("rollups", {
					siteId,
					interval: "hour",
					bucketStart,
					dimension: "utmSource",
					key: "ads",
					count: 12_000,
					pageviewCount: 0,
					bounceCount: 0,
					durationMs: 0,
					updatedAt: bucketStart,
				});

				for (let index = 0; index < 9_000; index += 1) {
					await ctx.db.insert("events", {
						siteId,
						receivedAt: bucketStart + index,
						occurredAt: bucketStart + Math.floor((index * 15 * 60 * 1000) / 9_000),
						visitorId: `newsletter-visitor-${index}`,
						sessionId: `newsletter-session-${index}`,
						eventType: "track",
						eventName: "signup_click",
						utmSource: "newsletter",
					});
				}
				for (let index = 0; index < 3_000; index += 1) {
					await ctx.db.insert("events", {
						siteId,
						receivedAt: prefixEnd + index,
						occurredAt: bucketStart + Math.floor((index * 15 * 60 * 1000) / 3_000),
						visitorId: `ads-visitor-${index}`,
						sessionId: `ads-session-${index}`,
						eventType: "track",
						eventName: "signup_click",
						utmSource: "ads",
					});
				}
			});

			const topSources = await t.query(api.analytics.getTopSources, {
				siteId,
				from: queryFrom,
				to: queryTo,
				limit: 10,
			});
			expect(topSources).toEqual([
				{ key: "newsletter", count: 27_000, pageviewCount: 0 },
				{ key: "ads", count: 9_000, pageviewCount: 0 },
			]);
		},
		30_000,
	);

	test(
		"partial-hour overview uses full-hour rollup plus small prefix correction",
		async () => {
			const t = initConvexTest();
			const siteId = await t.mutation(api.sites.createSite, {
				slug: `site-${Math.random().toString(36).slice(2, 8)}`,
				name: "Edge Overview Test",
				writeKeyHash: "write_edge_overview",
			});
			const bucketStart = Date.UTC(2026, 0, 8, 14, 0, 0);
			const queryFrom = bucketStart + 15 * 60 * 1000;
			const queryTo = bucketStart + hourMs;

			await t.run(async (ctx) => {
				await ctx.db.insert("rollups", {
					siteId,
					interval: "hour",
					bucketStart,
					dimension: "overview",
					key: "all",
					count: 36_000,
					pageviewCount: 24_000,
					bounceCount: 0,
					durationMs: 0,
					updatedAt: bucketStart,
				});

				for (let index = 0; index < 9_000; index += 1) {
					const occurredAt =
						bucketStart + Math.floor((index * 15 * 60 * 1000) / 9_000);
					await ctx.db.insert("events", {
						siteId,
						receivedAt: bucketStart + index,
						occurredAt,
						visitorId: `visitor-${index}`,
						sessionId: `session-${index}`,
						eventType: index % 3 === 0 ? "pageview" : "track",
						eventName: index % 3 === 0 ? "pageview" : "signup_click",
					});
					if (index % 3 === 0) {
						await ctx.db.insert("visitors", {
							siteId,
							visitorId: `visitor-${index}`,
							firstSeenAt: occurredAt,
							lastSeenAt: occurredAt,
						});
					}
					if (index % 2 === 0) {
						await ctx.db.insert("sessions", {
							siteId,
							visitorId: `visitor-${index}`,
							sessionId: `session-${index}`,
							startedAt: occurredAt,
							lastSeenAt: occurredAt,
							pageviewCount: index % 3 === 0 ? 1 : 0,
						});
					}
				}

				for (let index = 0; index < 9_000; index += 1) {
					const firstSeenAt =
						queryFrom +
						Math.floor((index * (queryTo - queryFrom - 1)) / 9_000);
					await ctx.db.insert("visitors", {
						siteId,
						visitorId: `rolled-visitor-${index}`,
						firstSeenAt,
						lastSeenAt: firstSeenAt,
					});
				}

				for (let index = 0; index < 13_500; index += 1) {
					const startedAt =
						queryFrom +
						Math.floor((index * (queryTo - queryFrom - 1)) / 13_500);
					await ctx.db.insert("sessions", {
						siteId,
						visitorId: `rolled-visitor-${index % 9_000}`,
						sessionId: `rolled-session-${index}`,
						startedAt,
						lastSeenAt: startedAt,
						pageviewCount: 1,
					});
				}
			});

			const overview = await t.query(api.analytics.getOverview, {
				siteId,
				from: queryFrom,
				to: queryTo,
			});
			expect(overview).toMatchObject({
				events: 27_000,
				visitors: 9_000,
				sessions: 13_500,
				pageviews: 21_000,
			});

			const timeseries = await t.query(api.analytics.getTimeseries, {
				siteId,
				from: queryFrom,
				to: queryTo,
				interval: "hour",
			});
			expect(timeseries).toEqual([
				{
					bucketStart,
					events: 27_000,
					pageviews: 21_000,
					sessions: 13_500,
					visitors: 9_000,
				},
			]);
		},
		30_000,
	);
});
