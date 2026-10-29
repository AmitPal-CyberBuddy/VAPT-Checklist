# Contributing

Contributions are welcome — test cases, guidance improvements, bug reports and code.
The bar is deliberately mechanical: if the gates pass and the conventions below hold,
a change is almost always acceptable.

## Setup

```bash
nvm use            # Node 22 (see .nvmrc; `engines` in package.json)
npm ci
npm run dev        # http://localhost:5173
```

## The gates

One command runs everything CI runs (build, bundle verification, full suite):

```bash
npm run verify
npm run lint       # ESLint: TypeScript + React Hooks rules, zero-warning policy
```

Notes that save confusion:

- `npm test` is much faster for iteration, but the **production audit tests skip unless
  `dist/` exists** — run `npm run build` first (or just use `npm run verify`) before
  trusting a green run after touching anything deployment-shaped.
- The suite includes contract tests that read the source and docs: the design-system
  contract (vocabulary, labels, colour-plus-glyph), the library integrity checks, and
  `src/data/documentation.test.ts`, which recomputes every number printed in the
  README and living docs. If you change the library and a docs test fails, update the
  docs to the recomputed numbers — never hand-edit the test's expectations.

## Adding or changing a test case

The checklist *is* the library, so most valuable contributions are content:

1. Read [`docs/TEST-LIBRARY.md`](docs/TEST-LIBRARY.md) — canonical naming, alias and
   taxonomy rules, applicability conventions, and the authoring checklist.
2. Add the definition under `src/data/tests/…` in the area file that owns its category.
3. Bump `LIBRARY_VERSION` in `src/data/library.ts` (engagements record which revision
   they were seeded from).
4. If you retire a test into another one, add a `RETIRED_TEST_MERGES` mapping so
   recorded work is carried into its successor instead of being orphaned.
5. `validateLibrary()` (run by the tests) enforces the structural rules: unique IDs,
   one shared namespace for names + aliases, declared subcategories, recognisable
   OWASP/CWE codes, minimum guidance quality.

## Code conventions worth knowing

- **One vocabulary.** `Not Tested / Tested / N/A`, `Vulnerable / Not Vulnerable` —
  the same strings in UI, export and docs, always with a glyph + label, never colour
  alone. See [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md).
- **Inconsistent states are unrepresentable.** Status + result change in one atomic
  transition and the repository refuses records that break an invariant
  ([ADR 0013](docs/adr/0013-unrepresentable-inconsistent-states.md)). Don't add a code
  path that writes one without the other.
- **Derived, never stored.** Metrics, applicability suggestions, support levels and
  references are computed from definitions + context ([`docs/DATA-MODEL.md`](docs/DATA-MODEL.md)).
  If you find yourself persisting a computed value, stop and compute it instead.
- **Product boundary.** This is a checklist and assessment tracker — deliberately not
  a scanner, evidence store, remediation tracker or collaboration platform
  (README, "What it is not"). Features outside that line won't be accepted even when
  they're good ideas.

## Pull requests

CI runs the full gate set on every PR. The PR template lists the checks; the short
version is `npm run verify` + `npm run lint` locally, a `LIBRARY_VERSION` bump for
library changes, and docs updated where a claim changed.
