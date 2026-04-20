import {
  httpActionGeneric,
  mutationGeneric,
  queryGeneric,
  type Auth,
  type GenericActionCtx,
  type GenericDataModel,
  type HttpRouter,
} from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";

type Operation =
  | { type: "admin"; siteId?: string }
  | { type: "read"; siteId: string };

type AuthFn = (ctx: { auth: Auth }, operation: Operation) => Promise<void>;

type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;

type SiteConfig = {
  slug: string;
  name: string;
  writeKey?: string;
  writeKeyHash?: string;
  allowedOrigins?: string[];
  sessionTimeoutMs?: number;
  retentionDays?: number;
  allowedPropertyKeys?: string[];
  deniedPropertyKeys?: string[];
};

const ensureIntervalMs = 60 * 1000;
const lastEnsuredAtByHash = new Map<string, number>();

export function exposeApi(
  component: ComponentApi,
  options: {
    auth: AuthFn;
  },
) {
  return {
    createSite: mutationGeneric({
      args: {
        slug: v.string(),
        name: v.string(),
        writeKey: v.string(),
        allowedOrigins: v.optional(v.array(v.string())),
        sessionTimeoutMs: v.optional(v.number()),
        retentionDays: v.optional(v.number()),
        allowedPropertyKeys: v.optional(v.array(v.string())),
        deniedPropertyKeys: v.optional(v.array(v.string())),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "admin" });
        const {
          writeKey,
          slug,
          name,
          allowedOrigins,
          sessionTimeoutMs,
          retentionDays,
          allowedPropertyKeys,
          deniedPropertyKeys,
        } = args;
        return await ctx.runMutation(component.lib.createSite, {
          slug,
          name,
          allowedOrigins,
          sessionTimeoutMs,
          retentionDays,
          allowedPropertyKeys,
          deniedPropertyKeys,
          writeKeyHash: await hashWriteKey(writeKey),
        });
      },
    }),
    ensureSite: mutationGeneric({
      args: {
        slug: v.string(),
        name: v.string(),
        writeKey: v.string(),
        allowedOrigins: v.optional(v.array(v.string())),
        sessionTimeoutMs: v.optional(v.number()),
        retentionDays: v.optional(v.number()),
        allowedPropertyKeys: v.optional(v.array(v.string())),
        deniedPropertyKeys: v.optional(v.array(v.string())),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "admin" });
        const {
          writeKey,
          slug,
          name,
          allowedOrigins,
          sessionTimeoutMs,
          retentionDays,
          allowedPropertyKeys,
          deniedPropertyKeys,
        } = args;
        return await ctx.runMutation(component.lib.ensureSite, {
          slug,
          name,
          allowedOrigins,
          sessionTimeoutMs,
          retentionDays,
          allowedPropertyKeys,
          deniedPropertyKeys,
          writeKeyHash: await hashWriteKey(writeKey),
        });
      },
    }),
    updateSite: mutationGeneric({
      args: {
        siteId: v.string(),
        name: v.optional(v.string()),
        status: v.optional(v.union(v.literal("active"), v.literal("disabled"))),
        allowedOrigins: v.optional(v.array(v.string())),
        sessionTimeoutMs: v.optional(v.number()),
        retentionDays: v.optional(v.number()),
        allowedPropertyKeys: v.optional(v.array(v.string())),
        deniedPropertyKeys: v.optional(v.array(v.string())),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, {
          type: "admin",
          siteId: args.siteId,
        });
        return await ctx.runMutation(component.lib.updateSite, args);
      },
    }),
    rotateWriteKey: mutationGeneric({
      args: {
        siteId: v.string(),
        writeKey: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, {
          type: "admin",
          siteId: args.siteId,
        });
        return await ctx.runMutation(component.lib.rotateWriteKey, {
          siteId: args.siteId,
          writeKeyHash: await hashWriteKey(args.writeKey),
        });
      },
    }),
    aggregatePending: mutationGeneric({
      args: {
        siteId: v.string(),
        now: v.optional(v.number()),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, {
          type: "admin",
          siteId: args.siteId,
        });
        return await ctx.runMutation(component.lib.aggregatePending, args);
      },
    }),
    getSiteBySlug: queryGeneric({
      args: { slug: v.string() },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "admin" });
        return await ctx.runQuery(component.lib.getSiteBySlug, args);
      },
    }),
    getOverview: queryGeneric({
      args: { siteId: v.string(), from: v.number(), to: v.number() },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read", siteId: args.siteId });
        return await ctx.runQuery(component.lib.getOverview, args);
      },
    }),
    getTimeseries: queryGeneric({
      args: {
        siteId: v.string(),
        from: v.number(),
        to: v.number(),
        interval: v.union(v.literal("hour"), v.literal("day")),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read", siteId: args.siteId });
        return await ctx.runQuery(component.lib.getTimeseries, args);
      },
    }),
    getTopPages: queryGeneric({
      args: {
        siteId: v.string(),
        from: v.number(),
        to: v.number(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read", siteId: args.siteId });
        return await ctx.runQuery(component.lib.getTopPages, args);
      },
    }),
    getTopReferrers: queryGeneric({
      args: {
        siteId: v.string(),
        from: v.number(),
        to: v.number(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read", siteId: args.siteId });
        return await ctx.runQuery(component.lib.getTopReferrers, args);
      },
    }),
    getTopCampaigns: queryGeneric({
      args: {
        siteId: v.string(),
        from: v.number(),
        to: v.number(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read", siteId: args.siteId });
        return await ctx.runQuery(component.lib.getTopCampaigns, args);
      },
    }),
    getTopEvents: queryGeneric({
      args: {
        siteId: v.string(),
        from: v.number(),
        to: v.number(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read", siteId: args.siteId });
        return await ctx.runQuery(component.lib.getTopEvents, args);
      },
    }),
    listRawEvents: queryGeneric({
      args: {
        siteId: v.string(),
        from: v.optional(v.number()),
        to: v.optional(v.number()),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read", siteId: args.siteId });
        return await ctx.runQuery(component.lib.listRawEvents, args);
      },
    }),
    listSessions: queryGeneric({
      args: { siteId: v.string(), limit: v.optional(v.number()) },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read", siteId: args.siteId });
        return await ctx.runQuery(component.lib.listSessions, args);
      },
    }),
  };
}

export function registerRoutes(
  http: HttpRouter,
  component: ComponentApi,
  options?: {
    path?: string;
    allowedHeaders?: string[];
    site?: SiteConfig;
    sites?: SiteConfig[];
  },
) {
  const path = options?.path ?? "/analytics/ingest";
  const allowedHeaders = options?.allowedHeaders ?? [
    "content-type",
    "x-analytics-write-key",
  ];
  const configuredSites = options?.sites ?? (options?.site ? [options.site] : []);

  http.route({
    path,
    method: "OPTIONS",
    handler: httpActionGeneric(async () => {
      return new Response(null, {
        status: 204,
        headers: corsHeaders("*", allowedHeaders),
      });
    }),
  });

  http.route({
    path,
    method: "POST",
    handler: httpActionGeneric(async (ctx, request) => {
      const origin = request.headers.get("origin") ?? undefined;
      const writeKey =
        request.headers.get("x-analytics-write-key") ??
        new URL(request.url).searchParams.get("writeKey");
      if (!writeKey) {
        return jsonResponse({ error: "Missing analytics write key" }, 401, origin);
      }
      const writeKeyHash = await hashWriteKey(writeKey);
      const configuredSite =
        configuredSites.length > 0
          ? await findConfiguredSite(configuredSites, writeKeyHash)
          : null;
      if (configuredSites.length > 0 && !configuredSite) {
        return jsonResponse({ error: "Invalid analytics write key" }, 401, origin);
      }
      if (configuredSite) {
        await ensureConfiguredSite(ctx, component, configuredSite, writeKeyHash);
      }
      const body = await request.json();
      const result = await ingestFromHttp(ctx, component, {
        writeKeyHash,
        origin,
        visitorId: String(readRecord(body).visitorId ?? ""),
        sessionId: String(readRecord(body).sessionId ?? ""),
        context: normalizeContext(readRecord(body).context),
        events: normalizeEvents(readRecord(body).events),
      });
      return jsonResponse(result, 202, origin);
    }),
  });
}

export async function ingestFromHttp(
  ctx: ActionCtx,
  component: ComponentApi,
  args: {
    writeKey?: string;
    writeKeyHash?: string;
    origin?: string;
    visitorId: string;
    sessionId: string;
    context?: IngestContext;
    events: IngestEventInput[];
  },
) {
  if (!args.visitorId || !args.sessionId) {
    throw new Error("visitorId and sessionId are required");
  }
  const writeKeyHash =
    args.writeKeyHash ??
    (args.writeKey ? await hashWriteKey(args.writeKey) : undefined);
  if (!writeKeyHash) {
    throw new Error("writeKey or writeKeyHash is required");
  }
  return await ctx.runMutation(component.lib.ingestBatch, {
    writeKeyHash,
    origin: args.origin,
    visitorId: args.visitorId,
    sessionId: args.sessionId,
    context: args.context,
    events: args.events,
  });
}

async function findConfiguredSite(sites: SiteConfig[], writeKeyHash: string) {
  for (const site of sites) {
    const configuredHash =
      site.writeKeyHash ??
      (site.writeKey ? await hashWriteKey(site.writeKey) : undefined);
    if (configuredHash === writeKeyHash) {
      return site;
    }
  }
  return null;
}

async function ensureConfiguredSite(
  ctx: ActionCtx,
  component: ComponentApi,
  site: SiteConfig,
  writeKeyHash: string,
) {
  const now = Date.now();
  const lastEnsuredAt = lastEnsuredAtByHash.get(writeKeyHash) ?? 0;
  if (now - lastEnsuredAt < ensureIntervalMs) {
    return;
  }
  await ctx.runMutation(component.lib.ensureSite, {
    slug: site.slug,
    name: site.name,
    writeKeyHash,
    allowedOrigins: site.allowedOrigins,
    sessionTimeoutMs: site.sessionTimeoutMs,
    retentionDays: site.retentionDays,
    allowedPropertyKeys: site.allowedPropertyKeys,
    deniedPropertyKeys: site.deniedPropertyKeys,
  });
  lastEnsuredAtByHash.set(writeKeyHash, now);
}

export async function hashWriteKey(writeKey: string) {
  const bytes = new TextEncoder().encode(writeKey);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

type AnalyticsEvent =
  | {
      type: "pageview";
      path?: string;
      title?: string;
      referrer?: string;
      properties?: AnalyticsProperties;
      eventId?: string;
      occurredAt?: number;
    }
  | {
      type: "track";
      name: string;
      path?: string;
      properties?: AnalyticsProperties;
      eventId?: string;
      occurredAt?: number;
    }
  | {
      type: "identify";
      userId: string;
      properties?: AnalyticsProperties;
      eventId?: string;
      occurredAt?: number;
    };

type AnalyticsProperties = Record<string, string | number | boolean | null>;

type IngestContext = {
  source?: string;
  device?: string;
  browser?: string;
  os?: string;
  country?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

type IngestEventInput = {
  type: "pageview" | "track" | "identify";
  name?: string;
  occurredAt?: number;
  path?: string;
  title?: string;
  referrer?: string;
  properties?: AnalyticsProperties;
  userId?: string;
  eventId?: string;
};

export function createAnalytics(options: {
  endpoint: string;
  writeKey: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  autoPageviews?: boolean;
}) {
  const flushIntervalMs = options.flushIntervalMs ?? 5000;
  const maxBatchSize = options.maxBatchSize ?? 10;
  const queue: AnalyticsEvent[] = [];
  const visitorId = getOrCreateStoredId("convex_analytics_visitor_id");
  let sessionId = getOrCreateSessionId();
  let timer: ReturnType<typeof setInterval> | null = null;

  async function flush() {
    if (queue.length === 0) {
      return;
    }
    const events = queue.splice(0, maxBatchSize);
    const payload = JSON.stringify({
      visitorId,
      sessionId,
      context: browserContext(),
      events,
    });
    try {
      await fetch(options.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-analytics-write-key": options.writeKey,
        },
        body: payload,
        keepalive: true,
      });
    } catch {
      queue.unshift(...events);
    }
  }

  function enqueue(event: AnalyticsEvent) {
    queue.push({
      occurredAt: Date.now(),
      eventId: randomId(),
      ...event,
    });
    if (queue.length >= maxBatchSize) {
      void flush();
    }
  }

  const client = {
    page(properties?: AnalyticsProperties) {
      enqueue({
        type: "pageview",
        path: globalThis.location?.pathname ?? undefined,
        title: globalThis.document?.title ?? undefined,
        referrer: globalThis.document?.referrer || undefined,
        properties,
      });
    },
    track(name: string, properties?: AnalyticsProperties) {
      enqueue({
        type: "track",
        name,
        path: globalThis.location?.pathname ?? undefined,
        properties,
      });
    },
    identify(userId: string, properties?: AnalyticsProperties) {
      enqueue({ type: "identify", userId, properties });
    },
    reset() {
      sessionId = randomId();
      try {
        sessionStorage.setItem("convex_analytics_session_id", sessionId);
        sessionStorage.setItem("convex_analytics_session_seen_at", `${Date.now()}`);
      } catch {
        // Ignore storage failures in privacy-restricted browsers.
      }
    },
    flush,
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };

  if (typeof window !== "undefined") {
    timer = setInterval(() => void flush(), flushIntervalMs);
    window.addEventListener("pagehide", () => {
      void flush();
    });
    if (options.autoPageviews ?? true) {
      client.page();
    }
  }

  return client;
}

function corsHeaders(origin: string, allowedHeaders: string[]) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": allowedHeaders.join(", "),
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status: number, origin?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(origin ?? "*", ["content-type", "x-analytics-write-key"]),
    },
  });
}

function readRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeContext(value: unknown): IngestContext | undefined {
  const record = readRecord(value);
  const context: IngestContext = {};
  for (const key of [
    "source",
    "device",
    "browser",
    "os",
    "country",
    "utmSource",
    "utmMedium",
    "utmCampaign",
  ] as const) {
    if (typeof record[key] === "string") {
      context[key] = record[key];
    }
  }
  return Object.keys(context).length === 0 ? undefined : context;
}

function normalizeEvents(value: unknown): IngestEventInput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const record = readRecord(item);
    if (
      record.type !== "pageview" &&
      record.type !== "track" &&
      record.type !== "identify"
    ) {
      return [];
    }
    const event: IngestEventInput = { type: record.type };
    for (const key of [
      "name",
      "path",
      "title",
      "referrer",
      "userId",
      "eventId",
    ] as const) {
      if (typeof record[key] === "string") {
        event[key] = record[key];
      }
    }
    if (typeof record.occurredAt === "number") {
      event.occurredAt = record.occurredAt;
    }
    const properties = normalizeProperties(record.properties);
    if (properties) {
      event.properties = properties;
    }
    return [event];
  });
}

function normalizeProperties(value: unknown): AnalyticsProperties | undefined {
  const record = readRecord(value);
  const properties: AnalyticsProperties = {};
  for (const [key, item] of Object.entries(record)) {
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean" ||
      item === null
    ) {
      properties[key] = item;
    }
  }
  return Object.keys(properties).length === 0 ? undefined : properties;
}

