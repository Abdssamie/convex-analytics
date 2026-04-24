import { usePaginatedQuery } from "convex/react";

import { S, SECTION_ICONS } from "../constants";
import { Card, LoadMoreBtn, SectionTitle, TopList, tdSty, thSty, tableSty, tableWrapSty } from "../primitives";
import type { AnalyticsDashboardProps, TopRow, VisitorRow } from "../types";

export function VisitorsPage({
  siteId,
  api,
  windowMs,
  topCountries,
  topBrowsers,
  topDevices,
  topOs,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  windowMs: number;
  topCountries: TopRow[] | undefined;
  topBrowsers: TopRow[] | undefined;
  topDevices: TopRow[] | undefined;
  topOs: TopRow[] | undefined;
}) {
  return (
    <>
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

      <VisitorsFeed siteId={siteId} api={api} windowMs={windowMs} />
    </>
  );
}

function VisitorsFeed({
  siteId,
  api,
  windowMs,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  windowMs: number;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.listVisitors,
    { siteId, windowMs },
    { initialNumItems: 25 },
  );
  const visitors = results as VisitorRow[];
  return (
    <Card>
      <SectionTitle icon={SECTION_ICONS.Visitors}>Visitors</SectionTitle>
      {visitors.length === 0 && status === "Exhausted" ? (
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
              {visitors.map((visitor) => (
                <tr key={visitor._id}>
                  <td
                    style={{ ...tdSty, fontFamily: "monospace", whiteSpace: "nowrap" }}
                    title={visitor.visitorId}
                  >
                    {visitor.visitorId}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(visitor.firstSeenAt).toLocaleString()}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(visitor.lastSeenAt).toLocaleString()}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      color: visitor.identifiedUserId ? S.textPri : S.textMut,
                    }}
                    title={visitor.identifiedUserId ?? "—"}
                  >
                    {visitor.identifiedUserId ?? "—"}
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
