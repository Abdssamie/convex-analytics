import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";
import { dayMs } from "./constants.js";

describe("maintenance cleanup", () => {
	test("cleanupSite keeps one invocation bounded and schedules follow-up work", async () => {
		const t = initConvexTest();
		vi.useFakeTimers();
		const siteId = await t.mutation(api.sites.createSite, {
			slug: `site-${Math.random().toString(36).slice(2, 8)}`,
			name: "Cleanup Test",
			writeKeyHash: "write_test",
			retentionDays: 90,
			rawEventRetentionDays: 30,
		});
		const now = Date.UTC(2026, 0, 20, 12, 0, 0);
		const oldOccurredAt = now - 31 * dayMs;
		const recentOccurredAt = now - 5 * dayMs;

		await t.run(async (ctx) => {
			for (let index = 0; index < 250; index += 1) {
				await ctx.db.insert("events", {
					siteId,
					receivedAt: oldOccurredAt,
					occurredAt: oldOccurredAt + index,
					visitorId: `old-visitor-${index}`,
					sessionId: `old-session-${index}`,
					eventType: "track",
					eventName: "old_event",
					aggregatedAt: oldOccurredAt + index,
				});
			}
			await ctx.db.insert("events", {
				siteId,
				receivedAt: recentOccurredAt,
				occurredAt: recentOccurredAt,
				visitorId: "recent-visitor",
				sessionId: "recent-session",
				eventType: "track",
				eventName: "recent_event",
				aggregatedAt: recentOccurredAt,
			});
			await ctx.db.insert("events", {
				siteId,
				receivedAt: oldOccurredAt,
				occurredAt: oldOccurredAt - 1,
				visitorId: "pending-visitor",
				sessionId: "pending-session",
				eventType: "track",
				eventName: "pending_event",
				aggregatedAt: null,
			});
		});

		const result = await t.action(api.maintenance.cleanupSite, {
			siteId,
			now,
			limit: 100,
			runUntilComplete: true,
		});
		expect(result).toEqual({
			events: 100,
			hourlyRollups: 0,
			dailyRollups: 0,
			hasMore: true,
		});

		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		const remainingEvents = await t.run(async (ctx) => {
			return await ctx.db
				.query("events")
				.withIndex("by_siteId_and_occurredAt", (q) => q.eq("siteId", siteId))
				.take(300);
		});
		expect(remainingEvents).toHaveLength(1);
		expect(remainingEvents.map((row) => row.eventName)).toEqual([
			"recent_event",
		]);
		vi.useRealTimers();
	});

	test("cleanupSite treats limit as one shared cleanup budget", async () => {
		const t = initConvexTest();
		const siteId = await t.mutation(api.sites.createSite, {
			slug: `site-${Math.random().toString(36).slice(2, 8)}`,
			name: "Cleanup Budget Test",
			writeKeyHash: "write_test",
			retentionDays: 90,
			rawEventRetentionDays: 30,
			hourlyRollupRetentionDays: 30,
			dailyRollupRetentionDays: 30,
		});
		const now = Date.UTC(2026, 0, 20, 12, 0, 0);
		const oldOccurredAt = now - 31 * dayMs;

		await t.run(async (ctx) => {
			for (let index = 0; index < 60; index += 1) {
				await ctx.db.insert("events", {
					siteId,
					receivedAt: oldOccurredAt,
					occurredAt: oldOccurredAt + index,
					visitorId: `old-visitor-${index}`,
					sessionId: `old-session-${index}`,
					eventType: "track",
					eventName: "old_event",
					aggregatedAt: oldOccurredAt + index,
				});
			}

			for (let index = 0; index < 60; index += 1) {
				await ctx.db.insert("rollups", {
					siteId,
					interval: "hour",
					bucketStart: oldOccurredAt - index * dayMs,
					dimension: "event",
					key: `hour-${index}`,
					count: 1,
					pageviewCount: 0,
					bounceCount: 0,
					durationMs: 0,
					updatedAt: oldOccurredAt,
				});
			}

			for (let index = 0; index < 60; index += 1) {
				await ctx.db.insert("rollups", {
					siteId,
					interval: "day",
					bucketStart: oldOccurredAt - index * dayMs,
					dimension: "event",
					key: `day-${index}`,
					count: 1,
					pageviewCount: 0,
					bounceCount: 0,
					durationMs: 0,
					updatedAt: oldOccurredAt,
				});
			}
		});

		const result = await t.action(api.maintenance.cleanupSite, {
			siteId,
			now,
			limit: 100,
			runUntilComplete: false,
		});
		expect(result).toEqual({
			events: 60,
			hourlyRollups: 40,
			dailyRollups: 0,
			hasMore: true,
		});
	});
});
