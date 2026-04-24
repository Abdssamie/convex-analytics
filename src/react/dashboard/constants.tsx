import type React from "react";

import type { OverviewStats, Page, TimeseriesPoint } from "./types";

export const INTERVALS = [
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
] as const;

export const S = {
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

export const METRIC_META: Record<
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

export const STAT_META: Record<
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

export const SECTION_ICONS: Record<string, React.ReactNode> = {
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

export const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
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
