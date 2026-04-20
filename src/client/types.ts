import type { Auth, GenericActionCtx, GenericDataModel } from "convex/server";

export type Operation =
	| { type: "admin"; siteId?: string }
	| { type: "read"; siteId: string };
export type AuthFn = (
	ctx: { auth: Auth },
	operation: Operation,
) => Promise<void>;
export type ActionCtx = Pick<
	GenericActionCtx<GenericDataModel>,
	"runQuery" | "runMutation" | "runAction"
>;
export type SiteConfig = {
	slug: string;
	name: string;
	writeKey?: string;
	writeKeyHash?: string;
	allowedOrigins?: string[];
	sessionTimeoutMs?: number;
	retentionDays?: number;
	rawEventRetentionDays?: number;
	hourlyRollupRetentionDays?: number;
	dailyRollupRetentionDays?: number;
	dedupeRetentionMs?: number;
	allowedPropertyKeys?: string[];
	deniedPropertyKeys?: string[];
};
export type AnalyticsEvent =
	| {
			type: "pageview";
			path?: string;
			title?: string;
			referrer?: string;
			properties?: AnalyticsProperties;
			eventId?: string;
			occurredAt?: number;
	  }
	| {
			type: "track";
			name: string;
			path?: string;
			properties?: AnalyticsProperties;
			eventId?: string;
			occurredAt?: number;
	  }
	| {
			type: "identify";
			userId: string;
			properties?: AnalyticsProperties;
			eventId?: string;
			occurredAt?: number;
	  };
export type AnalyticsProperties = Record<
	string,
	string | number | boolean | null
>;
export type IngestContext = {
	source?: string;
	device?: string;
	browser?: string;
	os?: string;
	country?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
};
export type IngestEventInput = {
	type: "pageview" | "track" | "identify";
	name?: string;
	occurredAt?: number;
	path?: string;
	title?: string;
	referrer?: string;
	properties?: AnalyticsProperties;
	userId?: string;
	eventId?: string;
};
