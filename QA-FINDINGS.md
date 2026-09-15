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

## Segment — 2026-09-15: catalog merge, applicability re-scoping, UX polish

**What was fixed**

1. **Duplicate testing objective merged** (`src/data/tests/authorization.ts`) — AUTHZ-004 "Horizontal Privilege Escalation" was the same objective as AUTHZ-002 IDOR/BOLA (same rule, overlapping guidance). Merged into AUTHZ-002: absorbed the workflow/parameter-pollution guidance steps and the aliases (Horizontal Privilege Escalation, Cross-Account Access, Cross-User Data Modification); the pinned IDOR/BOLA name kept. AUTHZ-001 now points to AUTHZ-002/009 for identifier-specific work. Library 178 → 177, `LIBRARY_VERSION` 1.4.0.
2. **Retired-test migration** (`src/data/library.ts`, `src/persistence/repository.ts`) — new `RETIRED_TEST_MERGES = { 'AUTHZ-004': 'AUTHZ-002' }`; `syncLibrary` carries a merged test's recorded work into its successor via the exported `mergeRetiredState` (Vulnerable beats all → successor's status → retired's status; notes from both kept, retired side labelled `[AUTHZ-004]`; applicable = OR; manual source kept) and removes the orphan row. Result now reports `merged` (SettingsPage surfaces it). Unmapped retired rows keep the old convention: reported, never deleted.
3. **CRYPTO-007 re-scoped** (`src/data/tests/crypto-file.ts`) — the rule fired on JWT auth or external calls; the JWT branch was pure overlap with SESS-010. Rule is now `callsExternalServices` only; description/guidance scoped to externally signed/MAC-protected values, with cross-refs to SESS-010 and API-012 (webhook alias moved to API-012's territory).
4. **Cross-refs & text corruption** — API-003↔DOS-005, AUTH-005↔DOS-001, INFO-004→CRYPTO-003, DISC-007→PRIV-002 pointers added; INJ-022 trimmed; all 10 missing-space corruption spots fixed (authentication, authorization, crypto-file, api-graphql, client-logic).
5. **Stale counts made dynamic** — EngagementsPage empty state said "184 vulnerability tests" (hardcoded, wrong); now `TEST_LIBRARY.length`. Stale "184" comments in searchIndex.ts and untrusted.ts de-hardcoded. LandingPage marquee swapped retired AUTHZ-004 for live AUTHZ-005.
6. **Support threshold follows the deduplicated catalog** (`src/data/typeCoverage.ts`) — the threshold is defined as the size of the REST API domain set; that set had 14 rows only because IDOR and Horizontal Privilege Escalation were double-counted. After the merge the distinct-objective set is 13, so the threshold is 13 (comment explains why; audit mirror in applicationType.audit.test.tsx updated). REST API stays 'supported' — no coverage was lost, a duplicate row was.
7. **Dashboard command band de-duplicated** (`EngagementLayout.tsx`) — on the Dashboard tab the band was repeating the six count badges and the big progress block that the dashboard's own stat band already shows. Those are now hidden on the dashboard index tab only (breadcrumb, name, URL/type/scope line and status select remain); every other tab is unchanged.
8. **Test detail applicability block** (`TestDetailPanel.tsx`) — the ~70-word explanation paragraph cut to one line; the condition list, rule line and manual-override row are unchanged.
9. **Workspace list row mobile** (`TestListRow.tsx`) — on narrow screens the inline status control squeezed the test name to a few words; the row now wraps the control under the name below ~lg (name keeps a 14rem basis on small screens, `lg:basis-0` restores the single-line desktop row).

**Tests added (10)** — `repository.test.ts`: `mergeRetiredState` unit tests (adopt, vulnerable-wins with labelled notes, successor judgement wins, stays Not Tested, applicability OR + manual source) and `syncLibrary` integration (carry + orphan removal, re-key when successor row missing, unmapped retired row still reported and kept). `knowledge.test.ts`: AUTHZ-002 carries the merged aliases and AUTHZ-004 is gone; CRYPTO-007 no longer triggers on a JWT-only target. One audit helper retargeted: engagement-status tests waited on the header badge row that the dashboard no longer renders; they now wait on the dashboard's "Assessment statistics" region (same load signal).

**Gates** — `npm test`: 21 files, **284 passed, 0 failed** (includes the §10 GitHub Pages deployment-artefact suite, which runs only when a fresh `dist/` exists); `tsc --noEmit` clean; `npm run build` clean; `validateLibrary()` → []; 177 tests, v1.4.0.

## Segment — 2026-09-15 (cont.): UI/UX Pro Max skill audit

Cloned `nextlevelbuilder/ui-ux-pro-max-skill` (v2.13.0) and audited the app against its 119 UX guidelines, 192 reasoning rules, the data-dense-dashboard style spec, the developer-tool product profile, and the React stack guidelines. No headless browser is available in this sandbox (Chromium download blocked), so the skill's `design-audit.mjs` could not run live; every finding below was verified against source instead.

**Already compliant (spot-verified in code):** skip link; global `:focus-visible`; reduced-motion (global kill + per-component); modal focus trap + Escape + focus restore; SegmentedControl as `role=radiogroup`/`role=radio` with roving tabindex; toast auto-dismiss at 5 s that pauses on hover/focus; skeleton loading panels (no content jump); empty states with recovery actions; bulk multi-select; `autocomplete`-free but labelled inputs with `aria-label` (gate-enforced); viewport + `lang` meta; Excel chunk code-split; measured memoization with field-level comparator (the React-stack guideline's "memo only measured hotspots"); heading hierarchy via `PageHeader` h1 + SectionHeading h2; 24 px+ touch targets on all controls; marquee is decorative (aria-hidden, hover-pause, reduced-motion freeze).

**Gaps found and fixed**

1. **Focus Not Obscured (WCAG 2.4.11, High)** — no `scroll-padding`/`scroll-margin` anywhere; focused elements could land under the pinned decision tray (mobile page scroll) or the sticky bulk bar (list scroll). Added: `scroll-padding-bottom: calc(8.5rem + env(safe-area-inset-bottom))` on `html`; `scroll-pb-32` on the detail pane scroller; `scroll-pt-24` on the workspace list scroller.
2. **Essential Text Truncation (Critical)** — the engagement list row and the engagement header truncate the URL + scope with no path to the full value. Added `title` attributes carrying the full joined string (hover/focus reveal, no visual change).
3. **Autofill support (Medium)** — Client / organisation and Tester inputs now carry `autocomplete="organization"` / `autocomplete="name"` so the OS/manager autofill works on the create form.

**Deliberately not changed (skill recommendation conflicts with the product brief):** no smooth-scroll (decorative motion the brief bans); no bundle-size reduction beyond the existing Excel split (no new deps allowed); no touch haptics (web, non-essential); sticky category headers in the list (the list is intentionally priority-sorted and flat — rows carry their category); marquee pause button (decorative + hover-pause + reduced-motion freeze is sufficient for aria-hidden content).

**Gates** — `npm test` 284/284; `tsc --noEmit` clean; `npm run build` clean; new utilities verified present in the built CSS.
