import { usePaginatedQuery } from "convex/react";

import { INTERVALS, S, SECTION_ICONS } from "../constants";
import { Card, LoadMoreBtn, SectionTitle, TopList, tdSty, thSty, tableSty, tableWrapSty } from "../primitives";
import { TrendChart } from "../TrendChart";
import type {
  AnalyticsDashboardProps,
  PageviewRow,
  TimeseriesPoint,
  TopRow,
} from "../types";

export function PageViewsPage({
  siteId,
  api,
  windowMs,
  timeseries,
  topPages,
  topReferrers,
  range,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  windowMs: number;
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
          <div style={{ height: 140, background: "#f8fafc", borderRadius: 6 }} />
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

      <PageviewsFeed siteId={siteId} api={api} windowMs={windowMs} />
    </>
  );
}

function PageviewsFeed({
  siteId,
  api,
  windowMs,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  windowMs: number;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.listPageviews,
    { siteId, windowMs },
    { initialNumItems: 25 },
  );
  const pageviews = results as PageviewRow[];
  const hasExitPath = pageviews.some((pageview) => Boolean(pageview.exitPath));
  return (
    <Card>
      <SectionTitle icon={SECTION_ICONS["Pageview Feed"]}>Pageview Feed</SectionTitle>
      {pageviews.length === 0 && status === "Exhausted" ? (
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
              {pageviews.map((pageview) => (
                <tr key={pageview._id}>
                  <td style={tdSty} title={pageview.path ?? "/"}>
                    {pageview.path ?? "/"}
                  </td>
                  <td
                    style={{ ...tdSty, color: S.textSec }}
                    title={pageview.title ?? ""}
                  >
                    {pageview.title ?? ""}
                  </td>
                  {hasExitPath ? (
                    <td
                      style={{ ...tdSty, color: S.textSec }}
                      title={pageview.exitPath ?? ""}
                    >
                      {pageview.exitPath ?? ""}
                    </td>
                  ) : null}
                  <td
                    style={{
                      ...tdSty,
                      fontFamily: "monospace",
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                    title={pageview.visitorId}
                  >
                    {pageview.visitorId}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      textAlign: "right",
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(pageview.occurredAt).toLocaleString()}
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
