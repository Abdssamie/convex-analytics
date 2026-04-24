/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    analytics: {
      getDashboardSummary: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          interval: "hour" | "day";
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        {
          overview: {
            averageSessionDurationMs: number;
            bounceRate: number;
            events: number;
            pageviews: number;
            sessions: number;
            visitors: number;
          };
          timeseries: Array<{
            bucketStart: number;
            events: number;
            pageviews: number;
            sessions: number;
            visitors: number;
          }>;
          topPages: Array<{
            count: number;
            key: string;
            pageviewCount: number;
          }>;
          topSources: Array<{
            count: number;
            key: string;
            pageviewCount: number;
          }>;
        },
        Name
      >;
      getEventPropertyBreakdown: FunctionReference<
        "query",
        "internal",
        {
          eventName: string;
          from?: number;
          limit?: number;
          propertyKey: string;
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{ count: number; value: string | number | boolean | null }>,
        Name
      >;
      getOverview: FunctionReference<
        "query",
        "internal",
        { from?: number; siteId: string; to?: number; windowMs?: number },
        {
          averageSessionDurationMs: number;
          bounceRate: number;
          events: number;
          pageviews: number;
          sessions: number;
          visitors: number;
        },
        Name
      >;
      getTimeseries: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          interval: "hour" | "day";
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{
          bucketStart: number;
          events: number;
          pageviews: number;
          sessions: number;
          visitors: number;
        }>,
        Name
      >;
      getTopBrowsers: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          limit?: number;
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopCampaigns: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          limit?: number;
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopCountries: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          limit?: number;
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopDevices: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          limit?: number;
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopEvents: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          limit?: number;
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopMediums: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          limit?: number;
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopOs: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          limit?: number;
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopPages: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          limit?: number;
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopReferrers: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          limit?: number;
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopSources: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          limit?: number;
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      listPageviews: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        {
          continueCursor: string | null;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            aggregatedAt?: number | null;
            browser?: string;
            country?: string;
            device?: string;
            eventName: string;
            eventType: "pageview" | "track" | "identify";
            identifiedUserId?: string;
            occurredAt: number;
            os?: string;
            path?: string;
            properties?: Record<string, string | number | boolean | null>;
            receivedAt: number;
            referrer?: string;
            sessionId: string;
            siteId: string;
            title?: string;
            utmCampaign?: string;
            utmMedium?: string;
            utmSource?: string;
            visitorId: string;
          }>;
          pageStatus?: string | null;
          splitCursor?: string | null;
        },
        Name
      >;
      listRawEvents: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        {
          continueCursor: string | null;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            aggregatedAt?: number | null;
            browser?: string;
            country?: string;
            device?: string;
            eventName: string;
            eventType: "pageview" | "track" | "identify";
            identifiedUserId?: string;
            occurredAt: number;
            os?: string;
            path?: string;
            properties?: Record<string, string | number | boolean | null>;
            receivedAt: number;
            referrer?: string;
            sessionId: string;
            siteId: string;
            title?: string;
            utmCampaign?: string;
            utmMedium?: string;
            utmSource?: string;
            visitorId: string;
          }>;
          pageStatus?: string | null;
          splitCursor?: string | null;
        },
        Name
      >;
      listSessions: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        {
          continueCursor: string | null;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            browser?: string;
            country?: string;
            device?: string;
            entryPath?: string;
            exitPath?: string;
            identifiedUserId?: string;
            lastSeenAt: number;
            os?: string;
            pageviewCount: number;
            referrer?: string;
            sessionId: string;
            siteId: string;
            startedAt: number;
            utmCampaign?: string;
            utmMedium?: string;
            utmSource?: string;
            visitorId: string;
          }>;
          pageStatus?: string | null;
          splitCursor?: string | null;
        },
        Name
      >;
      listVisitors: FunctionReference<
        "query",
        "internal",
        {
          from?: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          siteId: string;
          to?: number;
          windowMs?: number;
        },
        {
          continueCursor: string | null;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            firstSeenAt: number;
            identifiedUserId?: string;
            lastSeenAt: number;
            siteId: string;
            traits?: Record<string, string | number | boolean | null>;
            visitorId: string;
          }>;
          pageStatus?: string | null;
          splitCursor?: string | null;
        },
        Name
      >;
    };
    ingest: {
      ingestBatch: FunctionReference<
        "mutation",
        "internal",
        {
          context?: {
            browser?: string;
            country?: string;
            device?: string;
            os?: string;
            utmCampaign?: string;
            utmMedium?: string;
            utmSource?: string;
          };
          events: Array<{
            name?: string;
            occurredAt?: number;
            path?: string;
            properties?: Record<string, string | number | boolean | null>;
            referrer?: string;
            title?: string;
            type: "pageview" | "track" | "identify";
            userId?: string;
          }>;
          origin?: string;
          sessionId: string;
          visitorId: string;
          writeKeyHash: string;
        },
        { accepted: number; rejected: number },
        Name
      >;
    };
    local: {
      wipe: {
        wipePage: FunctionReference<
          "mutation",
          "internal",
          { limit?: number },
          { deleted: number; hasMore: boolean; lastTable: string | null },
          Name
        >;
      };
    };
    maintenance: {
      cleanupSite: FunctionReference<
        "action",
        "internal",
        {
          limit?: number;
          now?: number;
          runUntilComplete?: boolean;
          siteId?: string;
          slug?: string;
        },
        {
          dailyRollups: number;
          events: number;
          hasMore: boolean;
          hourlyRollups: number;
        },
        Name
      >;
    };
    sites: {
      createSite: FunctionReference<
        "mutation",
        "internal",
        {
          allowedOrigins?: Array<string>;
          allowedPropertyKeys?: Array<string>;
          dailyRollupRetentionDays?: number;
          deniedPropertyKeys?: Array<string>;
          hourlyRollupRetentionDays?: number;
          name: string;
          rawEventRetentionDays?: number;
          retentionDays?: number;
          sessionTimeoutMs?: number;
          slug: string;
          writeKeyHash: string;
        },
        string,
        Name
      >;
      getSiteBySlug: FunctionReference<
        "query",
        "internal",
        { slug: string },
        null | {
          _creationTime: number;
          _id: string;
          allowedOrigins: Array<string>;
          createdAt: number;
          name: string;
          settings: {
            allowedPropertyKeys?: Array<string>;
            dailyRollupRetentionDays?: number;
            deniedPropertyKeys?: Array<string>;
            hourlyRollupRetentionDays?: number;
            rawEventRetentionDays?: number;
            retentionDays: number;
            sessionTimeoutMs: number;
          };
          slug: string;
          status: "active" | "disabled";
          updatedAt: number;
          writeKeyHash: string;
        },
        Name
      >;
      rotateWriteKey: FunctionReference<
        "mutation",
        "internal",
        { siteId: string; writeKeyHash: string },
        null,
        Name
      >;
      updateSite: FunctionReference<
        "mutation",
        "internal",
        {
          allowedOrigins?: Array<string>;
          allowedPropertyKeys?: Array<string>;
          dailyRollupRetentionDays?: number;
          deniedPropertyKeys?: Array<string>;
          hourlyRollupRetentionDays?: number;
          name?: string;
          rawEventRetentionDays?: number;
          retentionDays?: number;
          sessionTimeoutMs?: number;
          siteId: string;
          status?: "active" | "disabled";
        },
        null,
        Name
      >;
    };
  };
