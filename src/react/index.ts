"use client";

import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { AnalyticsDashboard } from "./Dashboard";
import type { AnalyticsDashboardProps, OverviewStats } from "./Dashboard";

export { AnalyticsDashboard };
export type { AnalyticsDashboardProps, OverviewStats };

export function useAnalyticsOverview(
  api: { getOverview: FunctionReference<"query"> },
  siteId: string,
  days: number = 7,
): OverviewStats | undefined {
  return useQuery(api.getOverview, {
    siteId,
    windowMs: days * 24 * 60 * 60 * 1000,
  }) as OverviewStats | undefined;
}
