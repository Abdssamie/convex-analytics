import { query } from "./_generated/server.js";
import type { QueryCtx } from "./_generated/server.js";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
	topRowValidator,
	propertyBreakdownRowValidator,
	paginatedEventsValidator,
	paginatedSessionsValidator,
} from "./types.js";
import type { IdOfSite } from "./types.js";
import { hourMs, dayMs } from "./constants.js";
import { floorToBucket, sumRollups } from "./helpers.js";

const scanPageSize = 256;

export const getOverview = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
	},
	returns: v.object({
		events: v.number(),
		pageviews: v.number(),
		sessions: v.number(),
		visitors: v.number(),
		bounceRate: v.number(),
		averageSessionDurationMs: v.number(),
	}),
	handler: async (ctx, args) => {
		const totals = await aggregateOverviewRange(ctx, args);
		const sessionStats = await querySessionStats(ctx, args);
		return {
			events: totals.count,
			pageviews: totals.pageviewCount,
			sessions: totals.sessionCount,
			visitors: totals.uniqueVisitorCount,
			bounceRate:
				sessionStats.sessionCount === 0
					? 0
					: sessionStats.bounceCount / sessionStats.sessionCount,
			averageSessionDurationMs:
				sessionStats.sessionCount === 0
					? 0
					: sessionStats.durationMs / sessionStats.sessionCount,
		};
	},
});

export const getTimeseries = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		interval: v.union(v.literal("hour"), v.literal("day")),
	},
	returns: v.array(
		v.object({
			bucketStart: v.number(),
			events: v.number(),
			pageviews: v.number(),
			sessions: v.number(),
			visitors: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		return await queryTimeseries(ctx, args);
	},
});

export const getTopPages = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(topRowValidator),
	handler: async (ctx, args) => {
		return await topDimension(ctx, args, "page", args.limit ?? 10);
	},
});

export const getTopReferrers = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(topRowValidator),
	handler: async (ctx, args) => {
		return await topDimension(ctx, args, "referrer", args.limit ?? 10);
	},
});

export const getTopSources = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(topRowValidator),
	handler: async (ctx, args) => {
		return await topDimension(ctx, args, "utmSource", args.limit ?? 10);
	},
});

export const getTopMediums = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(topRowValidator),
	handler: async (ctx, args) => {
		return await topDimension(ctx, args, "utmMedium", args.limit ?? 10);
	},
});

