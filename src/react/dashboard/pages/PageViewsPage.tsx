import { usePaginatedQuery } from "convex/react";

import { INTERVALS, S, SECTION_ICONS } from "../constants";
import { Card, LoadMoreBtn, SectionTitle, TopList, tdSty, thSty, tableSty, tableWrapSty } from "../primitives";
import { TrendChart } from "../TrendChart";
import type { AnalyticsDashboardProps, TimeseriesPoint, TopRow } from "../types";

export function PageViewsPage({
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
