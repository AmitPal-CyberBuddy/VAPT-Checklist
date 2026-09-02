# ADR 0011 — Prebuilt search index and explained applicability

**Status:** Accepted

## Context

Two requirements pull in opposite directions.

**Search must be broad.** A tester types "bola", "zip slip", "cwe-89" or "collaborator" and expects
a hit — so the searchable surface is vulnerability name, aliases, ID, category, subcategory, tags,
standards codes, description, all guidance steps, and (on the checklist) engagement notes.

**Search must be instant.** The naive implementation concatenates and lowercases that text for all
184 tests on every keystroke — roughly 300 kB of string building per character typed, plus the
applicability engine re-running for the "Unconfirmed" filter.

Separately, applicability must not be a black box: the tester needs to see *why* a test is in scope
before deciding whether to override it.

## Decision

**Search index built once at module load.** `src/data/searchIndex.ts` produces a lowercase haystack
per test; `SEARCH_INDEX` is created when the library module is imported and reused for every query.
Terms are AND-ed (what testers expect from "jwt bypass"), and title matches rank above
alias/description matches. Engagement notes are matched separately because they are not part of the
immutable library.

**Applicability returns structured conditions.** `suggestApplicability()` walks the rule tree and
returns each leaf condition with an outcome of `met` / `unmet` / `unknown`, its human label from the
context schema and the value actually recorded. The UI renders:

```text
Applicable because:
  ✓ Application has authentication      — Yes
  ✓ Users own individual records        — Yes
  ? Multi-tenant                        — Not recorded
```

Per-context-fact impact counts (`FACT_IMPACT`) are derived from the rules the same way and shown on
the context form as "12 tests".

## Consequences

- Filtering stays instant while typing; only the per-test predicate runs per keystroke.
- Applicability suggestions are legible in the UI, in the checklist drawer and in the exported
  *Not Applicable* sheet, so an override is an informed decision.
- Suggestions are memoised against the engagement context rather than recomputed per render.
- The index is immutable, matching the library. If user-authored tests are ever added, the index
  will need rebuilding on change — a deliberate follow-up, not a current cost.
