# ADR 0005 — Declarative tri-state applicability rules

**Status:** Accepted

## Context

The product's core value is answering *"given this application, what should I test?"*. That requires
mapping application facts to relevant vulnerabilities. Two risks:

1. Encoding rules as arbitrary predicate functions makes them opaque — impossible to explain to the
   tester, serialise, or unit test in isolation.
2. Treating a fact the tester has not answered as `false` would silently drop tests, which is the
   worst possible failure mode for a security checklist.

## Decision

Applicability is a **declarative rule tree** (`always` / `fact` / `includes` / `all` / `any` / `not`)
stored as plain data on each definition, evaluated by a pure function.

Evaluation is **tri-state**: `true`, `false`, `unknown`. An unrecorded fact yields `unknown`, and
`unknown` resolves to **applicable = true with `uncertain = true`**.

The engine returns a *suggestion* with human-readable reasons. `TestState.applicabilitySource`
records whether the current value is `auto` or `manual`, and recomputation never overwrites a manual
override or a test that already carries recorded work.

## Consequences

- Rules are explainable in the UI ("Included because: File upload = Yes") and in the export's
  *Not Applicable* sheet.
- Rules are unit-testable without a browser and could later be serialised or authored externally.
- Incomplete context produces an over-inclusive checklist rather than a dangerously short one; those
  rows are badged *Unconfirmed* so the tester can prune them deliberately.
- The tester always remains the final authority, which is the stated product principle.
