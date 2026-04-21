# Convex Analytics Component - Engineering Improvement Plan

This document serves as the master roadmap for refining the Convex Analytics component into a production-ready, high-performance system, strictly adhering to [Convex Best Practices](https://docs.convex.dev/understanding/best-practices/).

## 1. Write Efficiency: In-Batch Aggregation
**Problem**: Current ingestion executes a Query+Patch for every dimension of every event in a batch, leading to $O(N \times M)$ database operations and high contention.
**Action**:
- Refactor `aggregateEventsByIds` to consolidate data in-memory *before* database calls.
- Use a `Map<string, RollupData>` where the key is a hash of `(bucket, dimension, key, shard)`.
- Perform a single `ctx.db.get()` and `ctx.db.patch()` (or `insert`) per unique key in the map.
- **Best Practice Check**: Ensure all `ctx.db.patch` / `ctx.db.insert` calls explicitly include the table name as the first argument and are strictly `await`ed to prevent floating promises.

## 2. Product Safety: No Custom Property Rollups
**Decision**: Do not implement custom property rollups in this component for now.
**Reason**:
- The current component already stores raw event properties when allowed by ingestion settings.
- Rollup-backed analytics are currently limited to fixed dimensions (`overview`, `event`, `page`, `referrer`, `utmSource`, `utmMedium`, `utmCampaign`).
- Adding arbitrary property rollups would introduce new product complexity, unclear user expectations, and unbounded storage/query risk.
**Action**:
- Keep `allowedPropertyKeys` / `deniedPropertyKeys` scoped to raw-event property ingestion and sanitization only.
- Do not add `allowedPropertyRollups`, value caps, per-dimension key counters, or auto-disable logic.
- Revisit custom property rollups only after real user demand appears and concrete use cases justify the added complexity.

## 3. Data Integrity & Query Caching
**Problem**: Using `.take()` limits tied to the *current* shard count causes silent data loss. Conversely, removing limits entirely could return >10,000 documents to the client, crashing the browser and violating bandwidth limits.
**Action**:
- Remove artificial `.take()` limits from queries, but **do not return raw shards to the client**.
- The query must reduce/sum the shards in memory and return only the final chart data points (e.g., 24 data points for a daily chart).
- **Best Practice Check**: Never use `Date.now()` inside the query. The client must pass `args.to` as an explicit, rounded timestamp (e.g., rounded to the nearest minute) to ensure high Convex query cache hit rates.

## 4. Atomic Compaction: Granular Processing
**Problem**: Compacting an entire hour across all dimensions in one transaction is slow and prone to timeouts.
**Action**:
- Refactor `compactShards` to process a single `(bucketStart, dimension)` pair per transaction using a cursor/limit pattern.
- **Best Practice Check**: This requires an `action` looping sequential `ctx.runMutation` calls. While normally an anti-pattern, the docs state an exception: "If you're intentionally trying to process more data than fits in a single transaction, like aggregating data, then it makes sense to have multiple sequential ctx.runMutation calls."
- Ensure all mutations called by the background action are strictly defined as `internalMutation` to enforce access control.

## 5. Maintenance: Retention & Cleanup
**Problem**: Storing raw events forever is prohibitively expensive.
**Action**:
- Implement a scheduled cron job (action) that prunes raw `events` documents based on `site.settings.retentionDays`.
- Use a batch-deletion pattern (100 rows per mutation) with a cursor to avoid blocking the database.
- **Best Practice Check**: Ensure the deletion mutation is an `internalMutation` and properly validates arguments using `v.id()` or cursors.

## 6. Dynamic Scaling: Shard Configuration
**Action**:
- Move `rollupShardCount` from a constant into `site.settings`.
- **Default**: `1` (Simple mode, zero overhead).
- **Pro**: Users can scale to `8` or `16` shards without migrations, as the aggregation logic is already shard-agnostic.
