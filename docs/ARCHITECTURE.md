# Architecture

## 1. Constraints that shape everything

| Constraint | Consequence |
| --- | --- |
| Must run on GitHub Pages | Static bundle only; no server-side runtime, no rewrite rules |
| No backend / database server / cloud API | All state is client-side; IndexedDB is the storage tier |
| No runtime CDN dependencies | Every dependency is bundled at build time |
| Must work under `/<repo>/` | Relative asset base + hash routing |
| Vulnerability-centric product | The data model is organised around *tests and their outcomes*, not tasks |

## 2. Layered design

```text
┌──────────────────────────────────────────────────────────────────┐
│ features/            Screens: engagements, context, checklist,   │
│                      dashboard, export, library, settings        │
├──────────────────────────────────────────────────────────────────┤
│ ui/                  Design system: primitives, icons, toasts    │
├──────────────────────────────────────────────────────────────────┤
│ hooks/               Live queries (Dexie → React)                │
├──────────────────────────────────────────────────────────────────┤
│ persistence/         db.ts (schema) · repository.ts (all writes) │
├──────────────────────────────────────────────────────────────────┤
│ domain/              types · context · applicability ·           │
│                      executionState · metrics      (pure, tested)│
├──────────────────────────────────────────────────────────────────┤
│ data/                Bundled test library (immutable knowledge)  │
├──────────────────────────────────────────────────────────────────┤
│ export/              Excel workbook builder (lazy-loaded)        │
└──────────────────────────────────────────────────────────────────┘
```

**Dependency rule:** dependencies point downward only. `domain/` imports nothing from
`persistence/`, `features/` or `ui/`, which is what makes it unit-testable without a browser.

## 3. Single source of truth

```text
      TEST_LIBRARY (static)          TestState rows (IndexedDB)
                 \                        /
                  \                      /
                   ▼                    ▼
                    joinItems() → ChecklistItem[]
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   computeMetrics()     Checklist UI        Excel export
   (dashboard)          (filters/edit)      (deliverable)
```

Dashboard numbers, checklist filters and the exported workbook are all derived from the same
`ChecklistItem[]`. No screen counts anything on its own, so the spreadsheet can never disagree with
the dashboard.

## 4. Data flow for a single edit

```text
User clicks "Tested"
   └─► updateTestState(engagementId, testId, { status: 'Tested' })      persistence/repository
         └─► applyTransition(current, change)                            domain/executionState
               • enforces: Tested ⇒ result required
               • enforces: not Tested ⇒ result cleared
               • stamps updatedAt / testedAt
         └─► db.testStates.put(next)  +  engagement.updatedAt            IndexedDB
               └─► dexie-react-hooks re-runs useLiveQuery
                     └─► checklist row, header counters, dashboard, export all refresh
```

There is exactly one write path. UI components never construct a `TestState` themselves.

## 5. Applicability engine

`domain/applicability.ts` evaluates a declarative rule tree against the engagement's
`ApplicationContext`:

```ts
rule.all(
  rule.is('hasAuthentication', true),
  rule.is('hasMfa', true),
)                                        // → AUTH-007 MFA Bypass
```

Evaluation is **tri-state** (`true` / `false` / `unknown`):

- A fact the tester has not recorded evaluates to `unknown`.
- `unknown` resolves to **applicable = true, uncertain = true** — a missed test is worse than an
  extra one, and the row is badged *Unconfirmed* in the UI.
- Every suggestion carries human-readable reasons, surfaced in the checklist drawer and in the
  *Not Applicable* export sheet.

The engine only ever **suggests**. `TestState.applicabilitySource` records whether the current value
came from the engine (`auto`) or the tester (`manual`), and re-evaluation never silently overwrites
a manual override or a test that already has recorded work.

## 6. Persistence

- Database `vapt-checklist`, schema version 1, three tables (`engagements`, `testStates`,
  `appMeta`).
- One `TestState` row is materialised **per test per engagement at creation time**, so the checklist
  is a simple join with no lazy-creation edge cases.
- Composite primary key `${engagementId}::${testId}` gives idempotent upserts.
- Migrations: bump `DB_VERSION` and append a new `.version()` block; never edit an existing one.
- `libraryVersion` is stored on each engagement; **Data & Settings → Sync** adds states for tests
  introduced by a newer library without touching recorded work.
- JSON backup/restore exists because browser storage is deletable by the user or the browser.

## 7. Export

`export/excel.ts` is **dynamically imported** the moment the user clicks Export, so the XLSX writer
(~78 kB) is not part of the initial download. It produces a six-sheet workbook — Summary, Checklist,
Findings, Not Applicable, Application Context, Coverage — styled for direct client delivery.

## 8. Routing and GitHub Pages

- `HashRouter`: `https://user.github.io/repo/#/e/abc/checklist` — refreshing a deep link never hits
  the Pages 404 handler.
- `base: './'`: the same `dist/` works at `/`, at `/<repo>/`, on any static host and from `file://`.
- `public/.nojekyll`: prevents Jekyll from ignoring hashed asset paths.

## 9. Testing strategy

`src/data/library.test.ts` covers the parts where correctness actually matters:

- library integrity (unique IDs, unique vulnerability names, non-generic naming, content present),
- applicability semantics including the unknown-fact rule,
- the execution state machine and its invariants,
- metric derivation (completion, awaiting-result handling).

UI is intentionally thin: it renders domain output and calls repository functions.

## 10. Deliberate non-goals

Retest cycles, evidence upload, remediation workflow, multi-user collaboration, scanner
integrations, server-side reporting. Each would require state or infrastructure that the product
principle and the GitHub Pages constraint rule out.
