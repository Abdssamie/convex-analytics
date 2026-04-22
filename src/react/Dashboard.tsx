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
  { label: "Last 24h", ms: 24 * 60 * 60 * 1000, interval: "hour" as const },
  {
    label: "Last 7 days",
    ms: 7 * 24 * 60 * 60 * 1000,
    interval: "day" as const,
  },
  {
    label: "Last 30 days",
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

function formatDate(ts: number, interval: "hour" | "day"): string {
  const d = new Date(ts);
  if (interval === "hour") {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const S = {
  sidebarBg: "#0f172a",
  sidebarActiveBg: "#1e293b",
  sidebarActiveBorder: "#0d9488",
  sidebarActiveText: "#f1f5f9",
  sidebarText: "#94a3b8",
  contentBg: "#f1f5f9",
  card: "#ffffff",
  border: "#e2e8f0",
  textPri: "#0f172a",
  textSec: "#64748b",
  textMut: "#94a3b8",
  teal: "#0d9488",
  amber: "#fffbeb",
  amberBdr: "#fef3c7",
  amberText: "#92400e",
} as const;

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

  return (
    <div
      className={className}
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
            height: 56,
            background: S.card,
            borderBottom: `1px solid ${S.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {PAGE_LABELS[page]}
          </span>
          <select
            value={rangeIdx}
            onChange={(e) => setRangeIdx(parseInt(e.target.value))}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${S.border}`,
              background: S.card,
              color: S.textPri,
              fontSize: 13,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {INTERVALS.map((iv, i) => (
              <option key={iv.label} value={i}>
                {iv.label}
              </option>
            ))}
          </select>
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
        background: S.sidebarBg,
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
          borderBottom: "1px solid #1e293b",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: S.teal,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
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
          color: "#334155",
          borderTop: "1px solid #1e293b",
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
        borderRadius: 10,
        padding: "20px 24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: S.textSec,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  testId,
}: {
  label: string;
  value: string | undefined;
  sub?: string;
  testId?: string;
}) {
  return (
    <Card style={{ padding: "18px 20px" }}>
      <div
        style={{
          fontSize: 12,
          color: S.textSec,
          fontWeight: 500,
          marginBottom: 6,
        }}
      >
        {label}
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
}: {
  title: string;
  data: TopRow[] | undefined;
  barColor?: string;
  metric?: "count" | "pageviewCount";
}) {
  const max = data ? Math.max(...data.map((d) => d[metric]), 1) : 1;
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {data === undefined ? (
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      ) : data.length === 0 ? (
        <div style={{ color: S.textMut, fontSize: 13 }}>
          No data for this period.
        </div>
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
                }}
              >
                {formatNumber(item[metric])}
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
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: S.textSec,
  whiteSpace: "nowrap",
  borderBottom: `1px solid ${S.border}`,
  background: "#f8fafc",
};

const tdSty: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 13,
  color: S.textPri,
  verticalAlign: "middle",
  borderBottom: `1px solid ${S.border}`,
};

// ---------------------------------------------------------------------------
// Bar Chart  (robust: handles 0, 1, or many data points; no distortion bugs)
// ---------------------------------------------------------------------------

function BarChart({
  data,
  metric,
  color,
  height = 140,
  interval,
}: {
  data: TimeseriesPoint[];
  metric: keyof TimeseriesPoint;
  color: string;
  height?: number;
  interval: "hour" | "day";
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
        No data
      </div>
    );
  }

  const W = 600;
  const H = height;
  const PAD = { top: 20, right: 8, bottom: 26, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const values = data.map((d) => d[metric] as number);
  const maxVal = Math.max(...values, 1);

  const n = data.length;
  // Each bar occupies an equal slot; bar width is 65% of that slot
  const slotW = chartW / Math.max(n, 1);
  const barW = Math.max(2, slotW * 0.65);

  // X-axis label positions: first, middle, last
  const labelIdxs = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]));

  return (
    // Fixed viewBox + width/height — no preserveAspectRatio="none" distortion
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={height}
      style={{ display: "block" }}
    >
      {/* Horizontal grid lines */}
      {[0, 0.5, 1].map((f) => {
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

      {/* Y-axis max label */}
      <text
        x={PAD.left - 6}
        y={PAD.top + 4}
        textAnchor="end"
        fontSize="10"
        fill={S.textMut}
      >
        {formatNumber(maxVal)}
      </text>
      <text
        x={PAD.left - 6}
        y={PAD.top + chartH / 2 + 4}
        textAnchor="end"
        fontSize="10"
        fill={S.textMut}
      >
        {formatNumber(maxVal / 2)}
      </text>

      {/* Bars */}
      {data.map((d, i) => {
        const val = d[metric] as number;
        // Minimum bar height of 2px so zero values are still visible as a thin line
        const barH = val > 0 ? Math.max(2, (val / maxVal) * chartH) : 0;
        const x = PAD.left + i * slotW + (slotW - barW) / 2;
        const y = PAD.top + chartH - barH;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            fill={color}
            rx="2"
            opacity="0.82"
          >
            <title>
              {formatDate(d.bucketStart, interval)}: {formatNumber(val)}
            </title>
          </rect>
        );
      })}

      {/* X-axis date labels */}
      {labelIdxs.map((i) => (
        <text
          key={i}
          x={PAD.left + i * slotW + slotW / 2}
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
          label="Visitors"
          value={ov ? formatNumber(ov.visitors) : undefined}
          testId="overview-visitors"
        />
        <StatCard
          label="Sessions"
          value={ov ? formatNumber(ov.sessions) : undefined}
          testId="overview-sessions"
        />
        <StatCard
          label="Pageviews"
          value={ov ? formatNumber(ov.pageviews) : undefined}
          testId="overview-pageviews"
        />
        <StatCard
          label="Events"
          value={ov ? formatNumber(ov.events) : undefined}
        />
        <StatCard
          label="Bounce Rate"
          value={ov ? `${(ov.bounceRate * 100).toFixed(1)}%` : undefined}
          testId="overview-bounce-rate"
        />
        <StatCard
          label="Avg Duration"
          value={ov ? formatDuration(ov.averageSessionDurationMs) : undefined}
          testId="overview-average-duration"
        />
      </div>

      {/* Chart */}
      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>Visitors over time</SectionTitle>
        {summary ? (
          <BarChart
            data={summary.timeseries}
            metric="visitors"
            color="#6366f1"
            interval={range.interval}
          />
        ) : (
          <div
            style={{
              height: 140,
              background: "#f8fafc",
              borderRadius: 6,
            }}
          />
        )}
      </Card>

      {/* Top Pages + Top Sources */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        <TopList title="Top Pages" data={summary?.topPages} />
        <TopList title="Top Sources" data={summary?.topSources} />
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
        <SectionTitle>Pageviews over time</SectionTitle>
        {timeseries ? (
          <BarChart
            data={timeseries}
            metric="pageviews"
            color="#0ea5e9"
            interval={range.interval}
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
          barColor="#0ea5e9"
          metric="pageviewCount"
        />
        <TopList title="Top Referrers" data={topReferrers} barColor="#0ea5e9" />
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
  return (
    <Card>
      <SectionTitle>Pageview Feed</SectionTitle>
      {results.length === 0 && status === "Exhausted" ? (
        <div style={{ color: S.textMut, fontSize: 13 }}>
          No pageviews in this period.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thSty}>Path</th>
                <th style={thSty}>Title</th>
                <th style={thSty}>Visitor</th>
                <th style={{ ...thSty, textAlign: "right" }}>Occurred</th>
              </tr>
            </thead>
            <tbody>
              {results.map((ev: any) => (
                <tr key={ev._id}>
                  <td style={tdSty}>{truncate(ev.path ?? "/", 60)}</td>
                  <td style={{ ...tdSty, color: S.textSec }}>
                    {truncate(ev.title ?? "", 40)}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      fontFamily: "monospace",
                      color: S.textSec,
                    }}
                  >
                    {truncate(ev.visitorId, 8)}
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
        <TopList title="Top Events" data={topEvents} barColor="#f59e0b" />
        <TopList title="Top Mediums" data={topMediums} barColor="#f59e0b" />
        <TopList title="Top Campaigns" data={topCampaigns} barColor="#f59e0b" />
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
      pageview: ["#dbeafe", "#1d4ed8"],
      track: ["#ede9fe", "#6d28d9"],
      identify: ["#d1fae5", "#065f46"],
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
      <SectionTitle>Raw Event Feed</SectionTitle>
      {results.length === 0 && status === "Exhausted" ? (
        <div style={{ color: S.textMut, fontSize: 13 }}>
          No events in this period.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                  <td style={{ ...tdSty, color: S.textSec }}>
                    {truncate(ev.path ?? "", 40)}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      fontFamily: "monospace",
                      color: S.textSec,
                    }}
                  >
                    {truncate(ev.visitorId, 8)}
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
        Accurate "all active visitors" requires scanning raw events for unique
        IDs, which hits Convex read limits at scale.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <TopList title="Countries" data={topCountries} barColor="#10b981" />
        <TopList title="Browsers" data={topBrowsers} barColor="#10b981" />
        <TopList title="Devices" data={topDevices} barColor="#10b981" />
        <TopList title="OS" data={topOs} barColor="#10b981" />
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
      <SectionTitle>Visitors</SectionTitle>
      {results.length === 0 && status === "Exhausted" ? (
        <div style={{ color: S.textMut, fontSize: 13 }}>
          No visitors in this period.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                  <td style={{ ...tdSty, fontFamily: "monospace" }}>
                    {truncate(v.visitorId, 8)}
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
                  >
                    {v.identifiedUserId
                      ? truncate(v.identifiedUserId, 28)
                      : "—"}
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
  return (
    <Card>
      <SectionTitle>Sessions</SectionTitle>
      {results.length === 0 && status === "Exhausted" ? (
        <div style={{ color: S.textMut, fontSize: 13 }}>
          No sessions in this period.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thSty}>Session ID</th>
                <th style={thSty}>Duration</th>
                <th style={thSty}>Pages</th>
                <th style={thSty}>Entry Path</th>
                <th style={thSty}>Referrer</th>
                <th style={thSty}>Device</th>
                <th style={{ ...thSty, textAlign: "right" }}>Started</th>
              </tr>
            </thead>
            <tbody>
              {results.map((s: any) => (
                <tr key={s._id}>
                  <td style={{ ...tdSty, fontFamily: "monospace" }}>
                    {truncate(s.sessionId, 8)}
                  </td>
                  <td style={tdSty}>
                    {formatDuration(Math.max(0, s.lastSeenAt - s.startedAt))}
                  </td>
                  <td style={tdSty}>{s.pageviewCount}</td>
                  <td style={{ ...tdSty, color: S.textSec }}>
                    {truncate(s.entryPath ?? "/", 40)}
                  </td>
                  <td style={{ ...tdSty, color: S.textSec }}>
                    {truncate(s.referrer ?? "—", 30)}
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
