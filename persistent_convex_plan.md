# Persistent Convex Client: Implementation Plan

## 1. Executive Summary
The goal is to implement a persistence layer for Convex applications that provides reliable offline support with minimal friction. The architecture prioritizes **API Parity** with native Convex hooks to ensure that the implementation can be easily maintained or replaced as the platform evolves.

## 2. Strategic Roadmap

### Phase 1: Offline-First Queries (Foundation)
*   **Objective:** Immediate data availability from local cache upon application load.
*   **Scope:** Implement `usePersistentQuery` with the exact same signature as Convex's `useQuery`.
*   **Key Deliverables:**
    *   **Storage Layer:** Initialize Dexie.js with a schema for query caching.
    *   **Serialization Logic:** Implement robust serialization/deserialization using `convexToJson` and `jsonToConvex` to handle specialized types (BigInt, ArrayBuffer, etc.).
    *   **Hook Lifecycle:**
        1.  Synchronously check local cache for existing data on mount.
        2.  Initiate the standard Convex subscription.
        3.  Update the local cache asynchronously when new data is received from the server.

### Phase 2: Mutation Outbox & Provider
*   **Objective:** Reliable queuing and synchronization of mutations initiated while offline.
*   **Scope:** Implement `usePersistentMutation` and a synchronization provider.
*   **Key Deliverables:**
    *   **Outbox Implementation:** A persistent, ordered queue of pending mutations.
    *   **Sync Engine:** A background process within the `PersistentConvexProvider` that monitors connection state and drains the outbox in order upon reconnection.
    *   **Error Handling:** Implement a "Fail-Fast" policy where any synchronization error halts the outbox processing to prevent data corruption.

### Phase 3: Backend Integrity (Idempotency)
*   **Objective:** Ensure "Exactly-Once" execution of mutations.
*   **Scope:** Backend schema changes and mutation logic updates.
*   **Key Deliverables:**
    *   **Idempotency Table:** A dedicated table to track processed `clientMutationId`s.
    *   **Mutation Validation:** Update critical mutations to verify idempotency keys before committing changes.

## 3. Avoiding Technical Debt & Refactors

To ensure the project remains maintainable and avoids common pitfalls that lead to heavy refactors:

*   **API Signature Parity:** The persistent hooks must be interchangeable with native hooks. This ensures that the application logic remains decoupled from the persistence implementation.
*   **Strict Linear Execution:** By enforcing a strict FIFO (First-In-First-Out) order for the mutation outbox, we avoid the complexity of dependency graphs and state conflicts.
*   **Typed Serialization:** Levering Convex's internal JSON conversion utilities ensures that data integrity is maintained across the boundary between memory and IndexedDB.
*   **Decoupled Storage:** Abstract the database interactions so that the underlying storage engine (Dexie.js) can be swapped or updated without impacting the hook logic.
*   **Consistent Typing:** Maintain full TypeScript support throughout the wrapper layer. Use Convex's internal types (`FunctionReference`, `FunctionArgs`, etc.) to ensure that the wrapper is as type-safe as the native client.