export const getTopCampaigns = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(topRowValidator),
	handler: async (ctx, args) => {
		return await topDimension(ctx, args, "utmCampaign", args.limit ?? 10);
	},
});
export const getTopEvents = query({
	args: {
		siteId: v.id("sites"),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(topRowValidator),
	handler: async (ctx, args) => {
		return await topDimension(ctx, args, "event", args.limit ?? 10);
	},
});
export const getEventPropertyBreakdown = query({
	args: {
		siteId: v.id("sites"),
		eventName: v.string(),
		propertyKey: v.string(),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(propertyBreakdownRowValidator),
	handler: async (ctx, args) => {
		return await eventPropertyBreakdown(ctx, args);
	},
});
export const listRawEvents = query({
	args: {
		siteId: v.id("sites"),
		from: v.optional(v.number()),
		to: v.optional(v.number()),
		paginationOpts: paginationOptsValidator,
	},
	returns: paginatedEventsValidator,
	handler: async (ctx, args) => {
		return await ctx.db
			.query("events")
			.withIndex("by_siteId_and_occurredAt", (q) =>
				q
					.eq("siteId", args.siteId)
					.gte("occurredAt", args.from ?? 0)
					.lt("occurredAt", args.to ?? Number.MAX_SAFE_INTEGER),
			)
			.order("desc")
			.paginate(args.paginationOpts);
	},
});
export const listSessions = query({
	args: {
		siteId: v.id("sites"),
		from: v.optional(v.number()),
		to: v.optional(v.number()),
		paginationOpts: paginationOptsValidator,
	},
	returns: paginatedSessionsValidator,
	handler: async (ctx, args) => {
		return await ctx.db
			.query("sessions")
			.withIndex("by_siteId_and_startedAt", (q) =>
				q
					.eq("siteId", args.siteId)
					.gte("startedAt", args.from ?? 0)
					.lt("startedAt", args.to ?? Number.MAX_SAFE_INTEGER),
			)
			.order("desc")
			.paginate(args.paginationOpts);
	},
});

export async function queryHourlyRollups(
	ctx: QueryCtx,
	args: { siteId: IdOfSite; from: number; to: number },
	dimension: string,
	key: string,
) {
	if (args.from >= args.to) {
		return [];
	}
	return await readAll(() =>
		ctx.db
			.query("rollupShards")
			.withIndex("by_site_interval_dimension_key_bucket", (q) =>
				q
					.eq("siteId", args.siteId)
					.eq("interval", "hour")
					.eq("dimension", dimension)
					.eq("key", key)
					.gte("bucketStart", floorToBucket(args.from, hourMs))
					.lt("bucketStart", args.to),
			),
	);
}

export async function queryDailyRollups(
	ctx: QueryCtx,
	args: { siteId: IdOfSite; from: number; to: number },
	dimension: string,
	key: string,
) {
	if (args.from >= args.to) {
		return [];
	}
	return await readAll(() =>
		ctx.db
			.query("rollupShards")
			.withIndex("by_site_interval_dimension_key_bucket", (q) =>
				q
					.eq("siteId", args.siteId)
					.eq("interval", "day")
					.eq("dimension", dimension)
					.eq("key", key)
					.gte("bucketStart", floorToBucket(args.from, dayMs))
					.lt("bucketStart", args.to),
			),
	);
}

export async function topDimension(
	ctx: QueryCtx,
	args: { siteId: IdOfSite; from: number; to: number },
	dimension: string,
	limit: number,
) {
	const plan = buildExactRangePlan(args.from, args.to);
	const byKey = new Map<string, { count: number; pageviewCount: number }>();
	for (const rawRange of plan.rawRanges) {
		const events = await queryRawEvents(ctx, {
			siteId: args.siteId,
			from: rawRange.from,
			to: rawRange.to,
		});
		for (const event of events) {
			const key = keyForEventDimension(event, dimension);
			if (!key) {
				continue;
			}
			const current = byKey.get(key) ?? { count: 0, pageviewCount: 0 };
			current.count += 1;
			current.pageviewCount += event.eventType === "pageview" ? 1 : 0;
			byKey.set(key, current);
		}
	}
	for (const hourlyRange of plan.hourlyRanges) {
		const rows = await queryDimensionRollups(ctx, {
			siteId: args.siteId,
			from: hourlyRange.from,
			to: hourlyRange.to,
			interval: "hour",
			dimension,
		});
		addTopRows(byKey, rows);
	}
	if (plan.dailyRange) {
		const rows = await queryDimensionRollups(ctx, {
			siteId: args.siteId,
			from: plan.dailyRange.from,
			to: plan.dailyRange.to,
			interval: "day",
			dimension,
		});
		addTopRows(byKey, rows);
	}

	return [...byKey.entries()]
		.map(([key, value]) => ({ key, ...value }))
		.sort((left, right) => right.count - left.count)
		.slice(0, Math.min(limit, 100));
}

async function eventPropertyBreakdown(
	ctx: QueryCtx,
	args: {
		siteId: IdOfSite;
		eventName: string;
		propertyKey: string;
		from: number;
		to: number;
		limit?: number;
	},
) {
	if (args.from >= args.to) {
		return [];
	}
	const rows = await queryRawEvents(ctx, {
		siteId: args.siteId,
		from: args.from,
		to: args.to,
	});
	const byValue = new Map<string, { value: string | number | boolean | null; count: number }>();
	for (const event of rows) {
		if (event.eventName !== args.eventName) {
			continue;
		}
		const value = event.properties?.[args.propertyKey];
		if (value === undefined) {
			continue;
		}
		const serialized = serializePropertyValue(value);
		const current = byValue.get(serialized) ?? { value, count: 0 };
		current.count += 1;
		byValue.set(serialized, current);
	}
	return [...byValue.values()]
		.sort((left, right) => right.count - left.count)
		.slice(0, Math.min(args.limit ?? 10, 100));
}

async function queryTimeseries(
	ctx: QueryCtx,
	args: { siteId: IdOfSite; from: number; to: number; interval: "hour" | "day" },
) {
	if (args.from >= args.to) {
		return [];
	}
	const bucketMs = args.interval === "hour" ? hourMs : dayMs;
	const rows =
		args.interval === "hour"
			? await queryHourlyRollups(ctx, args, "overview", "all")
			: await queryDailyRollups(ctx, args, "overview", "all");
	const byBucket = new Map<
		number,
		{ events: number; pageviews: number; sessions: number; visitors: number }
	>();
	for (const row of rows) {
		const current = byBucket.get(row.bucketStart) ?? {
			events: 0,
			pageviews: 0,
			sessions: 0,
			visitors: 0,
		};
		current.events += row.count;
		current.pageviews += row.pageviewCount;
		current.sessions += row.sessionCount;
		current.visitors += row.uniqueVisitorCount;
		byBucket.set(row.bucketStart, current);
	}
	const bucketStarts = collectBucketStarts(args.from, args.to, bucketMs);
	if (bucketStarts.length === 0) {
		return [];
	}
	const firstBucketStart = bucketStarts[0];
	const lastBucketStart = bucketStarts[bucketStarts.length - 1];
	if (args.from !== firstBucketStart) {
		byBucket.set(
			firstBucketStart,
			toTimeseriesRow(
				await aggregateOverviewRange(ctx, {
					siteId: args.siteId,
					from: args.from,
					to: Math.min(args.to, firstBucketStart + bucketMs),
				}),
			),
		);
	}
	const lastBucketEnd = lastBucketStart + bucketMs;
	if (args.to !== lastBucketEnd && lastBucketStart !== firstBucketStart) {
		byBucket.set(
			lastBucketStart,
			toTimeseriesRow(
				await aggregateOverviewRange(ctx, {
					siteId: args.siteId,
					from: Math.max(args.from, lastBucketStart),
					to: args.to,
				}),
			),
		);
	} else if (args.to !== lastBucketEnd && lastBucketStart === firstBucketStart) {
		// A single partial bucket hits both edges. Re-run the exact [from, to)
		// range so we replace the first-bucket clip above with the correct total.
		byBucket.set(
			lastBucketStart,
			toTimeseriesRow(
				await aggregateOverviewRange(ctx, {
					siteId: args.siteId,
					from: args.from,
					to: args.to,
				}),
			),
		);
	}
	return bucketStarts.map((bucketStart) => ({
		bucketStart,
		...(byBucket.get(bucketStart) ?? {
			events: 0,
			pageviews: 0,
			sessions: 0,
			visitors: 0,
		}),
	}));
}

async function aggregateOverviewRange(
	ctx: QueryCtx,
	args: { siteId: IdOfSite; from: number; to: number },
) {
	const plan = buildExactRangePlan(args.from, args.to);
	const totals = {
		count: 0,
		uniqueVisitorCount: 0,
		sessionCount: 0,
		pageviewCount: 0,
		bounceCount: 0,
		durationMs: 0,
	};
	for (const rawRange of plan.rawRanges) {
		const events = await queryRawEvents(ctx, {
			siteId: args.siteId,
			from: rawRange.from,
			to: rawRange.to,
		});
		for (const event of events) {
			totals.count += 1;
			totals.pageviewCount += event.eventType === "pageview" ? 1 : 0;
			totals.sessionCount += event.contributesSession ? 1 : 0;
			totals.uniqueVisitorCount += event.contributesVisitor ? 1 : 0;
		}
	}
	for (const hourlyRange of plan.hourlyRanges) {
		const rows = await queryHourlyRollups(ctx, {
			siteId: args.siteId,
			from: hourlyRange.from,
			to: hourlyRange.to,
		}, "overview", "all");
		const sums = sumRollups(rows);
		totals.count += sums.count;
		totals.uniqueVisitorCount += sums.uniqueVisitorCount;
		totals.sessionCount += sums.sessionCount;
		totals.pageviewCount += sums.pageviewCount;
	}
	if (plan.dailyRange) {
		const rows = await queryDailyRollups(ctx, {
			siteId: args.siteId,
			from: plan.dailyRange.from,
			to: plan.dailyRange.to,
		}, "overview", "all");
		const sums = sumRollups(rows);
		totals.count += sums.count;
		totals.uniqueVisitorCount += sums.uniqueVisitorCount;
		totals.sessionCount += sums.sessionCount;
		totals.pageviewCount += sums.pageviewCount;
	}
	return totals;
}

async function querySessionStats(
	ctx: QueryCtx,
	args: { siteId: IdOfSite; from: number; to: number },
) {
	if (args.from >= args.to) {
		return { sessionCount: 0, bounceCount: 0, durationMs: 0 };
	}
	const rows = await readAll(() =>
		ctx.db.query("sessions").withIndex("by_siteId_and_startedAt", (q) =>
			q
				.eq("siteId", args.siteId)
				.gte("startedAt", args.from)
				.lt("startedAt", args.to),
		),
	);
	return rows.reduce(
		(sum, row) => ({
			sessionCount: sum.sessionCount + 1,
			bounceCount: sum.bounceCount + (row.bounce ? 1 : 0),
			durationMs: sum.durationMs + row.durationMs,
		}),
		{ sessionCount: 0, bounceCount: 0, durationMs: 0 },
	);
}

async function queryRawEvents(
	ctx: QueryCtx,
	args: { siteId: IdOfSite; from: number; to: number },
) {
	if (args.from >= args.to) {
		return [];
	}
	return await readAll(() =>
		ctx.db.query("events").withIndex("by_siteId_and_occurredAt", (q) =>
			q
				.eq("siteId", args.siteId)
				.gte("occurredAt", args.from)
				.lt("occurredAt", args.to),
		),
	);
}

async function queryDimensionRollups(
	ctx: QueryCtx,
	args: {
		siteId: IdOfSite;
		from: number;
		to: number;
		interval: "hour" | "day";
		dimension: string;
	},
) {
	if (args.from >= args.to) {
		return [];
	}
	return await readAll(() =>
		ctx.db
			.query("rollupShards")
			.withIndex("by_site_interval_dimension_bucket", (q) =>
				q
					.eq("siteId", args.siteId)
					.eq("interval", args.interval)
					.eq("dimension", args.dimension)
					.gte("bucketStart", args.from)
					.lt("bucketStart", args.to),
			),
	);
}

type PagedQuery<T> = {
	paginate(args: { numItems: number; cursor: string | null }): Promise<{
		page: T[];
		isDone: boolean;
		continueCursor: string;
	}>;
};

async function readAll<T>(createQuery: () => PagedQuery<T>) {
	const rows: T[] = [];
	let cursor: string | null = null;
	while (true) {
		const page = await createQuery().paginate({
			numItems: scanPageSize,
			cursor,
		});
		rows.push(...(page.page as T[]));
		if (page.isDone) {
			return rows;
		}
		cursor = page.continueCursor;
	}
}

function buildExactRangePlan(from: number, to: number) {
	const rawRanges: Array<{ from: number; to: number }> = [];
	if (from >= to) {
		return {
			rawRanges,
			hourlyRanges: [] as Array<{ from: number; to: number }>,
			dailyRange: null as null | { from: number; to: number },
		};
	}
	const firstFullHour = ceilToBucket(from, hourMs);
	const rawHeadEnd = Math.min(to, firstFullHour);
	addRange(rawRanges, from, rawHeadEnd);

	const hourlyStart = rawHeadEnd;
	const rawTailStartBase = floorToBucket(to, hourMs);
	const hourlyEnd = Math.min(to, rawTailStartBase);

	const hourlyRanges: Array<{ from: number; to: number }> = [];
	let dailyRange: null | { from: number; to: number } = null;
	if (hourlyStart < hourlyEnd) {
		const firstFullDay = ceilToBucket(hourlyStart, dayMs);
		const lastFullDay = floorToBucket(hourlyEnd, dayMs);
		addRange(hourlyRanges, hourlyStart, Math.min(hourlyEnd, firstFullDay));
		if (firstFullDay < lastFullDay) {
			dailyRange = { from: firstFullDay, to: lastFullDay };
		}
		addRange(hourlyRanges, Math.max(hourlyStart, lastFullDay), hourlyEnd);
	}

	const rawTailStart = Math.max(rawHeadEnd, rawTailStartBase);
	addRange(rawRanges, rawTailStart, to);

	return { rawRanges, hourlyRanges, dailyRange };
}

function addRange(
	ranges: Array<{ from: number; to: number }>,
	from: number,
	to: number,
) {
	if (from < to) {
		ranges.push({ from, to });
	}
}

function ceilToBucket(value: number, bucketMs: number) {
	return floorToBucket(value + bucketMs - 1, bucketMs);
}

function collectBucketStarts(from: number, to: number, bucketMs: number) {
	if (from >= to) {
		return [];
	}
	const starts: number[] = [];
	for (
		let bucketStart = floorToBucket(from, bucketMs);
		bucketStart < to;
		bucketStart += bucketMs
	) {
		starts.push(bucketStart);
	}
	return starts;
}

function toTimeseriesRow(row: {
	count: number;
	pageviewCount: number;
	sessionCount: number;
	uniqueVisitorCount: number;
}) {
	return {
		events: row.count,
		pageviews: row.pageviewCount,
		sessions: row.sessionCount,
		visitors: row.uniqueVisitorCount,
	};
}

function keyForEventDimension(
	event: {
		eventName: string;
		eventType: "pageview" | "track" | "identify";
		path?: string;
		referrer?: string;
		utmSource?: string;
		utmMedium?: string;
		utmCampaign?: string;
	},
	dimension: string,
) {
	switch (dimension) {
		case "event":
			return event.eventName;
		case "page":
			return event.eventType === "pageview" ? event.path : undefined;
		case "referrer":
			return event.referrer;
		case "utmSource":
			return event.utmSource;
		case "utmMedium":
			return event.utmMedium;
		case "utmCampaign":
			return event.utmCampaign;
		default:
			return undefined;
	}
}

function addTopRows(
	byKey: Map<string, { count: number; pageviewCount: number }>,
	rows: Array<{ key: string; count: number; pageviewCount: number }>,
) {
	for (const row of rows) {
		const current = byKey.get(row.key) ?? { count: 0, pageviewCount: 0 };
		current.count += row.count;
		current.pageviewCount += row.pageviewCount;
		byKey.set(row.key, current);
	}
}

function serializePropertyValue(value: string | number | boolean | null) {
	return value === null ? "null" : `${typeof value}:${String(value)}`;
}
