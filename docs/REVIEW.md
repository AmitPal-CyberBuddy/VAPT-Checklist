# Repository review — 2026-10-19

An independent review of the whole repository (code, content, docs, CI, deployment,
repo hygiene), with the fixes applied on the same branch. Point-in-time like the
reports in [`docs/reports/`](reports/); the living docs are the ones this review
corrected.

**Baseline before any change:** `npm test` 285/285 (after a build — 8 production
tests skip without `dist/`), `tsc --noEmit` clean, `npm run build` clean.
**After:** 293/293 tests (8 new), ESLint clean (new), `npm audit` 0 vulnerabilities,
entry chunk 409 kB (was 702 kB).

## Verdict

The application itself is in unusually good shape — the state machine, persistence,
untrusted-input handling and accessibility contracts are more rigorous than most
production software (details below). Almost everything wrong was *around* the app:
the public documentation had drifted from the product it describes, the deployment
instructions were actively wrong, nothing verified a pull request, and the deploy
pipeline could publish code whose full test suite had never run. Those are the
fixes that landed here.

## What is genuinely strong (verified, not assumed)

- **Inconsistent states are unrepresentable** — status/result written atomically,
  repository refuses invariant-breaking records, imports fully validated before a
  single write. The audit suites prove the identities on screen, in Excel and in
  IndexedDB agree.
- **Untrusted-input handling** (`src/domain/untrusted.ts`): dangerous URL schemes
  refused for linkification, spreadsheet formula injection neutralised in exports,
  text limits tied to real Excel/IndexedDB failure modes.
- **No network surface**: no `fetch`, no remote subresources, all outbound links go
  through one primitive with `rel="noreferrer noopener"`. Machine-checked against
  the built artefact by the production audit.
- **The library validates itself**: canonical names/aliases share one namespace,
  every fact must drive a rule (or feed one), support levels are computed from the
  library at runtime so the UI cannot overclaim.
- **Contract tests as design enforcement** (design-system, integrity, journey).

## Findings and fixes

### F1 — High: the docs described a library that no longer exists
README and four living docs still claimed **184 tests (31·64·73·16), 99
subcategories, 542 aliases, 163/21 context/baseline, 40 facts** — months after the
catalog dedup made it **177 (30·62·69·16), 97, 547, 159/18, 41**. The application-type
tables were equally stale (REST 14→13, GraphQL 21→19, wrong starting-checklist
sizes, "105 universal tests"→100, support threshold "14"→13), and
`APPLICATION-TYPES.md` credited the suite with "209 tests".
**Fix:** every number recomputed from the library and corrected in `README.md`,
`docs/TEST-LIBRARY.md`, `docs/DATA-MODEL.md`, `docs/ARCHITECTURE.md`,
`docs/APPLICATION-TYPES.md` — plus a permanent guard, `src/data/documentation.test.ts`,
that recomputes all of them and fails CI if prose drifts again (the same
"computed, not asserted" principle the product already applies to support levels).
ADRs and dated reports were left untouched: their numbers were true when written,
and the reports now say so (`docs/reports/`).

