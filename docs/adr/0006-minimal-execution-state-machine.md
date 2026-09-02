# ADR 0006 — Minimal execution state machine

**Status:** Accepted

## Context

Vulnerability management tools accumulate lifecycle states — Retest, Evidence Pending, Finding
Created, Remediation Pending, Closed. Each new state multiplies UI, filtering and reporting
complexity, and pulls the product toward being a management platform rather than a testing
checklist.

## Decision

Exactly three statuses and two results:

```text
Not Tested
   ├──→ Tested ──→ Vulnerable | Not Vulnerable
   └──→ N/A
```

Enforced invariants (all in `applyTransition` / `validateState`):

- `Tested` requires a result to count as resolved (`awaitingResult` tracks the gap).
- Any status other than `Tested` clears the result.
- Marking a test not applicable resets its execution state.
- No state is terminal — every decision can be revised.

Applicability, status and result stay three independent axes: *should I test this*, *did I test it*,
*what did I find*.

## Consequences

- The dashboard, filters and export stay simple and unambiguous.
- Anything a lifecycle state would express (e.g. "needs retest") goes in Notes, which is sufficient
  for a checklist and keeps the data model honest.
- Retesting is modelled by duplicating the engagement — context is copied, results reset — rather
  than by adding states.
