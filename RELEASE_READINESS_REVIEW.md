# Release Readiness Review

Date: 2026-04-23

Scope:
- package readiness for external users
- component correctness and cost posture
- missing workflow for product analytics usage

## Verdict

Not ready to publish for general external use yet.

Core direction is good:
- rollup-backed reads for common dashboard paths
- append-only raw events
- bounded cleanup primitives
- usable browser tracker
- good breadth of tests

But there are still correctness, reliability, and operational blockers.

## Findings

### 1. Release blocker: test suite is not green

`npm test` currently fails.

Observed failures:
- `scheduled worker materializes visitors, sessions, and rollups after append-only ingest`
- `reused sessionId after timeout creates new session row instead of colliding`
- `failed aggregations mark event failed once without auto requeue`

Relevant files:
- `src/component/helpers.ts`
- `src/component/ingest.ts`
- `src/component/lib.test.ts`
- `package.json`

Notes:
- `preversion` depends on tests passing, so release automation is blocked.
- Even if one failure is partly test-harness-specific, package is not release-ready while suite is red.

### 2. Real correctness bug: session windows can merge incorrectly

Current aggregation groups session updates by:

- `siteId|sessionId`

That is too coarse inside a single aggregation batch.

If same `sessionId` is reused after timeout, separate sessions can collapse into one session row before upsert logic gets a chance to split them.

Impact:
- wrong session counts
- wrong duration
- wrong entry/exit path
- wrong bounce/session metrics

Relevant file:
- `src/component/ingest.ts`

Recommendation:
- fix batching logic to respect timeout boundaries before combining events into one session update
- do not add a new expensive query path for this; keep it in existing aggregation flow

### 3. Real correctness bug: orphaned events can be marked aggregated

In the worker, an event can enter the valid-events flow before site existence is fully confirmed.

If the site record is gone, behavior should fail or skip cleanly. Current flow appears capable of later stamping `aggregatedAt` anyway.

Impact:
- hides broken data state
- makes repair harder
- test coverage already flags this

Relevant file:
- `src/component/ingest.ts`

Recommendation:
- reject or skip events whose site record is missing before they enter rollup/session/visitor processing

### 4. Cost/privacy concern: country detection does external fetch by default

HTTP ingest falls back to `api.country.is` when upstream country headers are unavailable.

Impact:
- extra latency on ingest
- extra external dependency
- extra egress/network risk
- IP disclosure to third party
- weakens cost-conscious story

Relevant file:
- `src/client/http.ts`

Recommendation:
- do not make third-party geo lookup default behavior
- prefer provider headers only
- if fallback is kept, make it explicit opt-in

### 5. Reliability bug: browser tracker drops events on non-OK responses

Tracker requeues only on thrown network errors.

If server returns `400`, `401`, `429`, or `500`, current queue handling can still drop events permanently.

Impact:
- silent analytics loss
- hard-to-debug field failures in real installs

Relevant file:
- `src/client/tracker.ts`

Recommendation:
- treat non-2xx responses as failed delivery
- requeue bounded batch instead of dropping it
- keep retry logic simple and bounded; avoid heavy client complexity

### 6. Product analytics workflow is not fully shipped

This is the main product gap called out in review.

Current state:
- tracking custom product events exists
- property breakdown query exists internally
- public/read API does not expose enough of that workflow for adopters
- docs do not clearly define naming conventions and analysis patterns

Relevant files:
- `README.md`
- `src/component/analytics.ts`
- `src/client/api.ts`

Recommendation:
- expose only the minimal useful product-analytics query surface
- likely start with event-property breakdown, not a broad new reporting API
- document event naming/property guidance clearly
- avoid adding broad or scan-heavy new queries

## Important Constraint For Next Iteration

Do not add heavy API churn.

Do not add expensive fallback queries that increase normal read costs for users.

Do not add generic AI-style “analytics platform” surface area.

Prefer:
- fixing existing correctness bugs
- keeping rollups as primary serving layer
- exposing one or two targeted low-cost product analytics queries
- documenting a lean usage workflow

## Recommended Next Steps

### Must fix before publish

1. Make test suite green.
2. Fix session reuse / timeout merge bug.
3. Fix orphan-event aggregation behavior.
4. Make country lookup header-only by default, or opt-in.
5. Fix tracker so non-OK HTTP responses do not silently drop events.

### Should fix before publish

1. Align cleanup helper behavior with README cost guidance.
2. Update publishing docs to match actual scripts.
3. Document SPA pageview tracking expectations.

### Small, worthwhile product analytics addition

Minimal next addition:
- expose event property breakdown through public analytics API
- document how users should instrument:
  - `track("plan_selected", { plan: "pro" })`
  - `track("checkout_started", { step: "shipping" })`
  - `identify(userId, { plan: "pro" })`

This gives users actual custom product analytics without introducing broad, expensive query surface.

## Suggested Positioning

The package is close, but should be presented as:

- lean first-party analytics component
- optimized for common dashboard queries
- extensible for product analytics

Not yet:
- fully polished drop-in analytics platform for arbitrary downstream use

## Summary

Best path forward is disciplined, not bigger:
- fix correctness
- keep cost posture strong
- expose one minimal custom-event analysis path
- improve docs around usage workflow

That keeps component general without turning it into expensive or sloppy surface area.
