# ADR 0008 — All metrics derived in one module

**Status:** Accepted — the completion formula was later revised by [ADR 0012](0012-progress-rule-and-workspace.md)

## Context

Progress appears in at least five places: the engagement card, the engagement header, the dashboard
tiles, per-category and per-priority bars, and the exported Summary and Coverage sheets. If each
computes its own counts, they drift — and a delivered spreadsheet that contradicts the screen is a
credibility problem.

Subtle rules make drift likely: is a test marked `N/A` complete? (yes) Does `Tested` with no result
count as complete? (no) Do excluded tests count toward the denominator? (no)

## Decision

`src/domain/metrics.ts` is the **only** place counts and percentages are produced. It takes
`ChecklistItem[]` and returns an `EngagementMetrics` object containing totals, per-category and
per-priority groups, findings by priority, outstanding by priority, override count and the derived
queues. Components and the export render those values; they never count.

```text
completion = (tested + na) / applicable      // see ADR 0012
```

## Consequences

- One place to change a counting rule, one place to test it.
- Metric semantics are documented in code and covered by unit tests (including the
  `Tested`-without-result case).
- Slight cost: metrics recompute over the full list on each change. At ~200 items this is
  microseconds and is memoised per render.
