"use client";

import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import React, { useMemo, useState } from "react";

export interface OverviewStats {
  visitors: number;
  sessions: number;
  pageviews: number;
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

export interface AnalyticsDashboardProps {
  siteId: string;
  api: {
    getOverview: FunctionReference<"query">;
    getTimeseries: FunctionReference<"query">;
    getTopPages: FunctionReference<"query">;
    getTopReferrers: FunctionReference<"query">;
    getTopSources: FunctionReference<"query">;
    getTopMediums: FunctionReference<"query">;
    getTopCampaigns: FunctionReference<"query">;
    getTopEvents: FunctionReference<"query">;
  };
  className?: string;
  style?: React.CSSProperties;
}

const INTERVALS = [
  { label: "Last 24 Hours", value: 24 * 60 * 60 * 1000, interval: "hour" as const },
  { label: "Last 7 Days", value: 7 * 24 * 60 * 60 * 1000, interval: "day" as const },
  { label: "Last 30 Days", value: 30 * 24 * 60 * 60 * 1000, interval: "day" as const },
];

export function AnalyticsDashboard({ siteId, api, className, style }: AnalyticsDashboardProps) {
  const [rangeIndex, setRangeIndex] = useState(1); // Default to Last 7 Days
  const range = INTERVALS[rangeIndex];

  const to = useMemo(() => Date.now(), [rangeIndex]);
  const from = useMemo(() => to - range.value, [to, range.value]);

  const overview = useQuery(api.getOverview, { siteId, from, to }) as OverviewStats | undefined;
  const timeseries = useQuery(api.getTimeseries, { siteId, from, to, interval: range.interval }) as TimeseriesPoint[] | undefined;
  const topPages = useQuery(api.getTopPages, { siteId, from, to, limit: 10 }) as TopRow[] | undefined;
  const topReferrers = useQuery(api.getTopReferrers, { siteId, from, to, limit: 10 }) as TopRow[] | undefined;
  const topSources = useQuery(api.getTopSources, { siteId, from, to, limit: 10 }) as TopRow[] | undefined;
  const topMediums = useQuery(api.getTopMediums, { siteId, from, to, limit: 10 }) as TopRow[] | undefined;
  const topCampaigns = useQuery(api.getTopCampaigns, { siteId, from, to, limit: 10 }) as TopRow[] | undefined;
  const topEvents = useQuery(api.getTopEvents, { siteId, from, to, limit: 10 }) as TopRow[] | undefined;

  if (!overview || !timeseries || !topPages || !topReferrers || !topSources || !topMediums || !topCampaigns || !topEvents) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>Loading analytics...</div>;
  }

  return (
    <div className={className} style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      color: '#111827',
      maxWidth: 1000,
      margin: '0 auto',
      padding: '24px',
      ...style 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Analytics Overview</h2>
        <select 
          value={rangeIndex} 
          onChange={(e) => setRangeIndex(parseInt(e.target.value))}
          style={{ 
            padding: '8px 12px', 
            borderRadius: 6, 
            border: '1px solid #d1d5db',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          {INTERVALS.map((int, i) => (
            <option key={int.label} value={i}>{int.label}</option>
          ))}
        </select>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: 16, 
        marginBottom: 32 
      }}>
        <StatsCard label="Visitors" value={formatNumber(overview.visitors)} testId="overview-visitors" />
        <StatsCard label="Sessions" value={formatNumber(overview.sessions)} testId="overview-sessions" />
        <StatsCard label="Pageviews" value={formatNumber(overview.pageviews)} testId="overview-pageviews" />
        <StatsCard label="Bounce Rate" value={`${(overview.bounceRate * 100).toFixed(1)}%`} testId="overview-bounce-rate" />
        <StatsCard label="Avg. Duration" value={formatDuration(overview.averageSessionDurationMs)} testId="overview-average-duration" />
      </div>

      <div style={{ 
        background: 'white', 
        border: '1px solid #e5e7eb', 
        borderRadius: 8, 
        padding: 24, 
        marginBottom: 32 
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#4b5563' }}>Visitors over time</h3>
        <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          {timeseries.map((d: TimeseriesPoint) => {
            const max = Math.max(...timeseries.map((t: TimeseriesPoint) => t.visitors), 1);
            const height = (d.visitors / max) * 100;
            return (
              <div 
                key={d.bucketStart} 
                title={`${new Date(d.bucketStart).toLocaleDateString()}: ${d.visitors} visitors`}
                style={{ 
                  flex: 1, 
                  height: `${height}%`, 
                  backgroundColor: '#0f766e', 
                  borderRadius: '1px 1px 0 0',
                  minWidth: 4
                }} 
              />
            );
          })}
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: 24,
        marginBottom: 24
      }}>
        <DashboardBox title="Top Pages">
          <TopTable data={topPages} />
        </DashboardBox>
        <DashboardBox title="Top Referrers">
          <TopTable data={topReferrers} />
        </DashboardBox>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: 24,
        marginBottom: 24
      }}>
        <DashboardBox title="Top Sources">
          <TopTable data={topSources} />
        </DashboardBox>
        <DashboardBox title="Top Mediums">
          <TopTable data={topMediums} />
        </DashboardBox>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: 24 
      }}>
        <DashboardBox title="Top Campaigns">
          <TopTable data={topCampaigns} />
        </DashboardBox>
        <DashboardBox title="Top Events">
          <TopTable data={topEvents} />
        </DashboardBox>
      </div>
    </div>
  );
}

function DashboardBox({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#4b5563' }}>{title}</h3>
      {children}
    </div>
  );
}

function StatsCard({ label, value, testId }: { label: string, value: string, testId?: string }) {
  return (
    <div
      data-testid={testId}
      style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}
    >
      <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div data-testid={testId ? `${testId}-value` : undefined} style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function TopTable({ data }: { data: TopRow[] }) {
  const max = Math.max(...data.map((d: TopRow) => d.count), 1);
  return (
    <div style={{ width: '100%' }}>
      {data.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 14 }}>No data available</div>
      ) : (
        data.map((item: TopRow) => (
          <div key={item.key} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                {item.key || '(direct)'}
              </span>
              <span style={{ fontWeight: 600 }}>{formatNumber(item.count)}</span>
            </div>
            <div style={{ height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', backgroundColor: '#0f766e', width: `${(item.count / max) * 100}%` }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
