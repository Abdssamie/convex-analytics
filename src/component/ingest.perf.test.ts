import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel.js";
import {
	accumulateRollupShards,
	flushRollupShards,
} from "./ingest.js";

type RollupRow = {
	_id: Id<"rollupShards">;
	siteId: Id<"sites">;
	interval: "hour" | "day";
	bucketStart: number;
	dimension: string;
	key: string;
	shard: number;
	count: number;
	pageviewCount: number;
	bounceCount: number;
	durationMs: number;
	updatedAt: number;
};

function rollupStoreKey(args: {
	siteId: Id<"sites">;
	interval: "hour" | "day";
	bucketStart: number;
	dimension: string;
	key: string;
	shard: number;
}) {
	return [
		args.siteId,
		args.interval,
		args.bucketStart,
		args.dimension,
		args.key,
		args.shard,
	].join("|");
}

function createRollupCtx() {
	let nextId = 0;
	const rows = new Map<string, RollupRow>();
	const stats = {
		uniqueCalls: 0,
		insertCalls: 0,
		patchCalls: 0,
	};

	const ctx = {
		db: {
			query(table: string) {
				expect(table).toBe("rollupShards");
				return {
					withIndex(indexName: string, builder: (q: {
						eq: (field: string, value: string | number) => unknown;
					}) => unknown) {
						expect(indexName).toBe(
							"by_site_interval_dimension_key_bucket_shard",
						);
						const filters: Record<string, string | number> = {};
						const q = {
							eq(field: string, value: string | number) {
								filters[field] = value;
								return q;
							},
						};
						builder(q);
						return {
							async unique() {
								stats.uniqueCalls += 1;
								return (
									rows.get(
										rollupStoreKey({
											siteId: filters.siteId as Id<"sites">,
											interval: filters.interval as "hour" | "day",
											bucketStart: filters.bucketStart as number,
											dimension: filters.dimension as string,
											key: filters.key as string,
											shard: filters.shard as number,
										}),
									) ?? null
								);
							},
						};
					},
				};
			},
			async insert(table: string, value: Omit<RollupRow, "_id">) {
				expect(table).toBe("rollupShards");
				stats.insertCalls += 1;
				const row = {
					...value,
					_id: `rollup-${nextId += 1}` as Id<"rollupShards">,
				};
				rows.set(rollupStoreKey(row), row);
				return row._id;
			},
			async patch(id: Id<"rollupShards">, value: Partial<RollupRow>) {
				stats.patchCalls += 1;
				const row = [...rows.values()].find((candidate) => candidate._id === id);
				if (!row) {
					throw new Error(`Missing rollup row: ${id}`);
				}
				Object.assign(row, value);
			},
		},
	};

	return { ctx, rows, stats };
}

describe("rollup write-path benchmark", () => {
	test("high fanout batch collapses rollup DB writes to unique shard keys", async () => {
		const siteId = "site_perf" as Id<"sites">;
		const occurredAt = Date.UTC(2026, 0, 20, 12, 0, 0);
		const updatedAt = Date.UTC(2026, 0, 20, 12, 5, 0);
		const shard = 2;
		const eventCount = 1_000;
		const deltas = new Map();

		for (let index = 0; index < eventCount; index += 1) {
			accumulateRollupShards(deltas, {
				siteId,
				occurredAt,
				eventName: "pageview",
				eventType: "pageview",
				path: "/pricing",
				referrer: "https://google.com",
				utmSource: "newsletter",
				utmCampaign: "spring-launch",
				receivedAt: updatedAt,
				newVisitor: true,
				newSession: true,
				shard,
			});
		}

		const uniqueKeys = deltas.size;
		expect(uniqueKeys).toBe(12);

		const firstPass = createRollupCtx();
		await flushRollupShards(firstPass.ctx as never, deltas);

		expect(firstPass.stats.uniqueCalls).toBe(uniqueKeys);
		expect(firstPass.stats.insertCalls).toBe(uniqueKeys);
		expect(firstPass.stats.patchCalls).toBe(0);

		const hourlyOverview = firstPass.rows.get(
			rollupStoreKey({
				siteId,
				interval: "hour",
				bucketStart: occurredAt,
				dimension: "overview",
				key: "all",
				shard,
			}),
		);
		expect(hourlyOverview).toMatchObject({
			count: eventCount,
			pageviewCount: eventCount,
		});

		const secondPass = createRollupCtx();
		for (const row of firstPass.rows.values()) {
			secondPass.rows.set(rollupStoreKey(row), { ...row });
		}
		await flushRollupShards(secondPass.ctx as never, deltas);

		expect(secondPass.stats.uniqueCalls).toBe(uniqueKeys);
		expect(secondPass.stats.insertCalls).toBe(0);
		expect(secondPass.stats.patchCalls).toBe(uniqueKeys);

		const naiveReads = eventCount * uniqueKeys;
		const naiveWrites = eventCount * uniqueKeys;
		expect(naiveReads / secondPass.stats.uniqueCalls).toBe(eventCount);
		expect(naiveWrites / secondPass.stats.patchCalls).toBe(eventCount);
	});
});