### F2 — High: README deployment instructions were wrong, and harmful if followed
The README told users to copy `docs/deployment/{deploy,ci}.yml` into
`.github/workflows/` "because the automation account cannot push" workflows — but a
better live `pages.yml` already existed, and following the instructions would have
created a **second, conflicting Pages deployment** racing the real one.
`docs/deployment/README.md` likewise claimed the bundle/a11y guards were "not
enforced in the workflow" (they were) and described `pages.yml` as running tests
(it didn't — see F3).
**Fix:** both deployment sections rewritten to describe the live workflows; the
drifted mirror YAMLs deleted (one source of truth); README now matches what a push
to `main` actually does.

### F3 — High: nothing verified a pull request, and deploys shipped untested code
There was no CI workflow at all (only an unexecuted sample in `docs/`). The Pages
workflow ran typecheck + one contract test + build — **the other ~270 tests never
ran in any pipeline**, and the production-audit tests need a pre-existing `dist/`,
so even locally they silently skip (8 skipped in the baseline run).
**Fix:** new `.github/workflows/ci.yml` (PRs + non-`main` pushes); `pages.yml` now
runs dependency audit → typecheck → lint → accessibility contract → build → bundle
verification → **full suite** before anything may publish. The suite runs *after*
the build in both, so the production audit always inspects a real artefact.
`npm run verify` reproduces the whole gate set locally. Node is pinned once, in
`.nvmrc`, and both workflows read it. `deploy-pages` moved v4→v5 to match GitHub's
official Pages starter set (checked against `actions/starter-workflows`); other
actions deliberately stay on that proven set, with Dependabot (F9) proposing
future majors as reviewable PRs instead of blind bumps.

### F4 — Medium: vulnerable dependencies in a security tool
`npm audit` reported 2 high-severity issues (undici, via the jsdom test stack —
dev-only, not shipped, but a bad look and a real CI risk).
**Fix:** `npm audit fix` (lockfile-only change), then made it durable:
`npm audit --audit-level=high` gates CI, `--omit=dev` gates deployment, and
Dependabot opens weekly update PRs.

### F5 — Medium: no lint; ESLint found 14 hook issues including a real perf bug
There was no linter. Running the full strict set (TypeScript recommended + React
Hooks *including the React Compiler rules*) over 14 kLOC produced only 14 findings
— a credit to the codebase — but real ones: `WorkspacePage` built the derived
context as a fresh object every render, defeating the two `useMemo`s that consume
it; several `setState`-in-effect synchronisations; a ref written during render.
**Fix:** `eslint.config.mjs` + `npm run lint` in CI and deploy; all 14 fixed
properly (render-time state adjustment per React's guidance, memoised effective
context, latest-ref moved into an effect) with zero `eslint-disable` comments and
zero test changes. `exhaustive-deps` is an error, not a warning — a stale closure
here writes wrong data into someone's engagement.

### F6 — Medium: no Content-Security-Policy on the shipped page
For a tool that stores client-confidential assessment notes in the browser, the
missing CSP was the one piece of defence-in-depth absent. GitHub Pages can't send
headers, but a `<meta>` policy was possible and nothing the app does needs more
than `'self'`.
**Fix:** a build-only Vite plugin injects `default-src 'self'; object-src 'none';
connect-src 'self'; …` with the two legitimate inline scripts (theme init,
blank-page watchdog) pinned by **SHA-256 hashes computed from the final HTML** —
no `'unsafe-inline'` for scripts, and the hashes can never go stale because they
are derived per build. `style-src` keeps `'unsafe-inline'` (React style props +
the no-JS fallback card) — documented in the config. The bundle checker and the
production audit both re-derive the hashes from `dist/index.html` and fail if the
policy weakens or a script would be blocked. Dev server unaffected (`apply: 'build'`).

### F7 — Medium: 702 kB single entry chunk; warning limit raised to hide it
Every route shipped in the initial bundle, and `chunkSizeWarningLimit: 1200`
silenced the one signal that would have said so.
**Fix:** route-level code splitting (`React.lazy` for every screen except the
landing default route, with the existing skeleton as fallback). First paint now
fetches 581 kB eager JS (≈181 kB gzip) instead of 702 kB (209 kB gzip); the entry
chunk is 409 kB, the knowledge base is its own cache-stable chunk, and each screen
(4–35 kB) loads on first navigation — so an app-code change no longer invalidates
the library chunk for returning users. The warning limit is back down to 600,
and the production audit's size budget was tightened (entry < 500 kB, eager set
< 700 kB) so a screen silently becoming eager again fails CI.

### F8 — Low: social cards declared an image size but no image; iOS icon was SVG
`index.html` promised `summary_large_image` with no `og:image`, and pointed
`apple-touch-icon` at an SVG (iOS requires PNG — the icon silently didn't exist
on iPhones).
**Fix:** a proper 1200×630 card (`public/og-card.png`) rendered from a committed
SVG source using the actual brand mark and the app's own fonts, wired into
`og:image`/`twitter:image` with dimensions and alt text; `apple-touch-icon.png`
(180×180) rendered from the favicon. `scripts/generate-social-images.mjs`
regenerates both; the card deliberately carries no counts that could drift.
(No `<link rel="canonical">` was added: an absolute `href` contradicts the repo's
portable-relative-build invariant, which a production test enforces — `og:url`
already provides the canonical signal to crawlers.)

