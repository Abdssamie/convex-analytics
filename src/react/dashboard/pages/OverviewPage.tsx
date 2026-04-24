import { useState } from "react";

import { INTERVALS, METRIC_META, S, SECTION_ICONS, STAT_META } from "../constants";
import { formatDate, formatDuration, formatNumber, safeDivide } from "../helpers";
import { Card, SectionTitle, StatCard, TopList } from "../primitives";
import { TrendChart } from "../TrendChart";
import type { DashboardSummary, TimeseriesPoint } from "../types";

export function OverviewPage({
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
  const pagesPerSession = ov ? safeDivide(ov.pageviews, ov.sessions) : undefined;
  const eventsPerSession = ov ? safeDivide(ov.events, ov.sessions) : undefined;
  const sessionsPerVisitor = ov ? safeDivide(ov.sessions, ov.visitors) : undefined;

  return (
    <>
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
          value={ov ? `${(ov.bounceRate * 100).toFixed(1)}%` : undefined}
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
