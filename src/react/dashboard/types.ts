import type { FunctionReference } from "convex/server";
import type React from "react";

export interface OverviewStats {
  visitors: number;
  sessions: number;
  pageviews: number;
  events: number;
  bounceRate: number;
  averageSessionDurationMs: number;
}

export interface TimeseriesPoint {
  bucketStart: number;
  events: number;
  pageviews: number;
  sessions: number;
  visitors: number;
}

export interface TopRow {
  key: string;
  count: number;
  pageviewCount: number;
}

export interface DashboardSummary {
  overview: OverviewStats;
  timeseries: TimeseriesPoint[];
  topPages: TopRow[];
  topSources: TopRow[];
}

export interface RawEventRow {
  _id: string;
  _creationTime: number;
  siteId: string;
  receivedAt: number;
  occurredAt: number;
  visitorId: string;
  sessionId: string;
  eventType: "pageview" | "track" | "identify";
  eventName: string;
  path?: string;
  title?: string;
  referrer?: string;
  device?: string;
  browser?: string;
  os?: string;
  country?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  properties?: Record<string, string | number | boolean | null>;
  identifiedUserId?: string;
  aggregatedAt?: number | null;
}

export interface SessionRow {
  _id: string;
  _creationTime: number;
  siteId: string;
  visitorId: string;
  sessionId: string;
  startedAt: number;
  lastSeenAt: number;
  entryPath?: string;
  exitPath?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  device?: string;
  browser?: string;
  os?: string;
  country?: string;
  identifiedUserId?: string;
  pageviewCount: number;
}

export interface VisitorRow {
  _id: string;
  _creationTime: number;
  siteId: string;
  visitorId: string;
  firstSeenAt: number;
  lastSeenAt: number;
  identifiedUserId?: string;
  traits?: Record<string, string | number | boolean | null>;
}

export type PageviewRow = RawEventRow & {
  exitPath?: string;
};

export interface AnalyticsDashboardProps {
  siteId: string;
  api: {
    getDashboardSummary: FunctionReference<"query">;
    getOverview: FunctionReference<"query">;
    getTimeseries: FunctionReference<"query">;
    getTopPages: FunctionReference<"query">;
    getTopReferrers: FunctionReference<"query">;
    getTopSources: FunctionReference<"query">;
    getTopMediums: FunctionReference<"query">;
    getTopCampaigns: FunctionReference<"query">;
    getTopEvents: FunctionReference<"query">;
    getTopDevices: FunctionReference<"query">;
    getTopBrowsers: FunctionReference<"query">;
    getTopOs: FunctionReference<"query">;
    getTopCountries: FunctionReference<"query">;
    listRawEvents: FunctionReference<"query">;
    listPageviews: FunctionReference<"query">;
    listSessions: FunctionReference<"query">;
    listVisitors: FunctionReference<"query">;
  };
  className?: string;
  style?: React.CSSProperties;
}

export type Page = "overview" | "pageviews" | "events" | "visitors" | "sessions";