### F9 — Low: repository hygiene
Five point-in-time reports sat in the repo root among the living docs; no
`CONTRIBUTING`, `SECURITY`, issue/PR templates or Dependabot despite an MIT
licence and a public repo inviting issues from the landing page.
**Fix:** reports moved to `docs/reports/` (via `git mv`, history preserved) with
an index explaining they are dated record, not living docs; `CONTRIBUTING.md`
(gates, the "build before test" gotcha, how to add a library test),
`SECURITY.md` (private reporting + threat model), issue forms (bug report;
test-case suggestion aligned to the library's canonical-name rules), PR template
encoding the project's own conventions, Dependabot (npm + actions, weekly),
`.editorconfig`, `engines` in `package.json`.

## Recommended next (deliberately not done here)

1. **Offline/PWA.** Testers use this on client networks that may be hostile or
   offline; a versioned service worker + web-app manifest would make the first
   load the only load. Not implemented because the update/skip-waiting flow must
   be validated in a real browser — a trapped stale cache in a data-bearing app
   is worse than none. Pair it with (2).
2. **Real-browser E2E in CI.** The jsdom suites are strong, but this sandbox
   (like the previous audits) cannot run Chromium. GitHub-hosted runners can:
   a small Playwright smoke (create → test → export against `vite preview`)
   would also have *executed* the new CSP in a browser instead of only
   re-deriving its hashes statically.
3. **Lazy-load the command-palette index.** `AppShell`/palette import the test
   library eagerly (≈165 kB of the eager set). Loading the search index on
   first Ctrl-K would cut first paint further; it changes palette open latency,
   so measure before/after with real timings.
4. **Suite wall time (~80 s locally).** Several workspace/workflow tests wait on
   real debounce timers. Fake timers (carefully, with Dexie's real async) or
   splitting fast/slow projects would shorten the feedback loop; CI is faster
   than the sandbox but the trend matters more than the number.
5. **Content freshness.** The library was audited against WSTG 4.2 / ASVS 4.0 /
   API Security Top 10 2023. A scheduled content pass against current ASVS/WSTG
   releases — same method as `docs/CONTENT-AUDIT.md` — keeps "OWASP-aligned"
   true. Minor observation from the coverage data: REST has **0** tests that
   name *only* REST (all 13 domain-specific rules also name GraphQL/SOAP), which
   is honest but worth a content look.
6. **Repository settings (owner):** protect `main` requiring the CI workflow;
   confirm Settings → Pages → Source stays on "GitHub Actions"; enable private
   vulnerability reporting so `SECURITY.md`'s link works.

## Verification log

| Gate | Before | After |
| --- | --- | --- |
| `npm test` | 277 passed, 8 skipped (no dist) → 285/285 after build | **293/293**, 22 files |
| `tsc --noEmit` | clean | clean |
| `eslint src` | (not configured; 14 errors on first strict run) | **clean, 0 disables** |
| `npm audit` | 2 high | **0 vulnerabilities** |
| Entry chunk | 702 kB (209 kB gzip), all routes | **409 kB (129 kB gzip)**, routes split |
| Eager JS at first paint | 702 kB | 581 kB (≈181 kB gzip) |
| Bundle check | assets only | assets + CSP presence/strength/hash-pins |
| Docs numbers | 184-era (stale in 5 files) | recomputed; guarded by tests in CI |

---

# Addendum — UI/UX and visual-quality pass (2026-10-19)

Same method as the main review: measure first, fix what the numbers indict, and
turn the claim into a test so it cannot regress silently. The design language
(ADR 0015) and its contract test were treated as constraints, not obstacles —
nothing below re-litigates decisions earlier audits made deliberately
(dense rows, no smooth-scroll, 24 px floor for targets in a professional tool).

**Method note / limitation:** there is still no real browser available in this
environment, so visual claims are verified *arithmetically* from the shipped
tokens (contrast), *structurally* from source (targets, focus, print rules), and
by the full jsdom suite. Anything requiring eyeballs on pixels is listed as a
recommendation, not asserted as done.

## U1 — Contrast: the light theme failed WCAG AA in five places the eye can't audit

Every text token was recomputed against every surface in both themes. Dark was
clean (worst pairing 4.58:1). Light was not — the inverting ink scale is a trap:
tokens chosen while looking at the dark theme quietly invert on paper.

| Pairing (light theme) | Before | After | Fix |
| --- | --- | --- | --- |
| Segmented **Not Vulnerable** label on its glass | **3.09:1** | 4.68:1 | `.text-seg-safe` now uses the badge text step (`safe-400`, itself deepened) instead of `safe-500` |
| Segmented **Vulnerable** label on its glass | **3.69:1** | 4.94:1 | `.text-seg-vuln` → `vuln-400` (deepened) |
| Chip/step/count text on brand/safe/warn fills | **2.92–3.46:1** | 5.34–6.32:1 | New constant `--color-on-fill` replaces `text-ink-950` (which inverts to near-white on paper) in the context Yes/Unknown chips, wizard step pills and the active-filter count |
| **Medium** priority badge on tinted inset | **3.56:1** | 4.73:1 | Light `medium-200` deepened `#a16207 → #875206` |
| **Brand / Critical / Safe** badges on tinted inset | **3.94–4.22:1** | ≥4.66:1 | Light `brand-400`, `vuln-400`, `safe-400` deepened by the minimum that clears AA (hue preserved; side effect: link text and status dots get imperceptibly deeper) |
| **Danger button** label — gradient's pale end | **1.89:1** (3.67:1 mid) | ≥5.16:1 at every stop | Gradient re-stopped `#d80f43 → #be123c → #9f1239` (theme-constant hex; white still passes after the hover brightening) |
| Decorative row chevrons (open affordance), dark | 2.18:1 (a *line* token doing text duty) | 5.31:1 | `text-ink-600 → text-ink-500` — the system's own "faintest allowed" step |

**Made permanent:** `src/ui/contrast.test.ts` (12 tests) parses the tokens,
`BADGE_TONES`, the `.text-seg-*`/`.seg-on-*` rules and the danger gradient out
of the shipped source and computes these ratios in CI. It failed 5 ways on the
pre-fix palette and passes now; the design doc's contrast claim is finally
executable like the rest of ADR 0015.

## U2 — iOS Safari zoomed the page on every field focus

All form controls rendered at 14 px (`text-sm`), below iOS Safari's 16 px
auto-zoom threshold — focusing any field on an iPhone zoomed the layout and
never zoomed back. Controls now use `text-base` below `md` and keep the dense
14 px on desktop (`CONTROL` in primitives, so Input/Select/Textarea and the
filter selects all inherit it). The command-palette input already did this;
the shared control didn't.

## U3 — Touch targets: top-bar icon buttons were 28 px

Search and theme toggle in the mobile top bar were `h-7 w-7`. WCAG AA floor is
24 px, but these are primary actions under a thumb. Now 32 px; the deliberate
24 px density inside the workspace rows/segmented controls (keyboard-first,
audited) is unchanged.

## U4 — Printing produced a clipped, ink-heavy screenshot

`@media print` existed but only flipped body colours: the fixed rail offset,
internally-scrolling panes (a 177-row checklist clipped to one viewport),
sticky bars and dark glass all printed as-is. The block now: swaps in the
light token set from either theme, strips glass/glow/shadows (borders carry
structure), removes the rail offset, expands every scroll region, unpins
sticky/fixed elements, hides interaction chrome (header, footer, toasts,
filter bar, bulk bar, decision tray) and avoids breaking inside panels/rows.
Segmented status/result controls intentionally still print — on paper they
*are* the recorded result, and badges keep glyph + label for greyscale.
Excel remains the deliverable; this makes Ctrl+P a respectable handout.

## U5 — Browser-chrome details that read as "unfinished"

- **Text selection** was already brand-tinted per theme (verified, not changed — an earlier draft
  of this addendum wrongly claimed it as a fix; a duplicate `::selection` rule briefly added
  during the pass was removed again, see Addendum III).
- **Scrollbars** were unstyled (chunky light-grey rails inside the dark
  workspace panes) → thin, token-coloured, with a padded thumb, both the
  standard properties and WebKit pseudo-elements.
- **Autofill** painted dark-theme fields with the browser's pale-yellow block
  and near-black text (the create form actively encourages autofill) → the
  standard inset-shadow repaint in theme tokens.
- **Tap highlight** was the default grey flash → a faint brand tint matching
  the components' own active states.

## Verified as already good (checked, not changed)

Focus-visible ring colour per theme (with the light-mode reasoning recorded in
CSS), `:focus` halo on controls, skip link, roving tabindex, live regions,
`prefers-reduced-motion` kill switch covering skeletons/marquee, tabular
numerals in statistics, `text-wrap: balance` on display headings, route
crossfade keyed at 120 ms, placeholder contrast (≥4.5:1 both themes),
`color-scheme` per theme, prose measure cap (70ch) in the detail pane, nav
labels from `sm`, hover-paused aria-hidden marquee, skeleton loading shapes,
empty states with recovery actions, and the two `text-brand-500` statistics:
every remaining use is a decorative icon beside a real label, not text.

## Recommended next (needs a real browser / design judgement)

1. **Visual QA at the seven breakpoints** — with CI able to run Chromium
   (Playwright), screenshot the key screens in both themes; this pass was
   source-and-arithmetic only. The print layout in U4 especially deserves one
   look in a real print preview.
2. **Landing-page product proof** — the landing is copy + a decorative ticker.
   A static, honest render of the actual workspace (built from the real
   primitives, marked decorative) would show the product instead of describing
   it — a design decision for the owner, not a defect.
3. **Forced-colors (Windows High Contrast) audit** — semantic rails and
   `border` slots mostly survive, but glass tints and glows do not; needs a
   real forced-colors environment to verify rather than guess.

## Verification

| Gate | Result |
| --- | --- |
| `src/ui/contrast.test.ts` | 5 failing → **12/12 passing** |
| Full suite (`npm run verify`) | **305/305**, 23 files (was 293) |
| Design-system contract | passes unchanged (new token, classes all inside the rules) |
| `eslint src` / `tsc --noEmit` | clean |


---

# Addendum III — Phased UX upgrade (navigation, motion, data-viz) (2026-10-29)

Worked phase by phase against `docs/UX-UPGRADE-PLAN.md`, which was rescoped after recon found the
repo ahead of the plan's assumptions (dashboard ring gauge, count-up, skeleton sheen, severity
strip, real-data landing panels and the light aurora canvas already shipped — credited in the plan
rather than rebuilt).

- **Navigation.** Rail recent-engagements quick switch (latest four by `updatedAt`, live progress,
  active state; `useEngagementSummariesSafe` so a blocked database can never darken the shell);
  a keyboard-shortcuts dialog on the `Modal` primitive (`?` anywhere outside a text field, or the
  rail's keyboard button) documenting the workspace's previously undiscoverable keyboard loop;
  scroll discipline (new screens start at the top, Back/Forward restore position, `?test=`
  changes never reset); the engagement tabs' underline is now one measured element that glides.
- **Motion.** The detail panel's identity block crossfades with its body when switching tests;
  scroll-reveal extended to the export screen's secondary cards (the context *form* deliberately
  excluded — mid-action content); application-type cards stagger in.
- **Dashboard.** A coverage composition strip (Vulnerable / Not Vulnerable / Not Applicable /
  Not Tested partitioning the applicable checks) with a swatch+label+count legend in real text;
  ring-centre microcopy "done" → "completed" (canonical vocabulary).
- **Landing.** Sample-check rows now show a lived-in mix (one Vulnerable, one Not Vulnerable, one
  Not Applicable, one Not Tested — scripted states over real library rows, labelled as such in
  code); the light canvas gained the dark canvas's 28px technical grid.
- **Micro.** Click-to-copy test ID in the detail header with toast feedback; `text-pretty` on the
  detail description and steps.
- **Housekeeping.** Removed a duplicate `::selection` rule added in error during Addendum II
  (the branded original pre-existed — claim corrected above); two smoke-test queries scoped to
  `<main>` because engagement names now also appear in the rail; the rail progressbar given a distinct accessible name so it
  never duplicates the list card's. Four `text-warn-400` text sites (4.22:1 in the light theme)
  found still on the fill step were moved to the guarded `warn-300` text step.

All within ADR 0015's language: semantic tokens only, two radii, existing motion durations,
glyph+label never colour alone, reduced-motion respected. Verified structurally and by the jsdom
suite (both contract suites green throughout); no browser was available for pixel-level QA, which
remains the standing recommendation before release.
