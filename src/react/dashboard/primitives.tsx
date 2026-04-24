import type React from "react";

import { S, SECTION_ICONS } from "./constants";
import { formatNumber, formatPercent } from "./helpers";
import type { TopRow } from "./types";

export function Card({
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

export function SectionTitle({
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

export function StatCard({
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

export function TopList({
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

export function LoadMoreBtn({
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

export const thSty: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: S.textSec,
  whiteSpace: "nowrap",
  borderBottom: `1px solid ${S.border}`,
  background: S.slateWash,
};

export const tdSty: React.CSSProperties = {
  padding: "11px 12px",
  fontSize: 13,
  color: S.textPri,
  verticalAlign: "middle",
  borderBottom: `1px solid ${S.border}`,
};

export const tableWrapSty: React.CSSProperties = {
  overflowX: "auto",
};

export const tableSty: React.CSSProperties = {
  width: "100%",
  minWidth: "max-content",
  borderCollapse: "collapse",
};
