# Data Model

Source of truth: `src/domain/types.ts`, `src/domain/context.ts`.

## 1. Separation of concerns

```text
╔═════════════════════════╗            ╔══════════════════════════════╗
║  TEST DEFINITION        ║            ║  ENGAGEMENT STATE            ║
║  (bundled, immutable)   ║            ║  (per engagement, mutable)   ║
╟─────────────────────────╢            ╟──────────────────────────────╢
║ id: AUTH-001            ║◄──testId───║ engagementId: eng_9fK…       ║
║ vulnerabilityName:      ║            ║ testId: AUTH-001             ║
║   Authentication Bypass ║            ║ applicable: true             ║
║ category: authentication║            ║ suggestedApplicable: true    ║
║ subcategory:            ║            ║ applicabilitySource: auto    ║
║   Authentication Logic  ║            ║ status: Tested               ║
║ priority: Critical      ║            ║ result: Not Vulnerable       ║
║ description: …          ║            ║ notes: "…"                   ║
║ testingGuidance: […]    ║            ║ createdAt/updatedAt/testedAt ║
║ applicability: rule     ║            ╚══════════════════════════════╝
║ aliases: […]            ║
║ owasp / cwe / tags      ║
╚═════════════════════════╝
```

A `TestState` never copies the name, category or priority. Update the library and every engagement
immediately reflects the new wording without data migration.

## 2. Entities

### `TestDefinition` — knowledge base

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | `CODE-NNN`, stable, never reused (`AUTH-001`); prefix must match the category code |
| `vulnerabilityName` | `string` | **WHAT** is being assessed — the canonical, tester-facing identity |
| `category` | `CategoryId` | One of 18 categories |
| `subcategory` | `string` | Must be one of the category's declared subcategories (100 in total) |
| `priority` | `Critical \| High \| Medium \| Low` | Inherent risk of the vulnerability class |
| `description` | `string` | What the weakness is and why it matters |
| `testingGuidance` | `string[]` | **HOW** to test — ordered steps (≥2, each ≥25 chars) |
| `applicability` | `ApplicabilityRule` | Declarative rule tree |
| `aliases` | `string[]` | Other industry terms for the same issue; searchable |
| `owasp`, `cwe` | `string[]` | Standards mapping — also the source of reference links |
| `tags` | `string[]` | Cross-cutting labels |

Two naming rules are enforced by unit tests:

1. Names describe a vulnerability (`Username Enumeration`), never a task (`Test Authentication`).
2. Names and aliases share one namespace — no two tests may claim the same term.

**References are derived, not stored.** `resolveReferences(definition)` maps each OWASP/CWE code to
its canonical URL (see [ADR 0010](adr/0010-derived-references.md)); `validateLibrary()` rejects any
code that is not well formed, which is how placeholders like `WSTG-ATHN-*` were eliminated.

Full conventions: [`TEST-LIBRARY.md`](TEST-LIBRARY.md).

### `Engagement`

| Field | Notes |
| --- | --- |
| `id`, `name`, `clientName`, `testerName` | Identity |
| `applicationUrl` | Primary target, shown on the dashboard and in the report |
| `scope: string[]` | Additional hosts, URLs, package names |
| `startDate`, `endDate`, `description` | Engagement admin |
| `status` | `Active \| Completed \| Archived` |
| `context: ApplicationContext` | The recorded facts |
| `libraryVersion` | Library revision the engagement was seeded from |
| `createdAt`, `updatedAt` | ISO timestamps |

### `TestState` — one row per test per engagement

Primary key `${engagementId}::${testId}`.

| Field | Notes |
| --- | --- |
| `applicable` | Is this test part of this engagement? |
| `suggestedApplicable` | What the engine proposed (kept for "differs from suggestion") |
| `applicabilitySource` | `auto` or `manual` |
| `status` | `Not Tested \| Tested \| N/A` |
| `result` | `Vulnerable \| Not Vulnerable \| null` |
| `notes` | Free text |
| `createdAt`, `updatedAt`, `testedAt?` | Audit timestamps |

### `ApplicationContext`

`Partial<Record<ContextFactKey, boolean | string | string[]>>` — 40 facts across 7 sections
(Target & Surface, Authentication & Identity, Data & Storage, Application Features,
Integrations & Protocols, Infrastructure & Deployment, Engagement Parameters).

Every fact is tri-state: `true`, `false`, or **absent = Unknown**. The schema in
`src/domain/context.ts` is data, so the context form, the export sheet and the rule descriptions all
render from one definition.

Facts marked `metadataOnly` (environment under test, credentials provided) are recorded for the
report but never referenced by a rule. Unit tests enforce this in both directions:

- every non-metadata fact must drive at least one test — the form cannot accumulate dead questions;
- no rule may depend on a metadata fact.

`FACT_IMPACT` counts how many tests each fact decides; the context form shows it as a badge
("12 tests") so the tester can see which answers move the checklist.

## 3. Invariants

Enforced centrally in `src/domain/executionState.ts` (`applyTransition`, `validateState`):

| # | Invariant |
| --- | --- |
| I1 | `status === 'Tested'` ⇒ `result !== null` |
| I2 | `status !== 'Tested'` ⇒ `result === null` |
| I3 | `applicable === false` ⇒ status resets to `Not Tested`, `result = null` |
| I4 | No terminal states — any decision can be revised |
| I5 | Applicability, status and result are three independent axes |

These give the two identities the product guarantees:

```text
Total Applicable = Not Tested + Tested + N/A
Tested           = Vulnerable + Not Vulnerable
```

