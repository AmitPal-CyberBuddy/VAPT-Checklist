# ADR 0002 — IndexedDB via Dexie for engagement data

**Status:** Accepted

## Context

An engagement seeds one state row per library test (184 today, growing). With several engagements
this is thousands of structured records that must be queried by engagement, filtered by status and
updated transactionally, while the UI stays reactive.

Options considered:

1. `localStorage` — synchronous, string-only, ~5 MB, no indexes.
2. Raw IndexedDB — capable but verbose, with awkward transaction and versioning ergonomics.
3. IndexedDB via **Dexie** — thin typed wrapper with indexes, transactions, migrations and React
   live queries.
4. SQLite via WebAssembly (`sql.js`, `wa-sqlite`) — powerful but adds a large WASM payload and OPFS
   complexity.

## Decision

Use **IndexedDB through Dexie 4**, with `dexie-react-hooks` (`useLiveQuery`) for reactive reads.
One composite-keyed table for test states (`${engagementId}::${testId}`), one for engagements, one
for metadata.

All writes go through `src/persistence/repository.ts`; no component touches Dexie directly.

## Consequences

- Structured queries and bulk transactions are straightforward; large quota removes size anxiety.
- `useLiveQuery` means every screen updates from a single write with no client state duplication.
- Dexie is ~25 kB gzipped — acceptable for what it removes.
- Migrations must be additive (`.version(n)` blocks appended, never edited).
- IndexedDB is unavailable in some private-browsing configurations; the shell detects this and warns
  that work will not persist.
