import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const propertyValue = v.union(
	v.string(),
	v.number(),
	v.boolean(),
	v.null(),
);
export const propertiesValidator = v.optional(
	v.record(v.string(), propertyValue),
);
export const eventInputValidator = v.object({
	type: v.union(
		v.literal("pageview"),
		v.literal("track"),
		v.literal("identify"),
	),
	name: v.optional(v.string()),
	occurredAt: v.optional(v.number()),
	path: v.optional(v.string()),
	title: v.optional(v.string()),
	referrer: v.optional(v.string()),
	properties: propertiesValidator,
	userId: v.optional(v.string()),
});
export const contextValidator = v.optional(
	v.object({
		source: v.optional(v.string()),
		device: v.optional(v.string()),
		browser: v.optional(v.string()),
		os: v.optional(v.string()),
		country: v.optional(v.string()),
		utmSource: v.optional(v.string()),
		utmMedium: v.optional(v.string()),
		utmCampaign: v.optional(v.string()),
	}),
);
export const siteValidator = v.object({
	_id: v.id("sites"),
	_creationTime: v.number(),
	slug: v.string(),
	name: v.string(),
	status: v.union(v.literal("active"), v.literal("disabled")),
	writeKeyHash: v.string(),
	allowedOrigins: v.array(v.string()),
	settings: v.object({
		sessionTimeoutMs: v.number(),
		retentionDays: v.number(),
		rawEventRetentionDays: v.optional(v.number()),
		hourlyRollupRetentionDays: v.optional(v.number()),
		dailyRollupRetentionDays: v.optional(v.number()),
		rollupShardCount: v.optional(v.number()),
		allowedPropertyKeys: v.optional(v.array(v.string())),
		deniedPropertyKeys: v.optional(v.array(v.string())),
	}),
	createdAt: v.number(),
	updatedAt: v.number(),
});
export const eventValidator = v.object({
	_id: v.id("events"),
	_creationTime: v.number(),
	siteId: v.id("sites"),
	receivedAt: v.number(),
	occurredAt: v.number(),
	visitorId: v.string(),
	sessionId: v.string(),
	eventType: v.union(
		v.literal("pageview"),
		v.literal("track"),
		v.literal("identify"),
	),
	eventName: v.string(),
	path: v.optional(v.string()),
	title: v.optional(v.string()),
	referrer: v.optional(v.string()),
	source: v.optional(v.string()),
	utmSource: v.optional(v.string()),
	utmMedium: v.optional(v.string()),
	utmCampaign: v.optional(v.string()),
	properties: propertiesValidator,
	identifiedUserId: v.optional(v.string()),
	aggregatedAt: v.optional(v.union(v.number(), v.null())),
});
export const sessionValidator = v.object({
	_id: v.id("sessions"),
	_creationTime: v.number(),
	siteId: v.id("sites"),
	visitorId: v.string(),
	sessionId: v.string(),
	startedAt: v.number(),
	lastSeenAt: v.number(),
	entryPath: v.optional(v.string()),
	exitPath: v.optional(v.string()),
	referrer: v.optional(v.string()),
	utmSource: v.optional(v.string()),
	utmMedium: v.optional(v.string()),
	utmCampaign: v.optional(v.string()),
	device: v.optional(v.string()),
	browser: v.optional(v.string()),
	os: v.optional(v.string()),
	country: v.optional(v.string()),
	identifiedUserId: v.optional(v.string()),
	pageviewCount: v.number(),
});
export const topRowValidator = v.object({
	key: v.string(),
	count: v.number(),
	pageviewCount: v.number(),
});
export const propertyBreakdownRowValidator = v.object({
	value: propertyValue,
	count: v.number(),
});
export const paginatedEventsValidator = v.object({
	page: v.array(eventValidator),
	isDone: v.boolean(),
	continueCursor: v.union(v.string(), v.null()),
	pageStatus: v.optional(v.union(v.string(), v.null())),
	splitCursor: v.optional(v.union(v.string(), v.null())),
});
export const paginatedSessionsValidator = v.object({
	page: v.array(sessionValidator),
	isDone: v.boolean(),
	continueCursor: v.union(v.string(), v.null()),
	pageStatus: v.optional(v.union(v.string(), v.null())),
	splitCursor: v.optional(v.union(v.string(), v.null())),
});

export type IdOfSite = Id<"sites">;


export type SiteSettingsArgs = {
	sessionTimeoutMs?: number;
	retentionDays?: number;
	rawEventRetentionDays?: number;
	hourlyRollupRetentionDays?: number;
	dailyRollupRetentionDays?: number;
	rollupShardCount?: number;
	allowedPropertyKeys?: string[];
	deniedPropertyKeys?: string[];
};

export type SiteSettings = {
	sessionTimeoutMs: number;
	retentionDays: number;
	rawEventRetentionDays?: number;
	hourlyRollupRetentionDays?: number;
	dailyRollupRetentionDays?: number;
	rollupShardCount?: number;
	allowedPropertyKeys?: string[];
	deniedPropertyKeys?: string[];
};
