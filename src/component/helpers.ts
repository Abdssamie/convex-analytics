import type { SiteSettings, SiteSettingsArgs } from "./types";
import {
	defaultSettings,
	dayMs,
	maxPropertyKeys,
} from "./constants";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export function siteSettingsFromArgs(
	args: SiteSettingsArgs,
	existing?: SiteSettings,
): SiteSettings {
	const retentionDays =
		args.retentionDays ??
		existing?.retentionDays ??
		defaultSettings.retentionDays;
	return {
		sessionTimeoutMs:
			args.sessionTimeoutMs ??
			existing?.sessionTimeoutMs ??
			defaultSettings.sessionTimeoutMs,
		retentionDays,
		rawEventRetentionDays:
			args.rawEventRetentionDays ??
			existing?.rawEventRetentionDays ??
			retentionDays,
		hourlyRollupRetentionDays:
			args.hourlyRollupRetentionDays ??
			existing?.hourlyRollupRetentionDays ??
			retentionDays,
		dailyRollupRetentionDays:
			args.dailyRollupRetentionDays ?? existing?.dailyRollupRetentionDays,
		allowedPropertyKeys:
			args.allowedPropertyKeys ?? existing?.allowedPropertyKeys,
		deniedPropertyKeys: args.deniedPropertyKeys ?? existing?.deniedPropertyKeys,
	};
}

export function sameSiteSettings(left: SiteSettings, right: SiteSettings) {
	return (
		left.sessionTimeoutMs === right.sessionTimeoutMs &&
		left.retentionDays === right.retentionDays &&
		left.rawEventRetentionDays === right.rawEventRetentionDays &&
		left.hourlyRollupRetentionDays === right.hourlyRollupRetentionDays &&
		left.dailyRollupRetentionDays === right.dailyRollupRetentionDays &&
		sameOptionalStringArray(
			left.allowedPropertyKeys,
			right.allowedPropertyKeys,
		) &&
		sameOptionalStringArray(left.deniedPropertyKeys, right.deniedPropertyKeys)
	);
}

export function daysToMs(days: number) {
	return days * dayMs;
}

export function normalizeEventName(event: {
	type: "pageview" | "track" | "identify";
	name?: string;
}) {
	if (event.type === "pageview") {
		return "pageview";
	}

	if (event.type === "identify") {
		return "identify";
	}

	return event.name?.trim() || null;
}

export function sameOptionalStringArray(left?: string[], right?: string[]) {
	if (!left && !right) {
		return true;
	}

	if (!left || !right) {
		return false;
	}

	return sameStringArray(left, right);
}

export function sameStringArray(left: string[], right: string[]) {
	if (left.length !== right.length) {
		return false;
	}

	return left.every((value, index) => value === right[index]);
}

export function sanitizeProperties(
	properties: Record<string, string | number | boolean | null> | undefined,
	settings: {
		allowedPropertyKeys?: string[];
		deniedPropertyKeys?: string[];
	},
) {
	if (!properties) {
		return undefined;
	}

	const allowed = settings.allowedPropertyKeys
		? new Set(settings.allowedPropertyKeys)
		: null;
	const denied = new Set(settings.deniedPropertyKeys ?? []);
	const output: Record<string, string | number | boolean | null> = {};
	for (const [key, value] of Object.entries(properties).slice(
		0,
		maxPropertyKeys,
	)) {
		if (allowed && !allowed.has(key)) {
			continue;
		}
		if (denied.has(key)) {
			continue;
		}
		output[key] = value;
	}

	return output;
}

export function firstPagePath(events: Array<{ type: string; path?: string }>) {
	return events.find((event) => event.type === "pageview" && event.path)?.path;
}

export function firstReferrer(events: Array<{ referrer?: string }>) {
	return events.find((event) => event.referrer)?.referrer;
}

export function latestIdentifyTraits(
	events: Array<{
		type: string;
		properties?: Record<string, string | number | boolean | null>;
	}>,
) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event.type === "identify") {
			return event.properties;
		}
	}

	return undefined;
}

export function floorToBucket(value: number, bucketMs: number) {
	return Math.floor(value / bucketMs) * bucketMs;
}

export async function deleteRows(
	ctx: MutationCtx,
	rows: Array<{
		_id: Id<"events"> | Id<"rollups">;
	}>,
) {
	for (const row of rows) {
		await ctx.db.delete(row._id);
	}
}

export async function resolveSite(
	ctx: MutationCtx,
	args: { siteId?: Id<"sites">; slug?: string },
) {
	if (args.siteId) {
		const site = await ctx.db.get(args.siteId);
		if (!site) {
			throw new Error("Site not found");
		}
		return site;
	}

	if (args.slug) {
		const site = await ctx.db
			.query("sites")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug!))
			.unique();
		if (!site) {
			throw new Error("Site not found");
		}
		return site;
	}

	throw new Error("siteId or slug is required");
}

export async function manualPaginate<T extends { _id: any }>(
	query: any,
	paginationOpts: { numItems: number; cursor: string | null },
): Promise<{ page: T[]; isDone: boolean; continueCursor: string | null }> {
	let q = query;
	if (paginationOpts.cursor) {
		q = q.startAfter(paginationOpts.cursor);
	}
	// Fetch one extra item to determine if there's a next page
	const page: T[] = await q.take(paginationOpts.numItems + 1);
	const isDone = page.length <= paginationOpts.numItems;
	const results = isDone ? page : page.slice(0, paginationOpts.numItems);
	const continueCursor = isDone ? null : results[results.length - 1]._id;

	return {
		page: results,
		isDone,
		continueCursor,
	};
}

export function sumRollups(
	rows: Array<{
		count: number;
		pageviewCount: number;
		visitorCount?: number;
		sessionCount?: number;
		bounceCount: number;
		durationMs: number;
	}>,
) {
	return rows.reduce(
		(
			sum: {
				count: number;
				pageviewCount: number;
				visitorCount: number;
				sessionCount: number;
				bounceCount: number;
				durationMs: number;
			},
			row,
		) => ({
			count: sum.count + row.count,
			pageviewCount: sum.pageviewCount + row.pageviewCount,
			visitorCount: sum.visitorCount + (row.visitorCount ?? 0),
			sessionCount: sum.sessionCount + (row.sessionCount ?? 0),
			bounceCount: sum.bounceCount + row.bounceCount,
			durationMs: sum.durationMs + row.durationMs,
		}),
		{
			count: 0,
			pageviewCount: 0,
			visitorCount: 0,
			sessionCount: 0,
			bounceCount: 0,
			durationMs: 0,
		},
	);
}
