# ADR 0012 — One progress formula, and a two-pane testing workspace

**Status:** Accepted (supersedes the completion rule in ADR 0008)

## Context

Two workflow questions had to be settled.

**1. What counts as done?** The first implementation defined progress as
`(Tested-with-a-result + N/A) / applicable`, deliberately excluding a row marked `Tested` whose
result had not been recorded. That is defensible in isolation, but it means the dashboard can read
"12 of 40" while the list shows 13 rows marked Tested — two plausible numbers for the same thing.

**2. How does a tester actually move through 100+ tests?** The original checklist was an accordion:
expand a row, read guidance, set status, collapse, scroll, expand the next. That is fine for
reviewing and miserable for eight hours of testing.

## Decision

**One progress formula, stated in the product:**

```text
Completed = Tested + N/A
Progress  = Completed / Total Applicable Tests
```

Defined once as `completedOf()` / `completionOf()` in `src/domain/metrics.ts` and used by the
engagement card, the engagement header, the dashboard, every category and priority bar, and the
Excel Summary and Coverage sheets. `awaitingResult` remains as a **data-quality signal** — the
workspace rings the result control, the dashboard banners it, the export reports it — but it never
produces a second progress number.

**A two-pane workspace.** Filtered list on the left, the whole test on the right: description,
testing guidance, applicability, references, status, result, notes. Status and result sit in a
sticky header so they are reachable without scrolling past the guidance. Keyboard shortcuts
(`j`/`k`, `1`/`2`/`3`, `v`/`b`, `e`, `⏎`, `/`) cover the entire loop, and **Next untested** jumps to
the next `Not Tested` row in the current filter.

## Consequences

- Every surface agrees, by construction. Changing the rule means changing one function.
- Because the UI demands a result the moment `Tested` is selected, `Tested` without a result is a
  transient state rather than a category of work — so the simpler formula loses nothing.
- The tester stays on one screen for the whole loop; no navigation between test and list.
- Deep links (`?test=AUTHZ-002`) select a test in the pane, so the dashboard's high-value and
  findings lists open straight into the working view.
- The route moved from `/checklist` to `/workspace`; the old path redirects with its query string
  intact.
- Trade-off: the two-pane layout needs width. Below `lg` the panes stack, which is acceptable for a
  tool used on a laptop or larger.
