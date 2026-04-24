"use client";

import { useQuery } from "convex/react";
import React, { useState } from "react";

import { INTERVALS, NAV, S } from "./dashboard/constants";
import { Sidebar } from "./dashboard/Sidebar";
import { EventsPage } from "./dashboard/pages/EventsPage";
import { OverviewPage } from "./dashboard/pages/OverviewPage";
import { PageViewsPage } from "./dashboard/pages/PageViewsPage";
import { SessionsPage } from "./dashboard/pages/SessionsPage";
import { VisitorsPage } from "./dashboard/pages/VisitorsPage";
import type {
  AnalyticsDashboardProps,
  DashboardSummary,
  OverviewStats,
  Page,
  TimeseriesPoint,
  TopRow,
} from "./dashboard/types";

export type {
  AnalyticsDashboardProps,
  DashboardSummary,
  OverviewStats,
  TimeseriesPoint,
  TopRow,
} from "./dashboard/types";

export function AnalyticsDashboard({
  siteId,
  api,
  className,
  style,
}: AnalyticsDashboardProps) {
  const [page, setPage] = useState<Page>("overview");
  const [rangeIdx, setRangeIdx] = useState(1);
  const range = INTERVALS[rangeIdx];

  const summary = useQuery(
    api.getDashboardSummary,
    page === "overview"
      ? { siteId, windowMs: range.ms, interval: range.interval }
      : "skip",
  ) as DashboardSummary | undefined;

  const pvTimeseries = useQuery(
    api.getTimeseries,
    page === "pageviews"
      ? { siteId, windowMs: range.ms, interval: range.interval }
      : "skip",
  ) as TimeseriesPoint[] | undefined;

  const pvTopPages = useQuery(
    api.getTopPages,
    page === "pageviews" ? { siteId, windowMs: range.ms, limit: 20 } : "skip",
  ) as TopRow[] | undefined;

  const pvTopReferrers = useQuery(
    api.getTopReferrers,
    page === "pageviews" ? { siteId, windowMs: range.ms, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  const evTopEvents = useQuery(
    api.getTopEvents,
    page === "events" ? { siteId, windowMs: range.ms, limit: 15 } : "skip",
  ) as TopRow[] | undefined;

  const evTopMediums = useQuery(
    api.getTopMediums,
    page === "events" ? { siteId, windowMs: range.ms, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  const evTopCampaigns = useQuery(
    api.getTopCampaigns,
    page === "events" ? { siteId, windowMs: range.ms, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  const visCountries = useQuery(
    api.getTopCountries,
    page === "visitors" ? { siteId, windowMs: range.ms, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  const visBrowsers = useQuery(
    api.getTopBrowsers,
    page === "visitors" ? { siteId, windowMs: range.ms, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  const visDevices = useQuery(
    api.getTopDevices,
    page === "visitors" ? { siteId, windowMs: range.ms, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  const visOs = useQuery(
    api.getTopOs,
    page === "visitors" ? { siteId, windowMs: range.ms, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  const sessOverview = useQuery(
    api.getOverview,
    page === "sessions" ? { siteId, windowMs: range.ms } : "skip",
  ) as OverviewStats | undefined;

  const PAGE_LABELS: Record<Page, string> = {
    overview: "Overview",
    pageviews: "Page Views",
    events: "Events",
    visitors: "Visitors",
    sessions: "Sessions",
  };
  const activeNav = NAV.find((item) => item.id === page);

  return (
    <div
      className={className}
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        fontFamily:
          '"Manrope", "Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif',
        color: S.textPri,
        ...style,
      }}
    >
      <Sidebar activePage={page} onNavigate={setPage} />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: S.contentBg,
        }}
      >
        <div
          style={{
            minHeight: 72,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.88) 100%)",
            borderBottom: `1px solid ${S.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            flexShrink: 0,
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: S.slateWash,
                color: activeNav ? S.teal : S.textSec,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${S.border}`,
              }}
            >
              {activeNav?.icon}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{PAGE_LABELS[page]}</div>
              <div style={{ fontSize: 12, color: S.textMut, marginTop: 2 }}>
                Rolling window, follows latest ingested data
              </div>
            </div>
          </div>
          <div
            style={{
              display: "inline-flex",
              padding: 5,
              gap: 5,
              background: "#dde7f0",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            {INTERVALS.map((iv, i) => (
              <button
                key={iv.key}
                onClick={() => setRangeIdx(i)}
                title={`${iv.longLabel} (${iv.description})`}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 12px",
                  background:
                    i === rangeIdx
                      ? "linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%)"
                      : "transparent",
                  color: i === rangeIdx ? S.greenDeep : S.textSec,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow:
                    i === rangeIdx ? "0 8px 18px rgba(15, 118, 110, 0.12)" : "none",
                }}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {page === "overview" && (
            <OverviewPage summary={summary} range={range} />
          )}
          {page === "pageviews" && (
            <PageViewsPage
                siteId={siteId}
                api={api}
                windowMs={range.ms}
                timeseries={pvTimeseries}
                topPages={pvTopPages}
                topReferrers={pvTopReferrers}
              range={range}
            />
          )}
          {page === "events" && (
            <EventsPage
                siteId={siteId}
                api={api}
                windowMs={range.ms}
                topEvents={evTopEvents}
                topMediums={evTopMediums}
                topCampaigns={evTopCampaigns}
            />
          )}
          {page === "visitors" && (
            <VisitorsPage
                siteId={siteId}
                api={api}
                windowMs={range.ms}
                topCountries={visCountries}
                topBrowsers={visBrowsers}
                topDevices={visDevices}
              topOs={visOs}
            />
          )}
          {page === "sessions" && (
            <SessionsPage
                siteId={siteId}
                api={api}
                windowMs={range.ms}
                overview={sessOverview}
              />
          )}
        </div>
      </div>
    </div>
  );
}
