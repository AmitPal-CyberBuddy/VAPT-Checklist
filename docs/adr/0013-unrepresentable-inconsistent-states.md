# ADR 0013 — Inconsistent test states are unrepresentable

**Status:** Accepted

## Context

The product guarantees two counting identities:

```text
Total Applicable = Not Tested + Tested + N/A
Tested           = Vulnerable + Not Vulnerable
```

The first held by construction. The second did not: the state machine allowed `Tested` with no
result yet, tracked as `awaitingResult`. That was a deliberate "work in progress" affordance, but it
meant the identity was only *usually* true, every consumer needed a special case, and progress had
two defensible definitions.

There is also a second way an invalid row could appear: **backup import**. A JSON file picked off
disk is untrusted input; the original implementation checked one `format` string and wrote the rest
straight into IndexedDB. A hand-edited or truncated file could introduce `status: 'N/A'` with
`result: 'Vulnerable'` — a combination the UI cannot produce.

## Decision

**Make the invalid states unrepresentable at the persistence boundary.**

1. `assertPersistable()` runs inside `updateTestState`, `bulkUpdateTestStates` and `importBackup`.
   It throws `InvalidTestStateError` rather than writing. A bulk edit validates the whole batch
   before touching the table, so it is all-or-nothing.
2. **Status and result are recorded together.** Choosing *Tested* in the workspace parks the intent
   in local component state and highlights the result control; only when the tester picks Vulnerable
   or Not Vulnerable is one atomic transition written. Keyboard `v` / `b` do the same in a single
   step. `Tested` therefore never exists on disk without a result.
3. **Imports are validated in full before anything is written** — shape, enums, timestamps,
   cross-references, duplicate ids and the state-machine invariants — by `inspectBackup()`, which
   returns fatal issues and non-fatal warnings. The Settings screen shows that report and requires
   confirmation. Colliding engagement ids are re-keyed, never overwritten.
4. **Metrics are defensive anyway.** `accumulate()` counts a resultless `Tested` row as Not Tested,
   so both identities hold for any data on disk, including rows written by an older build.
   `countsAreConsistent()` states the identities and is asserted in tests.
5. **Legacy rows are repaired.** `repairIntegrity()` runs once when an engagement is opened and
   resets any `Tested`-without-result row to `Not Tested`, telling the tester what happened.

`awaitingResult` and `incompleteItems()` are removed; there is nothing left for them to describe.

## Consequences

- Both identities are true of every row in IndexedDB and of every number on screen or in the export.
- One progress definition survives (ADR 0012), with no special case.
- A malformed or malicious backup cannot corrupt existing engagements: validation happens before the
  transaction, and the transaction only ever adds.
- The tester loses the ability to "park" a test as Tested pending a verdict. In practice that state
  was indistinguishable from Not Tested plus a note, and the note field is right there.
- Cost: the UI must hold a small amount of transient state (the pending *Tested* choice). That is
  local to the detail panel and never persisted, so it cannot desynchronise anything.
