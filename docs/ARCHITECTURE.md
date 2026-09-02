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
│ features/            Screens: engagements, context, workspace,   │
│                      dashboard, export, library, settings        │
├──────────────────────────────────────────────────────────────────┤
│ ui/                  Design system: primitives, icons, toasts.   │
│                      Status vocabulary, accessible names and     │
│                      contrast live here — see DESIGN-SYSTEM.md   │
├──────────────────────────────────────────────────────────────────┤
│ hooks/               Live queries (Dexie → React)                │
├──────────────────────────────────────────────────────────────────┤
│ persistence/         db.ts (schema) · repository.ts (all writes) │
├──────────────────────────────────────────────────────────────────┤
│ domain/              types · context · applicability ·           │
│                      executionState · metrics      (pure, tested)│
├──────────────────────────────────────────────────────────────────┤
│ data/                Bundled knowledge base: 184 test defs,      │
│                      taxonomy, search index, reference resolver  │
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
   computeMetrics()     Workspace UI        Excel export
   highValueTests()     (filters/edit)      (deliverable)
   (dashboard)
```

Dashboard numbers, checklist filters and the exported workbook are all derived from the same
`ChecklistItem[]`. No screen counts anything on its own, so the spreadsheet can never disagree with
the dashboard.

## 4. Data flow for a single edit

```text
Tester presses "2" (or clicks Tested) in the workspace
   └─► updateTestState(engagementId, testId, { status: 'Tested' })      persistence/repository
         └─► applyTransition(current, change)                            domain/executionState
               • enforces: Tested ⇒ result required
               • enforces: not Tested ⇒ result cleared
               • stamps updatedAt / testedAt
         └─► db.testStates.put(next)  +  engagement.updatedAt            IndexedDB
               └─► dexie-react-hooks re-runs useLiveQuery
                     └─► list row, detail pane, header counters, dashboard
                         statistics, progress, findings, high-value queue and
                         the next export all refresh from that one write
```

There is exactly one write path. UI components never construct a `TestState` themselves.

## 5. Knowledge layer

```text
data/
  categories.ts    18 categories, each declaring its subcategories (100 total)
  tests/*.ts       184 definitions grouped by area
  library.ts       assembly, ordering, stats, FACT_IMPACT, validateLibrary()
  references.ts    standards code → canonical URL (references are derived)
  searchIndex.ts   lowercase haystack per test, built once at module load
```

The library is a product asset, so it is guarded like one. `validateLibrary()` rejects duplicate
IDs, duplicate names *or aliases*, subcategories not declared on the category, ID prefixes that do
not match the category code, thin descriptions and guidance, task-style titles and malformed
standards codes. It runs in the unit tests, so a bad entry fails the build rather than reaching a
tester. Conventions: [`TEST-LIBRARY.md`](TEST-LIBRARY.md).

## 6. Applicability engine

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

Rules are **per test, not per category**: `FILE-001` keys on file upload, `CLI-010` on WebSockets,
`AUTH-013` on OAuth appearing in the auth mechanisms. Evaluation returns each leaf condition with a
`met` / `unmet` / `unknown` outcome so the UI can show the reasoning rather than a verdict, and
`FACT_IMPACT` (derived from the same rules) tells the tester how many tests each context question
decides.

## 7. Persistence and integrity

- Database `vapt-checklist`, schema version 1, three tables (`engagements`, `testStates`,
  `appMeta`).
- One `TestState` row is materialised **per test per engagement at creation time**, so the checklist
  is a simple join with no lazy-creation edge cases.
- Composite primary key `${engagementId}::${testId}` gives idempotent upserts.
- Migrations: bump `DB_VERSION` and append a new `.version()` block; never edit an existing one.
- `libraryVersion` is stored on each engagement; **Data & Settings → Sync** adds states for tests
  introduced by a newer library without touching recorded work.
- JSON backup/restore exists because browser storage is deletable by the user or the browser.
  `inspectBackup()` validates an untrusted file completely — shape, enums, cross-references,
  duplicate ids and the state-machine invariants — before the import transaction opens, and the
  transaction only ever adds records.
- `assertPersistable()` guards every write path, so the counting identities
  (`applicable = notTested + tested + na`, `tested = vulnerable + notVulnerable`) hold for every row
  on disk. `repairIntegrity()` fixes rows left by earlier builds. See
  [ADR 0013](adr/0013-unrepresentable-inconsistent-states.md).

## 8. Export

`export/excel.ts` is **dynamically imported** the moment the user clicks Download Excel, so the XLSX
writer is not part of the initial download. `planWorkbook()` describes the sheets as data (name,
rows, column widths, tabular or not), which makes the whole structure unit-testable without a
browser; `exportEngagementToExcel()` renders that plan and triggers the download.

Sheets: **Engagement Summary** (identity, dates, statistics, application context), **Assessment**
(every applicable test), **Vulnerable Tests**, plus optional **Not Applicable** and **Coverage**.

`export/xlsxPostProcess.ts` adds what the writer cannot: it unzips the generated workbook with
`fflate`, splices `<autoFilter>` into the data worksheets and rezips. Best-effort — any failure
returns the untouched, still-valid workbook. See
[ADR 0014](adr/0014-workbook-structure-and-autofilter.md).

## 9. Routing and GitHub Pages

- `HashRouter`: `https://user.github.io/repo/#/e/abc/checklist` — refreshing a deep link never hits
  the Pages 404 handler.
- `base: './'`: the same `dist/` works at `/`, at `/<repo>/`, on any static host and from `file://`.
- `public/.nojekyll`: prevents Jekyll from ignoring hashed asset paths.

## 10. Testing strategy

Tests cover the parts where correctness actually matters:

| File | Covers |
| --- | --- |
| `data/library.test.ts` | Library integrity, naming rules, state machine, metrics |
| `data/knowledge.test.ts` | Taxonomy, aliases, search, references, applicability explanation, conservative filtering |
| `persistence/repository.test.ts` | Full write path against a fake IndexedDB |
| `persistence/persistence.test.ts` | Refresh survival, engagement isolation, counting identities, backup validation |
| `domain/workflow.test.ts` | Progress rule, high-value ranking, conditional context, status/result |
| `export/excel.test.ts` | Workbook composition and cell shape |
| `app/App.smoke.test.tsx` | The app mounts, routes resolve, live data renders, landmarks and accessible names exist, non-colour status indicators, roving tabindex, modal focus trap, narrow-viewport flow |
| `ui/designSystem.test.ts` | Design-language contract: type scale, semantic colour, radii, component reuse, vocabulary, accessible names |

Notable guarantees asserted: no Critical test is excluded on unknown facts alone; a described target
narrows the checklist but never loses a whole category; every context fact drives a rule (or is
explicitly metadata-only).

UI is intentionally thin: it renders domain output and calls repository functions.

## 11. Deliberate non-goals

Retest cycles, evidence upload, remediation workflow, multi-user collaboration, scanner
integrations, server-side reporting. Each would require state or infrastructure that the product
principle and the GitHub Pages constraint rule out.
