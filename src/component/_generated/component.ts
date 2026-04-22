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
      getEventPropertyBreakdown: FunctionReference<
        "query",
        "internal",
        {
          eventName: string;
          from: number;
          limit?: number;
          propertyKey: string;
          siteId: string;
          to: number;
        },
        Array<{ count: number; value: string | number | boolean | null }>,
        Name
      >;
      getOverview: FunctionReference<
        "query",
        "internal",
        { from: number; siteId: string; to: number },
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
        { from: number; interval: "hour" | "day"; siteId: string; to: number },
        Array<{
          bucketStart: number;
          events: number;
          pageviews: number;
          sessions: number;
          visitors: number;
        }>,
        Name
      >;
      getTopCampaigns: FunctionReference<
        "query",
        "internal",
        { from: number; limit?: number; siteId: string; to: number },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopEvents: FunctionReference<
        "query",
        "internal",
        { from: number; limit?: number; siteId: string; to: number },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopMediums: FunctionReference<
        "query",
        "internal",
        { from: number; limit?: number; siteId: string; to: number },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopPages: FunctionReference<
        "query",
        "internal",
        { from: number; limit?: number; siteId: string; to: number },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopReferrers: FunctionReference<
        "query",
        "internal",
        { from: number; limit?: number; siteId: string; to: number },
        Array<{ count: number; key: string; pageviewCount: number }>,
        Name
      >;
      getTopSources: FunctionReference<
        "query",
        "internal",
        { from: number; limit?: number; siteId: string; to: number },
        Array<{ count: number; key: string; pageviewCount: number }>,
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
        },
        {
          continueCursor: string | null;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            aggregatedAt?: number | null;
            eventName: string;
            eventType: "pageview" | "track" | "identify";
            identifiedUserId?: string;
            occurredAt: number;
            path?: string;
            properties?: Record<string, string | number | boolean | null>;
            receivedAt: number;
            referrer?: string;
            sessionId: string;
            siteId: string;
            source?: string;
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
        },
        {
          continueCursor: string | null;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            bounce: boolean;
            browser?: string;
            country?: string;
            device?: string;
            durationMs: number;
            entryPath?: string;
            eventCount: number;
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
            source?: string;
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
          dailyRollupShards: number;
          events: number;
          hasMore: boolean;
          hourlyRollupShards: number;
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
          rollupShardCount?: number;
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
            rollupShardCount?: number;
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
          rollupShardCount?: number;
          sessionTimeoutMs?: number;
          siteId: string;
          status?: "active" | "disabled";
        },
        null,
        Name
      >;
    };
  };