function getOrCreateStoredId(key: string) {
  try {
    const existing = localStorage.getItem(key);
    if (existing) {
      return existing;
    }
    const next = randomId();
    localStorage.setItem(key, next);
    return next;
  } catch {
    return randomId();
  }
}

function getOrCreateSessionId() {
  const now = Date.now();
  const timeoutMs = 30 * 60 * 1000;
  try {
    const existing = sessionStorage.getItem("convex_analytics_session_id");
    const seenAt = Number(
      sessionStorage.getItem("convex_analytics_session_seen_at") ?? "0",
    );
    if (existing && now - seenAt < timeoutMs) {
      sessionStorage.setItem("convex_analytics_session_seen_at", `${now}`);
      return existing;
    }
    const next = randomId();
    sessionStorage.setItem("convex_analytics_session_id", next);
    sessionStorage.setItem("convex_analytics_session_seen_at", `${now}`);
    return next;
  } catch {
    return randomId();
  }
}

function browserContext() {
  if (typeof window === "undefined") {
    return undefined;
  }
  const params = new URLSearchParams(window.location.search);
  return {
    source: "browser",
    utmSource: params.get("utm_source") ?? undefined,
    utmMedium: params.get("utm_medium") ?? undefined,
    utmCampaign: params.get("utm_campaign") ?? undefined,
  };
}

function randomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
