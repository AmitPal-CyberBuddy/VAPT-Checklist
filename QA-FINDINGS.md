# Final Product QA — VAPT Checklist

**Scope:** Complete user journey — Create Engagement → Application Type → Context → Applicable Tests → Testing → Result → Dashboard → Excel. Audit only, no new features.

## What was tested

**Full user journey (new E2E suite `src/audit/final-journey.audit.test.tsx`, 4 tests):**
1. **Complete journey** — creates an engagement through the real UI (name → Web Application → 17 context facts incl. multi-selects/singles), verifies the wizard's "tests applicable" count matches what is seeded, records three different results in the Workspace (Tested→Vulnerable + note, N/A, Tested→Not Vulnerable), waits for the debounced note write, confirms the Dashboard "Vulnerable tests" region reflects the work, then builds the Excel workbook and asserts sheet names, Assessment row composition (status/result/notes), Vulnerable + Not Applicable sheet membership, and Coverage totals — all cross-checked against `computeMetrics` and the persisted `countsAreConsistent` identity.
2. **Excel applicability = UI applicability** — for every exported Assessment row, the "Applicability" column must equal `suggestApplicability(definition, effectiveContext(engagement)).summary` — i.e. the export uses the same derived context as the UI.
3. **Notes-only row protection** — a Not Tested test carrying only notes stays applicable when context changes would exclude it (`hasRecordedWork` path).
4. **Malformed stored scope** — a hand-corrupted `scope: 'not-an-array'` record must not crash the engagement screens (still shows content, no error boundary).

**Static review (remaining files):** `src/data/library.ts` (integrity validation, ordering, stats), `src/data/categories.ts` (taxonomy), `src/data/references.ts` (code→URL mapping, WSTG deep links), `LibraryPage.tsx` (filtering, alias hits, references, guidance rendering), `ApplicabilityExplanation.tsx` (empty-condition fallback, glyph mapping), `src/export/xlsxPostProcess.ts` (autofilter injection: column math, self-closed `<sheetData/>`, best-effort fallback), `repository.ts` tail (`inspectBackup` validation incl. state-machine invariants, `importBackup` collision re-keying, `clearAllData`).

**Gates:** full suite `npm test` → 20 files, **267 passed**; `npx tsc --noEmit` → exit 0; `npm run build` → success.

## What was fixed (3 genuine issues)

1. **Excel export ignored derived context** (`src/export/excel.ts`) — the Assessment sheet's "Applicability" column was computed from raw `engagement.context` instead of `effectiveContext(engagement)`, so exported explanations diverged from what the UI showed (e.g. facts derived from the application type). Fixed to `suggestApplicability(d, effectiveContext(engagement))`.
2. **Notes-only rows could be auto-excluded on context change** (`src/persistence/repository.ts`) — `applyApplicability` protected rows with a non-"Not Tested" status but ignored notes; a tester who had written notes without changing status lost the row when context edits made the test non-applicable. Now uses the same `hasRecordedWork` definition as the preview (status **or** notes), so recorded work is never auto-discarded.
3. **Live engagement rows bypassed read-side hardening** (`src/hooks/useData.ts`) — `useEngagement` read records straight from IndexedDB while the repository path normalised them, so a malformed/legacy stored row could crash screens. The hook now runs rows through `normaliseEngagement` (same hardening as `getEngagement()`).

## What remains

- **No real-time browser E2E** — sandbox cannot download Chrome/Playwright; verification is via the in-tree jsdom + fake-indexeddb suites (including the new journey test) and code review.
- **Cosmetic only, deliberately not changed (no features, no speculative refactors):** duplicate docstring above `scopePool`; minor indentation in the new test file's helper functions.
- Full repository review was completed in prior segments (state machine, security surfaces, backup/restore, production behaviour); no other genuine issues found.
