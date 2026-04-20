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
      listRawEvents: FunctionReference<
        "query",
        "internal",
        { from?: number; limit?: number; siteId: string; to?: number },
        Array<{
          _creationTime: number;
          _id: string;
          aggregatedAt?: number;
          aggregationAttempts?: number;
          aggregationError?: string;
          aggregationStatus?: "pending" | "done" | "failed";
          contributesSession?: boolean;
          contributesVisitor?: boolean;
          dedupeKey?: string;
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
        }>,
        Name
      >;
      listSessions: FunctionReference<
        "query",
        "internal",
        { limit?: number; siteId: string },
        Array<{
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
        }>,
        Name
      >;
    };
    ingest: {
      aggregatePending: FunctionReference<
        "mutation",
        "internal",
        { limit?: number; now?: number; siteId: string },
        { aggregated: number; remaining: number; skipped: number },
        Name
      >;
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
            eventId?: string;
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
        { accepted: number; duplicate: number; rejected: number },
        Name
      >;
    };
    lib: {
      aggregatePending: FunctionReference<
        "mutation",
        "internal",
        { limit?: number; now?: number; siteId: string },
        { aggregated: number; remaining: number; skipped: number },
        Name
      >;
      cleanupSite: FunctionReference<
        "mutation",
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
          pageViews: number;
        },
        Name
      >;
      createSite: FunctionReference<
        "mutation",
        "internal",
        {
          allowedOrigins?: Array<string>;
          allowedPropertyKeys?: Array<string>;
          dailyRollupRetentionDays?: number;
          dedupeRetentionMs?: number;
          deniedPropertyKeys?: Array<string>;
          hourlyRollupRetentionDays?: number;
          name: string;
          pageViewRetentionDays?: number;
          rawEventRetentionDays?: number;
          retentionDays?: number;
          sessionTimeoutMs?: number;
          slug: string;
          writeKeyHash: string;
        },
        string,
        Name
      >;
      ensureSite: FunctionReference<
        "mutation",
        "internal",
        {
          allowedOrigins?: Array<string>;
          allowedPropertyKeys?: Array<string>;
          dailyRollupRetentionDays?: number;
          dedupeRetentionMs?: number;
          deniedPropertyKeys?: Array<string>;
          hourlyRollupRetentionDays?: number;
          name: string;
          pageViewRetentionDays?: number;
          rawEventRetentionDays?: number;
          retentionDays?: number;
          sessionTimeoutMs?: number;
          slug: string;
          writeKeyHash: string;
        },
        string,
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
            dedupeRetentionMs?: number;
            deniedPropertyKeys?: Array<string>;
            hourlyRollupRetentionDays?: number;
            pageViewRetentionDays?: number;
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
            eventId?: string;
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
        { accepted: number; duplicate: number; rejected: number },
        Name
      >;
      listRawEvents: FunctionReference<
        "query",
        "internal",
        { from?: number; limit?: number; siteId: string; to?: number },
        Array<{
          _creationTime: number;
          _id: string;
          aggregatedAt?: number;
          aggregationAttempts?: number;
          aggregationError?: string;
          aggregationStatus?: "pending" | "done" | "failed";
          contributesSession?: boolean;
          contributesVisitor?: boolean;
          dedupeKey?: string;
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
        }>,
        Name
      >;
      listSessions: FunctionReference<
        "query",
        "internal",
        { limit?: number; siteId: string },
        Array<{
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
        }>,
        Name
      >;
      pruneExpired: FunctionReference<
        "mutation",
        "internal",
        { limit?: number; now?: number },
        number,
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
          dedupeRetentionMs?: number;
          deniedPropertyKeys?: Array<string>;
          hourlyRollupRetentionDays?: number;
          name?: string;
          pageViewRetentionDays?: number;
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
    maintenance: {
      cleanupSite: FunctionReference<
        "mutation",
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
          pageViews: number;
        },
        Name
      >;
      pruneExpired: FunctionReference<
        "mutation",
        "internal",
        { limit?: number; now?: number },
        number,
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
          dedupeRetentionMs?: number;
          deniedPropertyKeys?: Array<string>;
          hourlyRollupRetentionDays?: number;
          name: string;
          pageViewRetentionDays?: number;
          rawEventRetentionDays?: number;
          retentionDays?: number;
          sessionTimeoutMs?: number;
          slug: string;
          writeKeyHash: string;
        },
        string,
        Name
      >;
      ensureSite: FunctionReference<
        "mutation",
        "internal",
        {
          allowedOrigins?: Array<string>;
          allowedPropertyKeys?: Array<string>;
          dailyRollupRetentionDays?: number;
          dedupeRetentionMs?: number;
          deniedPropertyKeys?: Array<string>;
          hourlyRollupRetentionDays?: number;
          name: string;
          pageViewRetentionDays?: number;
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
            dedupeRetentionMs?: number;
            deniedPropertyKeys?: Array<string>;
            hourlyRollupRetentionDays?: number;
            pageViewRetentionDays?: number;
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
          dedupeRetentionMs?: number;
          deniedPropertyKeys?: Array<string>;
          hourlyRollupRetentionDays?: number;
          name?: string;
          pageViewRetentionDays?: number;
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
