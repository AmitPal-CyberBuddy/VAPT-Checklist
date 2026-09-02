# ADR 0004 — Separate test definitions from engagement state

**Status:** Accepted

## Context

A tester needs a permanent VAPT knowledge base (what SQL Injection is, how to test it) and a record
of what happened to each test on a specific job. A naive design stores one object per engagement
containing both, duplicating the entire knowledge base per engagement.

## Decision

Two strictly separated concepts:

- **`TestDefinition`** — bundled with the application, immutable at runtime, addressed by a stable
  ID (`AUTH-001`).
- **`TestState`** — per engagement per test: `applicable`, `status`, `result`, `notes`, timestamps.
  It stores **only** `testId` as the link; it never copies name, category, priority or guidance.

The checklist row model (`ChecklistItem`) is the join of the two, produced on read.

## Consequences

- Improving a description or adding guidance updates every past engagement immediately, with no
  migration.
- Storage per engagement is small and uniform.
- Definitions cannot be edited in-app. Adding organisation-specific tests means editing
  `src/data/tests/*` and rebuilding — an accepted trade-off that keeps the knowledge base
  version-controlled and reviewable.
- Engagements record `libraryVersion`; a sync action adds states for tests introduced later without
  disturbing recorded work.
