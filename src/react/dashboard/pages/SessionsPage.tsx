import { usePaginatedQuery } from "convex/react";

import { S, SECTION_ICONS } from "../constants";
import { formatDuration, formatNumber } from "../helpers";
import { Card, LoadMoreBtn, SectionTitle, StatCard, tdSty, thSty, tableSty, tableWrapSty } from "../primitives";
import type {
  AnalyticsDashboardProps,
  OverviewStats,
  SessionRow,
} from "../types";

export function SessionsPage({
  siteId,
  api,
  windowMs,
  overview,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  windowMs: number;
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
          value={overview ? formatDuration(overview.averageSessionDurationMs) : undefined}
          sub="(requires full session scan)"
          testId="overview-average-duration"
        />
      </div>
      <SessionsFeed siteId={siteId} api={api} windowMs={windowMs} />
    </>
  );
}

function SessionsFeed({
  siteId,
  api,
  windowMs,
}: {
  siteId: string;
  api: AnalyticsDashboardProps["api"];
  windowMs: number;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.listSessions,
    { siteId, windowMs },
    { initialNumItems: 25 },
  );
  const sessions = results as SessionRow[];
  const hasExitPath = sessions.some((session) => Boolean(session.exitPath));
  return (
    <Card>
      <SectionTitle icon={SECTION_ICONS.Sessions}>Sessions</SectionTitle>
      {sessions.length === 0 && status === "Exhausted" ? (
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
              {sessions.map((session) => (
                <tr key={session._id}>
                  <td
                    style={{ ...tdSty, fontFamily: "monospace", whiteSpace: "nowrap" }}
                    title={session.sessionId}
                  >
                    {session.sessionId}
                  </td>
                  <td style={tdSty}>
                    {formatDuration(
                      Math.max(0, session.lastSeenAt - session.startedAt),
                    )}
                  </td>
                  <td style={tdSty}>{session.pageviewCount}</td>
                  <td
                    style={{ ...tdSty, color: S.textSec }}
                    title={session.entryPath ?? "/"}
                  >
                    {session.entryPath ?? "/"}
                  </td>
                  {hasExitPath ? (
                    <td
                      style={{ ...tdSty, color: S.textSec }}
                      title={session.exitPath ?? ""}
                    >
                      {session.exitPath ?? ""}
                    </td>
                  ) : null}
                  <td
                    style={{ ...tdSty, color: S.textSec }}
                    title={session.referrer ?? "—"}
                  >
                    {session.referrer ?? "—"}
                  </td>
                  <td style={{ ...tdSty, color: S.textSec }}>
                    {session.device ?? "—"}
                  </td>
                  <td
                    style={{
                      ...tdSty,
                      textAlign: "right",
                      color: S.textSec,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(session.startedAt).toLocaleString()}
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
