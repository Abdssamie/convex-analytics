import { usePaginatedQuery } from "convex/react";

import { S, SECTION_ICONS } from "../constants";
import { Card, LoadMoreBtn, SectionTitle, TopList, tdSty, thSty, tableSty, tableWrapSty } from "../primitives";
import type { AnalyticsDashboardProps, RawEventRow, TopRow } from "../types";

export function EventsPage({
  siteId,
  api,
  windowMs,
  topEvents,
  topMediums,
  topCampaigns,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  windowMs: number;
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
      <RawEventsFeed siteId={siteId} api={api} windowMs={windowMs} />
    </>
  );
}

function RawEventsFeed({
  siteId,
  api,
  windowMs,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  windowMs: number;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.listRawEvents,
    { siteId, windowMs },
    { initialNumItems: 25 },
  );
  const events = results as RawEventRow[];

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
      {events.length === 0 && status === "Exhausted" ? (
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
              {events.map((event) => (
                <tr key={event._id}>
                  <td style={{ ...tdSty, fontWeight: 500 }}>{event.eventName}</td>
                  <td style={tdSty}>{badge(event.eventType)}</td>
                  <td style={{ ...tdSty, color: S.textSec }} title={event.path ?? ""}>
                    {event.path ?? ""}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      fontFamily: "monospace",
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                    title={event.visitorId}
                  >
                    {event.visitorId}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      textAlign: "right",
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(event.occurredAt).toLocaleString()}
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
