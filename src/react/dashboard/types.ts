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
