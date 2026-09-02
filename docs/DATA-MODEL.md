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
║ priority: Critical      ║            ║ applicabilitySource: auto    ║
║ description: …          ║            ║ status: Tested               ║
║ testingGuidance: […]    ║            ║ result: Not Vulnerable       ║
║ owasp / cwe             ║            ║ notes: "…"                   ║
║ applicability: rule     ║            ║ createdAt/updatedAt/testedAt ║
╚═════════════════════════╝            ╚══════════════════════════════╝
```

A `TestState` never copies the name, category or priority. Update the library and every engagement
immediately reflects the new wording without data migration.

## 2. Entities

### `TestDefinition` — knowledge base

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | `CODE-NNN`, stable, never reused (`AUTH-001`) |
| `vulnerabilityName` | `string` | **WHAT** is being assessed — the tester-facing identity |
| `category` | `CategoryId` | One of 18 categories |
| `priority` | `Critical \| High \| Medium \| Low` | Inherent risk of the vulnerability class |
| `description` | `string` | What the weakness is and why it matters |
| `testingGuidance` | `string[]` | **HOW** to test — ordered steps |
| `owasp`, `cwe`, `references` | `string[]` | Standards mapping |
| `applicability` | `ApplicabilityRule` | Declarative rule tree |
| `tags` | `string[]` | Search aid |

Naming rule enforced by test: names describe a vulnerability
(`Username Enumeration`), never a task (`Test Authentication`).

### `Engagement`

| Field | Notes |
| --- | --- |
| `id`, `name`, `clientName`, `testerName` | Identity |
| `scope: string[]` | Hosts, URLs, package names |
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

`Partial<Record<ContextFactKey, boolean | string | string[]>>` — 38 facts across 7 sections
(Target & Surface, Authentication & Identity, Data & Storage, Application Features,
Integrations & Protocols, Infrastructure & Deployment, Engagement Parameters).

Every fact is tri-state: `true`, `false`, or **absent = Unknown**. The schema in
`src/domain/context.ts` is data, so the context form, the export sheet and the rule descriptions all
render from one definition.

## 3. Invariants

Enforced centrally in `src/domain/executionState.ts` (`applyTransition`, `validateState`):

| # | Invariant |
| --- | --- |
| I1 | `status === 'Tested'` ⇒ a `result` is required for the test to count as resolved |
| I2 | `status !== 'Tested'` ⇒ `result === null` |
| I3 | `applicable === false` ⇒ status resets to `Not Tested`, `result = null` |
| I4 | No terminal states — any decision can be revised |
| I5 | Applicability, status and result are three independent axes |

A test that is `Tested` with no result yet is **not** an error — it is a valid intermediate state,
surfaced as *Result required* in the UI and counted in `awaitingResult`.

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

## 5. Derived metrics

`src/domain/metrics.ts` — the only place numbers are produced.

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

completion      = (na + vulnerable + notVulnerable) / applicable
vulnerableRate  = vulnerable / (vulnerable + notVulnerable)
```

Also derived: per-category and per-priority groups, findings by priority, outstanding by priority,
manual-override count, last activity timestamp, the **Next up** queue and the findings list.

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

Import re-keys colliding engagement IDs instead of overwriting.

## 7. Excel export model

| Sheet | Contents |
| --- | --- |
| **Summary** | Engagement identity, coverage counters, completion %, findings by priority, findings overview |
| **Checklist** | Every applicable test: ID, vulnerability, category, priority, status, result, notes, description, guidance, OWASP, CWE, last updated |
| **Findings** | Vulnerable tests only, Critical → Low |
| **Not Applicable** | Excluded tests with rule, reason and whether it was auto or manual — the audit trail for scope decisions |
| **Application Context** | Every fact, grouped by section, with Unknown highlighted |
| **Coverage** | Per-category counts and completion, plus a total row |

Priority and result cells are colour coded; the header row is frozen on data sheets.
