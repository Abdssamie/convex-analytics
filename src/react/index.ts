"use client";

import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useMemo } from "react";
import { AnalyticsDashboard } from "./Dashboard";
import type { AnalyticsDashboardProps, OverviewStats } from "./Dashboard";

export { AnalyticsDashboard };
export type { AnalyticsDashboardProps, OverviewStats };

export function useAnalyticsOverview(
  api: { getOverview: FunctionReference<"query"> },
  siteId: string,
  days: number = 7,
): OverviewStats | undefined {
  const to = useMemo(() => Date.now(), []);
  const from = useMemo(() => to - days * 24 * 60 * 60 * 1000, [to, days]);
  return useQuery(api.getOverview, { siteId, from, to }) as OverviewStats | undefined;
}
