# Convex Analytics

A Convex component for first-party product and web analytics. It stores events
directly in your Convex deployment, with browser batching, anonymous visitors,
sessions, raw event history, and async rollup-backed reports.

This component is designed for apps that want Rybbit-style core analytics
without running a separate analytics service.

## What It Tracks

- Pageviews
- Custom product events
- Anonymous visitors
- Sessions
- `identify(userId, traits)` links
- Referrers and UTM campaign fields
- Top pages, events, referrers, and campaigns
- Overview and timeseries reports

## Architecture

The component owns its own Convex tables:

- `sites`: one tracked site/app per write key
- `visitors`: durable anonymous visitor records
- `sessions`: session windows and coarse device/source summary
- `events`: append-only raw events with pending/done aggregation state
- `pageViews`: denormalized pageview rows
- `rollupShards`: sharded hourly/daily report counters
- `ingestDedupes`: short-lived retry/idempotency cache

Why `sites` exists: one Convex deployment can track multiple sites or apps.
For the common one-site case, create one site named `default` and ignore the
multi-site parts until needed.

Browser traffic should use the HTTP ingest route. Do not send every browser
event through public Convex mutations. The SDK batches events and the HTTP route
hashes the write key before calling the component.

Ingest and reporting are split on purpose. The ingest mutation writes raw events
quickly, marks them `pending`, and schedules background aggregation. The
aggregator updates sharded rollup counters and marks each event `done` in the
same transaction, so retries do not double-count. Reports read `rollupShards`,
so they can lag raw events by a few seconds.

## Installation

Install the component in `convex/convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import convexAnalytics from "@Abdssamie/convex-analytics/convex.config.js";

const app = defineApp();
app.use(convexAnalytics, { httpPrefix: "/analytics-component/" });

export default app;
```

Register the HTTP ingest route in `convex/http.ts`. The route config is the
trusted site registry. Browser callers cannot create or modify sites.

```ts
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { registerRoutes } from "@Abdssamie/convex-analytics";

const http = httpRouter();

registerRoutes(http, components.convexAnalytics, {
  path: "/analytics/ingest",
  sites: [
    {
      slug: "default",
      name: "Default site",
      writeKey: process.env.ANALYTICS_WRITE_KEY!,
      allowedOrigins: ["https://example.com"],
    },
  ],
});

export default http;
```

For multiple sites on the same Convex deployment, add more site configs with
separate write keys and origins:

```ts
registerRoutes(http, components.convexAnalytics, {
  path: "/analytics/ingest",
  sites: [
    {
      slug: "app",
      name: "Product App",
      writeKey: process.env.ANALYTICS_APP_WRITE_KEY!,
      allowedOrigins: ["https://app.example.com"],
    },
    {
      slug: "marketing",
      name: "Marketing Site",
      writeKey: process.env.ANALYTICS_MARKETING_WRITE_KEY!,
      allowedOrigins: ["https://example.com"],
    },
  ],
});
```

The route auto-ensures configured sites from server config during ingest. The
component stores only `writeKeyHash`, not raw write keys.

The browser write key is an ingest credential, not an admin secret. Treat it like
a publishable key: make it long and random, restrict `allowedOrigins`, and rotate
it if leaked.

Expose report/admin wrappers only if your app needs them:

```ts
import { components } from "./_generated/api";
import { exposeApi } from "@Abdssamie/convex-analytics";

export const {
  getOverview,
  getTimeseries,
  getTopPages,
  aggregatePending,
  listRawEvents,
  listSessions,
} = exposeApi(components.convexAnalytics, {
  auth: async (ctx, operation) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    // Add your own site ownership check here for operation.siteId.
  },
});
```

## Browser SDK

Use the browser helper in your frontend:

```ts
import { createAnalytics } from "@Abdssamie/convex-analytics";

const analytics = createAnalytics({
  endpoint: "https://your-deployment.convex.site/analytics/ingest",
  writeKey: "write_...",
  autoPageviews: true,
  flushIntervalMs: 5000,
  maxBatchSize: 10,
});

analytics.track("signup_clicked", { plan: "pro" });
analytics.identify("user_123", { tier: "pro" });
await analytics.flush();
```

The SDK stores:

- `visitorId` in `localStorage`
- `sessionId` in `sessionStorage`
- queued events in memory only

It flushes on interval, batch size, and `pagehide`.

## Cost Controls

The default ingest path is built to avoid unnecessary Convex usage:

- Browser events are batched.
- Raw events are slim.
- Write keys are hashed before reaching component storage.
- Retry dedupe prevents duplicate event inserts.
- Ingest does not patch report counters inline.
- Reports use sharded hourly/daily rollups for common analytics queries.
- `aggregatePending` can repair missed pending events after deploys or failures.
- Event properties can be allowlisted or denied per site.
- Raw IP addresses are not persisted by this component.

## Development

```sh
npm install
npm run build:codegen
npm test
npm run typecheck
```

Run the example app:

```sh
npm run dev
npm run dev:frontend
```

The example frontend is a small product app that sends analytics events. It is
not a dashboard. Use the Convex dashboard to inspect component tables,
functions, and stored events.