They are enforced by `assertPersistable()` on **every** write path — single edit, bulk edit and
backup import — so an inconsistent row cannot reach IndexedDB. `Status = N/A` with
`Result = Vulnerable` is unrepresentable. The workspace records status and result in one atomic
transition, so `Tested` never exists without a result. See
[ADR 0013](adr/0013-unrepresentable-inconsistent-states.md).

## 4. Applicability rules

```ts
type ApplicabilityRule =
  | { kind: 'always' }
  | { kind: 'fact';     fact: ContextFactKey; equals: boolean | string }
  | { kind: 'includes'; fact: ContextFactKey; anyOf: string[] }
  | { kind: 'all';  rules: ApplicabilityRule[] }
  | { kind: 'any';  rules: ApplicabilityRule[] }
  | { kind: 'not';  rule: ApplicabilityRule };
```

Tri-state truth tables:

| `all` | any `false` → `false`; else any `unknown` → `unknown`; else `true` |
| --- | --- |
| `any` | any `true` → `true`; else any `unknown` → `unknown`; else `false` |
| `not` | `unknown` → `unknown`; otherwise negate |

Result mapping: `unknown` → **applicable, uncertain**. The tester is the final authority.

Evaluation also returns the **individual leaf conditions** so the decision can be explained:

```ts
interface ApplicabilityCondition {
  outcome: 'met' | 'unmet' | 'unknown';
  label: string;   // "Users own individual records or objects"
  detail: string;  // "Yes" | "No" | "Not recorded"
  fact: ContextFactKey;
}
```

which the UI renders as:

```text
Applicable because:
  ✓ Application has authentication          — Yes
  ✓ Users own individual records or objects — Yes
  ? Multi-tenant                            — Not recorded
```

163 of the 184 tests are context-driven; 21 are baseline (`{ kind: 'always' }`).

## 5. Derived metrics

`src/domain/metrics.ts` — the only place numbers are produced.

The application **type** is deliberately *not* an engagement field: it lives once in
`context.assetTypes`, where the applicability engine reads it, and the dashboard renders it from
there. Duplicating it would create two copies that can disagree.

```text
counts.total        = every library test seeded for the engagement
counts.applicable   = applicable === true
counts.excluded     = applicable === false
counts.notTested    = applicable && status = Not Tested
counts.tested       = applicable && status = Tested
counts.na           = applicable && status = N/A
counts.vulnerable   = applicable && Tested && Vulnerable
counts.notVulnerable= applicable && Tested && Not Vulnerable
counts.awaitingResult = applicable && Tested && result === null

completed       = tested + na                  ← the product's progress rule
completion      = completed / applicable
vulnerableRate  = vulnerable / (vulnerable + notVulnerable)
```

`countsAreConsistent(counts)` states the identities and is asserted in the tests. `accumulate()` is
additionally defensive: a `Tested` row with no result (only possible in a database written by an
older build) is counted as Not Tested, so the identities hold whatever is on disk.

Also derived: per-category and per-priority groups, findings by priority, outstanding by priority,
manual-override count, last activity timestamp, the findings list and the **high-value queue**.

### High-value ranking

`highValueTests(items, context, limit)` answers "what should I test next on *this* application?".
Candidates are applicable tests still `Not Tested`; severity is only the starting point:

| Signal | Effect |
| --- | --- |
| Priority | Critical 100 · High 70 · Medium 40 · Low 15 |
| Confirmed context conditions | +10 each, capped at +30 |
| In scope only because facts are unknown | −30 |
| Category exploitability | +0…+20 (authz/injection high, recon/privacy low) |
| Category already has a finding | +15 |
| Tester manually pulled it into scope | +12 |
| Baseline test (applies to everything) | −8 |

Each result carries a `rationale` string built from the conditions that matched, so the dashboard
can say *why* a test is near the top.

## 6. Persistence schema (IndexedDB v1)

```text
engagements : id (pk), name, status, updatedAt, createdAt
testStates  : id (pk), engagementId, testId, [engagementId+testId], status, applicable
appMeta     : key (pk)
```

Backup format:

```jsonc
{
  "format": "vapt-checklist-backup",
  "version": 1,
  "exportedAt": "2026-09-02T10:00:00.000Z",
  "libraryVersion": "1.0.0",
  "engagements": [ … ],
  "testStates":  [ … ]
}
```

`inspectBackup(data)` validates an untrusted file before anything is written and returns:

| Field | Meaning |
| --- | --- |
| `ok` / `issues` | Fatal problems — the file is rejected and nothing is written |
| `warnings` | Non-fatal notes (e.g. states for tests missing from this library, which are skipped) |
| `engagements` / `testStates` / `names` | What would be imported, shown for confirmation |

Checks cover the format marker and version, object shapes, enum values (`status`, `result`),
timestamps, scope arrays, duplicate ids, states pointing at engagements not in the file, and the
state-machine invariants. Import then runs in a single transaction and re-keys colliding engagement
IDs instead of overwriting, so it can only ever add.

## 7. Excel export model

| Sheet | Contents |
| --- | --- |
| **Summary** | Engagement identity, coverage counters, completion %, findings by priority, findings overview |
| **Checklist** | Every applicable test: ID, vulnerability, category, subcategory, priority, status, result, notes, description, guidance, aliases, applicability reason, OWASP, CWE, last updated |
| **Findings** | Vulnerable tests only, Critical → Low |
| **Not Applicable** | Excluded tests with rule, reason and whether it was auto or manual — the audit trail for scope decisions |
| **Application Context** | Every fact, grouped by section, with Unknown highlighted |
| **Coverage** | Per-category counts and completion, plus a total row |

Priority and result cells are colour coded; the header row is frozen on data sheets.
