"use client";

import { useQuery, usePaginatedQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import React, { useState, useMemo } from "react";

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

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

type Page = "overview" | "pageviews" | "events" | "visitors" | "sessions";

// ---------------------------------------------------------------------------
// Date intervals
// ---------------------------------------------------------------------------

const INTERVALS = [
  {
    key: "24h",
    label: "24h",
    longLabel: "Rolling 24 hours",
    description: "Hourly buckets",
    ms: 24 * 60 * 60 * 1000,
    interval: "hour" as const,
  },
  {
    key: "7d",
    label: "7d",
    longLabel: "Rolling 7 days",
    description: "Daily buckets",
    ms: 7 * 24 * 60 * 60 * 1000,
    interval: "day" as const,
  },
  {
    key: "30d",
    label: "30d",
    longLabel: "Rolling 30 days",
    description: "Daily buckets",
    ms: 30 * 24 * 60 * 60 * 1000,
    interval: "day" as const,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(Math.round(n));
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(ts: number, interval: "hour" | "day"): string {
  const d = new Date(ts);
  if (interval === "hour") {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const S = {
  sidebarBg: "#101828",
  sidebarActiveBg: "#182334",
  sidebarActiveBorder: "#0f766e",
  sidebarActiveText: "#f8fafc",
  sidebarText: "#93a4ba",
  contentBg: "#eef2f6",
  card: "#ffffff",
  border: "#d7e0ea",
  textPri: "#102033",
  textSec: "#5f7187",
  textMut: "#90a0b5",
  teal: "#0f766e",
  amber: "#fffbeb",
  amberBdr: "#fef3c7",
  amberText: "#92400e",
  greenStrong: "#0f766e",
  greenDeep: "#115e59",
  greenSoft: "#e7f7f5",
  greenSoftAlt: "#f0fbf8",
  slateWash: "#f6f8fb",
  shadow: "0 20px 60px rgba(16, 32, 51, 0.08)",
} as const;

const METRIC_META: Record<
  Extract<keyof TimeseriesPoint, "visitors" | "sessions" | "pageviews" | "events">,
  { label: string; color: string; emptyLabel: string; tint: string; icon: React.ReactNode }
> = {
  visitors: {
    label: "New visitors",
    color: S.greenStrong,
    tint: S.greenSoft,
    emptyLabel: "No new visitors in this window.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2.5 13c.7-2 2.8-3.5 5.5-3.5S12.8 11 13.5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  sessions: {
    label: "Sessions",
    color: S.greenDeep,
    tint: S.greenSoftAlt,
    emptyLabel: "No sessions in this window.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5.25v3.2l2.15 1.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  pageviews: {
    label: "Pageviews",
    color: S.greenStrong,
    tint: S.greenSoftAlt,
    emptyLabel: "No pageviews in this window.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 6.5h6M5 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  events: {
    label: "Events",
    color: S.greenDeep,
    tint: S.greenSoft,
    emptyLabel: "No events in this window.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8.7 1.7 3 8.4h4.2L6.4 14.3 13 7.5H8.8l-.1-5.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
};

const STAT_META: Record<
  keyof OverviewStats,
  { icon: React.ReactNode; color: string; tint: string; label?: string }
> = {
  visitors: { icon: METRIC_META.visitors.icon, color: S.greenStrong, tint: S.greenSoft },
  sessions: { icon: METRIC_META.sessions.icon, color: S.greenDeep, tint: S.greenSoftAlt },
  pageviews: { icon: METRIC_META.pageviews.icon, color: S.greenStrong, tint: S.greenSoftAlt },
  events: { icon: METRIC_META.events.icon, color: S.greenDeep, tint: S.greenSoft },
  bounceRate: {
    color: S.greenDeep,
    tint: S.greenSoftAlt,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 4.5h10M3 8h6m-6 3.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="m10 10.5 3 3m0-3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  averageSessionDurationMs: {
    color: S.greenStrong,
    tint: S.greenSoft,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.8V8l2.3 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  Trend: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 10.5 5.2 7.3l2.1 2L12 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "Top Pages": METRIC_META.pageviews.icon,
  "Top Sources": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.8 5.6h8.4M2.8 8.4h8.4M7 2c1 1.1 1.6 2.9 1.6 5S8 10.9 7 12M7 2C6 3.1 5.4 4.9 5.4 7s.6 3.9 1.6 5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  "Pageviews over time": METRIC_META.pageviews.icon,
  "Pageview Feed": METRIC_META.pageviews.icon,
  "Top Referrers": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M8.5 2.5h3v3M11.2 2.8 7.4 6.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 3H4a1.5 1.5 0 0 0-1.5 1.5V10A1.5 1.5 0 0 0 4 11.5h5.5A1.5 1.5 0 0 0 11 10V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  "Top Events": METRIC_META.events.icon,
  "Top Mediums": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2.5" y="3" width="9" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 5.5h5M4.5 8h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  "Top Campaigns": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="m2.5 8.5 5-5 4 4-5 5H2.5v-4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m7.4 3.6 3 3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  "Raw Event Feed": METRIC_META.events.icon,
  Countries: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.8 5.6h8.4M2.8 8.4h8.4M7 2c1 1.1 1.6 2.9 1.6 5S8 10.9 7 12M7 2C6 3.1 5.4 4.9 5.4 7s.6 3.9 1.6 5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  Browsers: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.6 5.4h8.8M6.8 2.2c-1 1.3-1.8 3.2-1.8 4.8 0 1.7.8 3.5 1.8 4.8M7.2 2.2C8.2 3.5 9 5.3 9 7c0 1.6-.8 3.5-1.8 4.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  Devices: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="4.2" y="1.8" width="5.6" height="10.4" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="10.2" r=".7" fill="currentColor" />
    </svg>
  ),
  OS: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 3.5h9v7h-9z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 10.8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Visitors: METRIC_META.visitors.icon,
  Sessions: METRIC_META.sessions.icon,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnalyticsDashboard({
  siteId,
  api,
  className,
  style,
}: AnalyticsDashboardProps) {
  const [page, setPage] = useState<Page>("overview");
  const [rangeIdx, setRangeIdx] = useState(1);
  const range = INTERVALS[rangeIdx];

  // Round to nearest minute so Convex query cache is effective
  const to = useMemo(
    () => Math.floor(Date.now() / 60_000) * 60_000,
    [rangeIdx],
  );
  const from = to - range.ms;

  // ── Overview: ONE combined query (stats + timeseries + top pages + sources) ─
  const summary = useQuery(
    api.getDashboardSummary,
    page === "overview"
      ? { siteId, from, to, interval: range.interval }
      : "skip",
  ) as DashboardSummary | undefined;

  // ── Page Views ───────────────────────────────────────────────────────────────
  const pvTimeseries = useQuery(
    api.getTimeseries,
    page === "pageviews"
      ? { siteId, from, to, interval: range.interval }
      : "skip",
  ) as TimeseriesPoint[] | undefined;

  const pvTopPages = useQuery(
    api.getTopPages,
    page === "pageviews" ? { siteId, from, to, limit: 20 } : "skip",
  ) as TopRow[] | undefined;

  const pvTopReferrers = useQuery(
    api.getTopReferrers,
    page === "pageviews" ? { siteId, from, to, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  // ── Events ───────────────────────────────────────────────────────────────────
  const evTopEvents = useQuery(
    api.getTopEvents,
    page === "events" ? { siteId, from, to, limit: 15 } : "skip",
  ) as TopRow[] | undefined;

  const evTopMediums = useQuery(
    api.getTopMediums,
    page === "events" ? { siteId, from, to, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  const evTopCampaigns = useQuery(
    api.getTopCampaigns,
    page === "events" ? { siteId, from, to, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  // ── Visitors ─────────────────────────────────────────────────────────────────
  const visCountries = useQuery(
    api.getTopCountries,
    page === "visitors" ? { siteId, from, to, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  const visBrowsers = useQuery(
    api.getTopBrowsers,
    page === "visitors" ? { siteId, from, to, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  const visDevices = useQuery(
    api.getTopDevices,
    page === "visitors" ? { siteId, from, to, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  const visOs = useQuery(
    api.getTopOs,
    page === "visitors" ? { siteId, from, to, limit: 10 } : "skip",
  ) as TopRow[] | undefined;

  // ── Sessions stats ───────────────────────────────────────────────────────────
  const sessOverview = useQuery(
    api.getOverview,
    page === "sessions" ? { siteId, from, to } : "skip",
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
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <Sidebar activePage={page} onNavigate={setPage} />

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: S.contentBg,
        }}
      >
        {/* Top bar */}
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
                Rolling window, refreshed each minute
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

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {page === "overview" && (
            <OverviewPage summary={summary} range={range} />
          )}
          {page === "pageviews" && (
            <PageViewsPage
              siteId={siteId}
              api={api}
              from={from}
              to={to}
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
              from={from}
              to={to}
              topEvents={evTopEvents}
              topMediums={evTopMediums}
              topCampaigns={evTopCampaigns}
            />
          )}
          {page === "visitors" && (
            <VisitorsPage
              siteId={siteId}
              api={api}
              from={from}
              to={to}
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
              from={from}
              to={to}
              overview={sessOverview}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="8" width="3" height="6" rx="1" fill="currentColor" />
        <rect x="6" y="5" width="3" height="9" rx="1" fill="currentColor" />
        <rect x="11" y="1" width="3" height="13" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "pageviews",
    label: "Page Views",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect
          x="1"
          y="1"
          width="13"
          height="13"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <line
          x1="4"
          y1="5"
          x2="11"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="4"
          y1="8"
          x2="9"
          y2="8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="4"
          y1="11"
          x2="7"
          y2="11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "events",
    label: "Events",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path
          d="M8.5 1L2 9h5.5L6.5 14L13 6H7.5L8.5 1Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "visitors",
    label: "Visitors",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle
          cx="7.5"
          cy="5"
          r="3"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M1.5 13.5C1.5 11 4.2 9 7.5 9s6 2 6 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "sessions",
    label: "Sessions",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle
          cx="7.5"
          cy="7.5"
          r="6"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M7.5 4.5V7.5L9.5 9.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function Sidebar({
  activePage,
  onNavigate,
}: {
  activePage: Page;
  onNavigate: (p: Page) => void;
}) {
  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        background:
          "linear-gradient(180deg, #101828 0%, #132033 55%, #10243a 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            background: "linear-gradient(135deg, #0f766e 0%, #155e75 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 10px 24px rgba(15,118,110,0.3)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="7" width="3" height="6" rx="1" fill="white" />
            <rect x="5.5" y="4" width="3" height="9" rx="1" fill="white" />
            <rect x="10" y="1" width="3" height="12" rx="1" fill="white" />
          </svg>
        </div>
        <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>
          Analytics
        </span>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "10px 0" }}>
        {NAV.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={activePage === item.id}
            onClick={onNavigate}
          />
        ))}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "14px 20px",
          fontSize: 11,
          color: "#6f8098",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        Powered by Convex Analytics
      </div>
    </div>
  );
}

function NavItem({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onClick: (p: Page) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onClick(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "9px 20px",
        border: "none",
        borderLeft: `3px solid ${active ? S.sidebarActiveBorder : "transparent"}`,
        background: active || hovered ? S.sidebarActiveBg : "transparent",
        color: active
          ? S.sidebarActiveText
          : hovered
            ? "#cbd5e1"
            : S.sidebarText,
        cursor: "pointer",
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        textAlign: "left",
        transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {item.icon}
      </span>
      {item.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: S.card,
        border: `1px solid ${S.border}`,
        borderRadius: 18,
        padding: "20px 24px",
        boxShadow: S.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        fontWeight: 700,
        color: S.textSec,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 14,
      }}
    >
      {icon ? (
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            background: S.slateWash,
            color: S.greenDeep,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${S.border}`,
          }}
        >
          {icon}
        </span>
      ) : null}
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  iconColor = S.teal,
  iconTint = S.greenSoft,
  testId,
}: {
  label: string;
  value: string | undefined;
  sub?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  iconTint?: string;
  testId?: string;
}) {
  return (
    <Card
      style={{
        padding: "18px 20px",
        background:
          "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.92) 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: S.textSec,
            fontWeight: 600,
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </div>
        {icon ? (
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              background: iconTint,
              color: iconColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div
        data-testid={testId}
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: S.textPri,
          lineHeight: 1.15,
        }}
      >
        <span data-testid={testId ? `${testId}-value` : undefined}>
          {value ?? <span style={{ color: S.textMut }}>—</span>}
        </span>
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: S.textMut, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

function SkeletonRow() {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <div
          style={{
            height: 12,
            width: "55%",
            background: "#e2e8f0",
            borderRadius: 4,
          }}
        />
        <div
          style={{
            height: 12,
            width: "12%",
            background: "#e2e8f0",
            borderRadius: 4,
          }}
        />
      </div>
      <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2 }} />
    </div>
  );
}

function TopList({
  title,
  data,
  barColor = S.teal,
  metric = "count",
  emptyLabel = "No data for this period.",
}: {
  title: string;
  data: TopRow[] | undefined;
  barColor?: string;
  metric?: "count" | "pageviewCount";
  emptyLabel?: string;
}) {
  const max = data ? Math.max(...data.map((d) => d[metric]), 1) : 1;
  const total = data?.reduce((sum, item) => sum + item[metric], 0) ?? 0;
  return (
    <Card>
      <SectionTitle icon={SECTION_ICONS[title]}>{title}</SectionTitle>
      {data === undefined ? (
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      ) : data.length === 0 ? (
        <div style={{ color: S.textMut, fontSize: 13 }}>{emptyLabel}</div>
      ) : (
        data.map((item) => (
          <div key={item.key} style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span
                title={item.key || "(direct)"}
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: S.textPri,
                  marginRight: 8,
                  maxWidth: "76%",
                }}
              >
                {item.key || "(direct)"}
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: S.textSec,
                  flexShrink: 0,
                  fontSize: 12,
                  textAlign: "right",
                }}
              >
                {formatNumber(item[metric])}
                {total > 0 ? ` · ${formatPercent(item[metric] / total)}` : ""}
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: "#f1f5f9",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: barColor,
                  width: `${(item[metric] / max) * 100}%`,
                  borderRadius: 2,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        ))
      )}
    </Card>
  );
}

function LoadMoreBtn({
  status,
  loadMore,
  n = 25,
}: {
  status: string;
  loadMore: (n: number) => void;
  n?: number;
}) {
  if (status === "Exhausted") {
    return (
      <div
        style={{
          textAlign: "center",
          fontSize: 12,
          color: S.textMut,
          padding: "12px 0 0",
        }}
      >
        All records loaded.
      </div>
    );
  }
  return (
    <div style={{ textAlign: "center", paddingTop: 16 }}>
      <button
        onClick={() => loadMore(n)}
        disabled={status === "LoadingMore"}
        style={{
          padding: "7px 20px",
          borderRadius: 6,
          border: `1px solid ${S.border}`,
          background: S.card,
          color: S.textPri,
          fontSize: 13,
          cursor: status === "LoadingMore" ? "not-allowed" : "pointer",
          opacity: status === "LoadingMore" ? 0.6 : 1,
        }}
      >
        {status === "LoadingMore" ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}

const thSty: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: S.textSec,
  whiteSpace: "nowrap",
  borderBottom: `1px solid ${S.border}`,
  background: S.slateWash,
};

const tdSty: React.CSSProperties = {
  padding: "11px 12px",
  fontSize: 13,
  color: S.textPri,
  verticalAlign: "middle",
  borderBottom: `1px solid ${S.border}`,
};

const tableWrapSty: React.CSSProperties = {
  overflowX: "auto",
};

const tableSty: React.CSSProperties = {
  width: "100%",
  minWidth: "max-content",
  borderCollapse: "collapse",
};

// ---------------------------------------------------------------------------
// Trend Chart
// ---------------------------------------------------------------------------

function TrendChart({
  data,
  metric,
  color,
  height = 220,
  interval,
  emptyLabel,
}: {
  data: TimeseriesPoint[];
  metric: Extract<keyof TimeseriesPoint, "visitors" | "sessions" | "pageviews" | "events">;
  color: string;
  height?: number;
  interval: "hour" | "day";
  emptyLabel?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: S.textMut,
          fontSize: 13,
        }}
      >
        {emptyLabel ?? "No data"}
      </div>
    );
  }

  const W = 760;
  const H = height;
  const PAD = { top: 20, right: 14, bottom: 34, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const values = data.map((d) => d[metric] as number);
  const maxVal = Math.max(...values, 1);
  const n = data.length;
  const baselineY = PAD.top + chartH;
  const stepX = n > 1 ? chartW / (n - 1) : 0;
  const points = data.map((point, index) => {
    const value = point[metric] as number;
    const x = n === 1 ? PAD.left + chartW / 2 : PAD.left + index * stepX;
    const y = baselineY - (value / maxVal) * chartH;
    return { x, y, value, bucketStart: point.bucketStart };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = [
    `M ${points[0]?.x ?? PAD.left} ${baselineY}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${points[points.length - 1]?.x ?? PAD.left} ${baselineY}`,
    "Z",
  ].join(" ");
  const labelIdxs = Array.from(
    new Set([0, Math.floor((n - 1) / 3), Math.floor(((n - 1) * 2) / 3), n - 1]),
  );
  const ticks = [0, 0.5, 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={height}
      style={{
        display: "block",
        background:
          "linear-gradient(180deg, rgba(246,248,251,0.7) 0%, rgba(255,255,255,0.2) 100%)",
        borderRadius: 16,
      }}
    >
      {ticks.map((f) => {
        const y = PAD.top + chartH * (1 - f);
        return (
          <line
            key={f}
            x1={PAD.left}
            y1={y}
            x2={W - PAD.right}
            y2={y}
            stroke={S.border}
            strokeWidth="1"
          />
        );
      })}

      {ticks.map((f) => {
        const value = maxVal * f;
        const y = PAD.top + chartH * (1 - f) + 4;
        return (
          <text
            key={f}
            x={PAD.left - 8}
            y={y}
            textAnchor="end"
            fontSize="10"
            fill={S.textMut}
          >
            {formatNumber(value)}
          </text>
        );
      })}

      <path d={areaPath} fill={color} opacity="0.14" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={n <= 2 ? 4 : 3}
          fill={S.card}
          stroke={color}
          strokeWidth="2"
        >
          <title>
            {formatDate(point.bucketStart, interval)}: {formatNumber(point.value)}
          </title>
        </circle>
      ))}

      {labelIdxs.map((i) => (
        <text
          key={i}
          x={points[i]?.x ?? PAD.left}
          y={H - 4}
          textAnchor="middle"
          fontSize="10"
          fill={S.textMut}
        >
          {formatDate(data[i].bucketStart, interval)}
        </text>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Overview page  (single getDashboardSummary subscription)
// ---------------------------------------------------------------------------

function OverviewPage({
  summary,
  range,
}: {
  summary: DashboardSummary | undefined;
  range: (typeof INTERVALS)[number];
}) {
  const ov = summary?.overview;
  const [metric, setMetric] = useState<
    Extract<keyof TimeseriesPoint, "visitors" | "sessions" | "pageviews" | "events">
  >("visitors");
  const metricMeta = METRIC_META[metric];
  const series = summary?.timeseries ?? [];
  const metricTotal = ov ? ov[metric] : undefined;
  const averagePerBucket =
    metricTotal !== undefined && series.length > 0
      ? metricTotal / series.length
      : undefined;
  const peakBucket = series.reduce<TimeseriesPoint | null>((best, point) => {
    if (!best) {
      return point;
    }
    return point[metric] > best[metric] ? point : best;
  }, null);
  const pagesPerSession = ov
    ? safeDivide(ov.pageviews, ov.sessions)
    : undefined;
  const eventsPerSession = ov ? safeDivide(ov.events, ov.sessions) : undefined;
  const sessionsPerVisitor = ov
    ? safeDivide(ov.sessions, ov.visitors)
    : undefined;
  return (
    <>
      {/* Stat row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          label="New Visitors"
          value={ov ? formatNumber(ov.visitors) : undefined}
          icon={STAT_META.visitors.icon}
          iconColor={STAT_META.visitors.color}
          iconTint={STAT_META.visitors.tint}
          testId="overview-visitors"
        />
        <StatCard
          label="Sessions"
          value={ov ? formatNumber(ov.sessions) : undefined}
          icon={STAT_META.sessions.icon}
          iconColor={STAT_META.sessions.color}
          iconTint={STAT_META.sessions.tint}
          testId="overview-sessions"
        />
        <StatCard
          label="Pageviews"
          value={ov ? formatNumber(ov.pageviews) : undefined}
          icon={STAT_META.pageviews.icon}
          iconColor={STAT_META.pageviews.color}
          iconTint={STAT_META.pageviews.tint}
          testId="overview-pageviews"
        />
        <StatCard
          label="Events"
          value={ov ? formatNumber(ov.events) : undefined}
          icon={STAT_META.events.icon}
          iconColor={STAT_META.events.color}
          iconTint={STAT_META.events.tint}
        />
        <StatCard
          label="Bounce Rate"
          value={ov ? formatPercent(ov.bounceRate) : undefined}
          icon={STAT_META.bounceRate.icon}
          iconColor={STAT_META.bounceRate.color}
          iconTint={STAT_META.bounceRate.tint}
          testId="overview-bounce-rate"
        />
        <StatCard
          label="Avg Duration"
          value={ov ? formatDuration(ov.averageSessionDurationMs) : undefined}
          icon={STAT_META.averageSessionDurationMs.icon}
          iconColor={STAT_META.averageSessionDurationMs.color}
          iconTint={STAT_META.averageSessionDurationMs.tint}
          testId="overview-average-duration"
        />
      </div>

      <Card style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <SectionTitle icon={SECTION_ICONS.Trend}>Trend</SectionTitle>
            <div style={{ fontSize: 24, fontWeight: 800, color: S.textPri }}>
              {metricMeta.label}
            </div>
            <div style={{ fontSize: 13, color: S.textSec, marginTop: 6 }}>
              Total {metricTotal === undefined ? "—" : formatNumber(metricTotal)} · Avg/bucket{" "}
              {averagePerBucket === undefined ? "—" : formatNumber(averagePerBucket)} · Peak{" "}
              {peakBucket
                ? `${formatNumber(peakBucket[metric])} at ${formatDate(peakBucket.bucketStart, range.interval)}`
                : "—"}
            </div>
          </div>
          <div
            style={{
              display: "inline-flex",
              padding: 4,
              gap: 4,
              background: "#f8fafc",
              borderRadius: 10,
              border: `1px solid ${S.border}`,
              alignSelf: "flex-start",
              flexWrap: "wrap",
            }}
          >
            {(Object.keys(METRIC_META) as Array<keyof typeof METRIC_META>).map((key) => (
              <button
                key={key}
                onClick={() => setMetric(key)}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: metric === key ? METRIC_META[key].tint : "transparent",
                  color: metric === key ? METRIC_META[key].color : S.textSec,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <span style={{ display: "inline-flex" }}>{METRIC_META[key].icon}</span>
                {METRIC_META[key].label}
              </button>
            ))}
          </div>
        </div>
        {summary ? (
          <TrendChart
            data={summary.timeseries}
            metric={metric}
            color={metricMeta.color}
            interval={range.interval}
            emptyLabel={metricMeta.emptyLabel}
          />
        ) : (
          <div
            style={{
              height: 220,
              background: "#f8fafc",
              borderRadius: 6,
            }}
          />
        )}
        <div style={{ fontSize: 12, color: S.textMut, marginTop: 12 }}>
          24h uses hourly buckets. 7d and 30d use daily buckets for stable trend reading.
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Pages / Session"
          value={pagesPerSession === undefined ? undefined : pagesPerSession.toFixed(2)}
          sub="Pageview depth"
          icon={METRIC_META.pageviews.icon}
          iconColor={S.greenStrong}
          iconTint={S.greenSoftAlt}
        />
        <StatCard
          label="Events / Session"
          value={eventsPerSession === undefined ? undefined : eventsPerSession.toFixed(2)}
          sub="Interaction density"
          icon={METRIC_META.events.icon}
          iconColor={S.greenDeep}
          iconTint={S.greenSoft}
        />
        <StatCard
          label="Sessions / New Visitor"
          value={sessionsPerVisitor === undefined ? undefined : sessionsPerVisitor.toFixed(2)}
          sub="Repeat usage inside window"
          icon={METRIC_META.sessions.icon}
          iconColor={S.greenDeep}
          iconTint={S.greenSoftAlt}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        <TopList title="Top Pages" data={summary?.topPages} />
        <TopList title="Top Sources" data={summary?.topSources} barColor={S.greenStrong} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page Views page
// ---------------------------------------------------------------------------

function PageViewsPage({
  siteId,
  api,
  from,
  to,
  timeseries,
  topPages,
  topReferrers,
  range,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  from: number;
  to: number;
  timeseries: TimeseriesPoint[] | undefined;
  topPages: TopRow[] | undefined;
  topReferrers: TopRow[] | undefined;
  range: (typeof INTERVALS)[number];
}) {
  return (
    <>
      <Card style={{ marginBottom: 24 }}>
        <SectionTitle icon={SECTION_ICONS["Pageviews over time"]}>
          Pageviews over time
        </SectionTitle>
        {timeseries ? (
          <TrendChart
            data={timeseries}
            metric="pageviews"
            color={S.greenStrong}
            interval={range.interval}
            emptyLabel="No pageviews in this window."
          />
        ) : (
          <div
            style={{ height: 140, background: "#f8fafc", borderRadius: 6 }}
          />
        )}
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <TopList
          title="Top Pages"
          data={topPages}
          barColor={S.greenStrong}
          metric="pageviewCount"
        />
        <TopList title="Top Referrers" data={topReferrers} barColor={S.greenStrong} />
      </div>

      <PageviewsFeed siteId={siteId} api={api} from={from} to={to} />
    </>
  );
}

function PageviewsFeed({
  siteId,
  api,
  from,
  to,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  from: number;
  to: number;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.listPageviews,
    { siteId, from, to },
    { initialNumItems: 25 },
  );
  const hasExitPath = results.some((ev: any) => Boolean(ev.exitPath));
  return (
    <Card>
      <SectionTitle icon={SECTION_ICONS["Pageview Feed"]}>Pageview Feed</SectionTitle>
      {results.length === 0 && status === "Exhausted" ? (
        <div style={{ color: S.textMut, fontSize: 13 }}>
          No pageviews in this period.
        </div>
      ) : (
        <div style={tableWrapSty}>
          <table style={tableSty}>
            <thead>
              <tr>
                <th style={thSty}>Path</th>
                <th style={thSty}>Title</th>
                {hasExitPath ? <th style={thSty}>Exit Path</th> : null}
                <th style={thSty}>Visitor</th>
                <th style={{ ...thSty, textAlign: "right" }}>Occurred</th>
              </tr>
            </thead>
            <tbody>
              {results.map((ev: any) => (
                <tr key={ev._id}>
                  <td style={tdSty} title={ev.path ?? "/"}>
                    {ev.path ?? "/"}
                  </td>
                  <td style={{ ...tdSty, color: S.textSec }} title={ev.title ?? ""}>
                    {ev.title ?? ""}
                  </td>
                  {hasExitPath ? (
                    <td
                      style={{ ...tdSty, color: S.textSec }}
                      title={ev.exitPath ?? ""}
                    >
                      {ev.exitPath ?? ""}
                    </td>
                  ) : null}
                  <td
                    style={{
                      ...tdSty,
                      fontFamily: "monospace",
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                    title={ev.visitorId}
                  >
                    {ev.visitorId}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      textAlign: "right",
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(ev.occurredAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMoreBtn status={status} loadMore={loadMore} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Events page
// ---------------------------------------------------------------------------

function EventsPage({
  siteId,
  api,
  from,
  to,
  topEvents,
  topMediums,
  topCampaigns,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  from: number;
  to: number;
  topEvents: TopRow[] | undefined;
  topMediums: TopRow[] | undefined;
  topCampaigns: TopRow[] | undefined;
}) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <TopList title="Top Events" data={topEvents} barColor={S.greenStrong} />
        <TopList title="Top Mediums" data={topMediums} barColor={S.greenStrong} />
        <TopList title="Top Campaigns" data={topCampaigns} barColor={S.greenStrong} />
      </div>
      <RawEventsFeed siteId={siteId} api={api} from={from} to={to} />
    </>
  );
}

function RawEventsFeed({
  siteId,
  api,
  from,
  to,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  from: number;
  to: number;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.listRawEvents,
    { siteId, from, to },
    { initialNumItems: 25 },
  );

  const badge = (type: string) => {
    const map: Record<string, [string, string]> = {
      pageview: [S.greenSoftAlt, S.greenDeep],
      track: [S.greenSoft, S.greenStrong],
      identify: [S.greenSoftAlt, S.greenDeep],
    };
    const [bg, fg] = map[type] ?? ["#f1f5f9", S.textSec];
    return (
      <span
        style={{
          background: bg,
          color: fg,
          fontSize: 11,
          fontWeight: 600,
          padding: "2px 6px",
          borderRadius: 4,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {type}
      </span>
    );
  };

  return (
    <Card>
      <SectionTitle icon={SECTION_ICONS["Raw Event Feed"]}>Raw Event Feed</SectionTitle>
      {results.length === 0 && status === "Exhausted" ? (
        <div style={{ color: S.textMut, fontSize: 13 }}>
          No events in this period.
        </div>
      ) : (
        <div style={tableWrapSty}>
          <table style={tableSty}>
            <thead>
              <tr>
                <th style={thSty}>Event</th>
                <th style={thSty}>Type</th>
                <th style={thSty}>Path</th>
                <th style={thSty}>Visitor</th>
                <th style={{ ...thSty, textAlign: "right" }}>Occurred</th>
              </tr>
            </thead>
            <tbody>
              {results.map((ev: any) => (
                <tr key={ev._id}>
                  <td style={{ ...tdSty, fontWeight: 500 }}>{ev.eventName}</td>
                  <td style={tdSty}>{badge(ev.eventType)}</td>
                  <td style={{ ...tdSty, color: S.textSec }} title={ev.path ?? ""}>
                    {ev.path ?? ""}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      fontFamily: "monospace",
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                    title={ev.visitorId}
                  >
                    {ev.visitorId}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      textAlign: "right",
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(ev.occurredAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMoreBtn status={status} loadMore={loadMore} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Visitors page
// ---------------------------------------------------------------------------

function VisitorsPage({
  siteId,
  api,
  from,
  to,
  topCountries,
  topBrowsers,
  topDevices,
  topOs,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  from: number;
  to: number;
  topCountries: TopRow[] | undefined;
  topBrowsers: TopRow[] | undefined;
  topDevices: TopRow[] | undefined;
  topOs: TopRow[] | undefined;
}) {
  return (
    <>
      {/* Limitation notice */}
      <div
        style={{
          background: S.amber,
          border: `1px solid ${S.amberBdr}`,
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 24,
          fontSize: 13,
          color: S.amberText,
          lineHeight: 1.6,
        }}
      >
        <strong>⚠ New visitors only.</strong> These counts reflect visitors
        whose <em>first ever</em> visit falls within the selected period.
        Returning visitors who first arrived before this window are not counted.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <TopList title="Countries" data={topCountries} barColor={S.greenStrong} />
        <TopList title="Browsers" data={topBrowsers} barColor={S.greenStrong} />
        <TopList title="Devices" data={topDevices} barColor={S.greenStrong} />
        <TopList title="OS" data={topOs} barColor={S.greenStrong} />
      </div>

      <VisitorsFeed siteId={siteId} api={api} from={from} to={to} />
    </>
  );
}

function VisitorsFeed({
  siteId,
  api,
  from,
  to,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  from: number;
  to: number;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.listVisitors,
    { siteId, from, to },
    { initialNumItems: 25 },
  );
  return (
    <Card>
      <SectionTitle icon={SECTION_ICONS.Visitors}>Visitors</SectionTitle>
      {results.length === 0 && status === "Exhausted" ? (
        <div style={{ color: S.textMut, fontSize: 13 }}>
          No visitors in this period.
        </div>
      ) : (
        <div style={tableWrapSty}>
          <table style={tableSty}>
            <thead>
              <tr>
                <th style={thSty}>Visitor ID</th>
                <th style={thSty}>First Seen</th>
                <th style={thSty}>Last Seen</th>
                <th style={thSty}>Identified User</th>
              </tr>
            </thead>
            <tbody>
              {results.map((v: any) => (
                <tr key={v._id}>
                  <td
                    style={{ ...tdSty, fontFamily: "monospace", whiteSpace: "nowrap" }}
                    title={v.visitorId}
                  >
                    {v.visitorId}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(v.firstSeenAt).toLocaleString()}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(v.lastSeenAt).toLocaleString()}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      color: v.identifiedUserId ? S.textPri : S.textMut,
                    }}
                    title={v.identifiedUserId ?? "—"}
                  >
                    {v.identifiedUserId ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMoreBtn status={status} loadMore={loadMore} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sessions page
// ---------------------------------------------------------------------------

function SessionsPage({
  siteId,
  api,
  from,
  to,
  overview,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  from: number;
  to: number;
  overview: OverviewStats | undefined;
}) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Sessions"
          value={overview ? formatNumber(overview.sessions) : undefined}
          testId="overview-sessions"
        />
        <StatCard
          label="Bounce Rate"
          value={
            overview ? `${(overview.bounceRate * 100).toFixed(1)}%` : undefined
          }
          sub="(requires full session scan)"
          testId="overview-bounce-rate"
        />
        <StatCard
          label="Avg Duration"
          value={
            overview
              ? formatDuration(overview.averageSessionDurationMs)
              : undefined
          }
          sub="(requires full session scan)"
          testId="overview-average-duration"
        />
      </div>
      <SessionsFeed siteId={siteId} api={api} from={from} to={to} />
    </>
  );
}

function SessionsFeed({
  siteId,
  api,
  from,
  to,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  from: number;
  to: number;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.listSessions,
    { siteId, from, to },
    { initialNumItems: 25 },
  );
  const hasExitPath = results.some((s: any) => Boolean(s.exitPath));
  return (
    <Card>
      <SectionTitle icon={SECTION_ICONS.Sessions}>Sessions</SectionTitle>
      {results.length === 0 && status === "Exhausted" ? (
        <div style={{ color: S.textMut, fontSize: 13 }}>
          No sessions in this period.
        </div>
      ) : (
        <div style={tableWrapSty}>
          <table style={tableSty}>
            <thead>
              <tr>
                <th style={thSty}>Session ID</th>
                <th style={thSty}>Duration</th>
                <th style={thSty}>Pages</th>
                <th style={thSty}>Entry Path</th>
                {hasExitPath ? <th style={thSty}>Exit Path</th> : null}
                <th style={thSty}>Referrer</th>
                <th style={thSty}>Device</th>
                <th style={{ ...thSty, textAlign: "right" }}>Started</th>
              </tr>
            </thead>
            <tbody>
              {results.map((s: any) => (
                <tr key={s._id}>
                  <td
                    style={{ ...tdSty, fontFamily: "monospace", whiteSpace: "nowrap" }}
                    title={s.sessionId}
                  >
                    {s.sessionId}
                  </td>
                  <td style={tdSty}>
                    {formatDuration(Math.max(0, s.lastSeenAt - s.startedAt))}
                  </td>
                  <td style={tdSty}>{s.pageviewCount}</td>
                  <td style={{ ...tdSty, color: S.textSec }} title={s.entryPath ?? "/"}>
                    {s.entryPath ?? "/"}
                  </td>
                  {hasExitPath ? (
                    <td style={{ ...tdSty, color: S.textSec }} title={s.exitPath ?? ""}>
                      {s.exitPath ?? ""}
                    </td>
                  ) : null}
                  <td style={{ ...tdSty, color: S.textSec }} title={s.referrer ?? "—"}>
                    {s.referrer ?? "—"}
                  </td>
                  <td style={{ ...tdSty, color: S.textSec }}>
                    {s.device ?? "—"}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      textAlign: "right",
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(s.startedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMoreBtn status={status} loadMore={loadMore} />
    </Card>
  );
}
