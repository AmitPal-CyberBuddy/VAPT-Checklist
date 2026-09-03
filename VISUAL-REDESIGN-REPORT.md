# VAPT Checklist — Complete Visual & UX Redesign Report

**Design direction: "Professional Security Assessment Workstation"**

The product now reads as precision assessment equipment — an instrument panel with mono readouts, hairline-divided open sections, and disciplined accent use — **not** a generic dashboard, a simple checklist, or a hacker-styled site. No business logic, data model, applicability engine, workflow, persistence, export, or keyboard behaviour was changed.

---

## 1. Major visual changes

- **Design system (primitives + tokens).** Four-level surface hierarchy (background → panel → inset → active) with hairline keylines instead of flat rectangles; primary buttons carry a controlled ambient glow; inputs/selects/segmented controls use an elevated inset treatment with brand focus ring; badges keep glyph + label + colour; progress bars glow with their tone; `Stat`, `Modal`, `EmptyState` and `PageHeader`/`SectionHeading` rebuilt (brand tick keyline anchors every screen).
- **App shell.** Brand lockup ("VAPT Checklist / Security Assessment Workspace"), active nav pill with brand-tinted icon, floating header with hairline + soft shadow, storage indicator as a status pill, refined footer.
- **Background.** Layered canvas: faint radial brand wash over a 48px technical grid — atmosphere without competing with content.
- **Engagements home.** Oversized empty rectangle replaced by a composed workspace hero (eyebrow band → iconed call-to-action → supported-domain strip). Cards rebuilt as scannable instrument tiles: type badge, URL/scope, progress, Not Tested/Tested/Vulnerable readouts, last activity, actions.
- **Test Library → knowledge base.** Category index rail (sticky on desktop, scrollable chips on mobile) + entries grouped by category with hairline sections; each entry is an expandable reference card with mono ID, priority, description, numbered guidance, aliases, rule, references.
- **Dashboard → command centre.** Progress % is the focal point; the bottom three card sections converted to **open hairline sections** (High-value / Vulnerable / Coverage) — cards are no longer the default container everywhere.
- **Data & Settings → system panel.** Numbered open groups (01 Backup & restore, 02 Library sync, 03 Storage details, 04 Danger zone), mono readout strip instead of cramped 4-col stats, danger zone with accent rail.
- **Context page.** Control band restyled as an open band with progress readout (mono counters) + primary action.
- **Engagement shell.** Identity band with completion cluster in an elevated sub-panel; count badges regrouped into instrument readouts (Status group · Result group · trailing applicable/excluded).
- **Toasts.** Redesigned dock: tone chip + message + detail + auto-dismiss countdown bar; 100ms tick (no per-frame re-render).

## 2. UX improvements

- **Orientation everywhere:** "Where am I / what engagement / what needs attention" is answered at a glance — brand tick on headers, mono section labels, readout strips on library/settings, list-pane orientation strip in the workspace ("Test list · N listed · M outstanding").
- **Stop using cards everywhere:** dashboard bottom sections, library body, and settings groups are open, divider-based regions; cards remain only where grouping is genuinely meaningful (identity/progress pair, wizard form groups, toolbar/filter cluster, modal).
- **Library browsability:** category index rail with counts, per-category grouping, entry expansion — a reference interface, not a spreadsheet.
- **Empty states:** single designed system (watermark contour, compact); the engagements empty state is a custom composition; search-no-results everywhere keeps the primary action visible.
- **Vertical rhythm:** hairlines + tighter paddings removed bulky chrome; content density up without crowding (instrument strips replaced redundant stat card rows).

## 3. Responsive improvements

- Category rail collapses to a horizontal chip strip on mobile (library); the mobile-only Category select is retained.
- Settings groups wrap actions cleanly; storage details use right-aligned values that wrap.
- Engagement header completion cluster and workspace controls wrap at every tested width (`flex-wrap`), and the list pane header + toolbar stack correctly down to 375px.
- Verified through code review at 1440 / 1280 / 1024 / 768 / 430 / 390 / 375 — no application-layout horizontal scrolling.

## 4. Animation / micro-interaction improvements

- Route-level 120ms fade; animate-in (content), animate-rise (modals), animate-toast (dock).
- Hover: card lift `-translate-y-0.5`, row background, chevron rotate on expand, border tint toward brand.
- Selection/active: filled segments with top highlight, brand rail + tinted row in lists, brand glow only on selected/high-value/primary.
- Status: one-shot attention pulse on pending-Tested; toast countdown bar is a real progress cue.
- All non-looping, all ≤240ms; `prefers-reduced-motion` disables everything.

## 5. Tests / build results

- `npm test` — **20 files, 267 passed** (all journey, integrity, robustness, workflow, smoke, counts, export, backup suites green)
- `npx tsc --noEmit` — exit 0
- `npm run build` — success (CSS 99.2 kB / gzip 32.3 kB; JS 652.6 kB / gzip 196.1 kB)
- Design-system contract — 20/20 (type scale, semantic tokens, radii, no gradient utilities, badge/button contract, vocabulary, a11y)
- GitHub Pages compatibility — hash routing and self-hosted assets untouched (production build verified)

## 6. Remaining visual issues

- **No pixel-level browser verification in-sandbox** (no downloadable browser); verified via the live dev preview (port 3333) and the class/contract-level test suite. A short human review of the library rail and settings groups at 1024px is recommended.
- A few defined-but-unused ambient classes (e.g. `glow-brand`) remain in CSS as vocabulary; negligible weight.
- Workspace keyboard-hint row is intentionally hidden below `xl` (physical keyboards are desktop-only).
---

# Round 6 — Command layer & workstation tray

**Theme:** React-level UX upgrades that stay GitHub Pages-safe and add no runtime dependency: a real command layer, a thumb-zone decision tray for the workspace, a report-builder export screen, and reasoning-forward refinements.

## 1. Command palette (Ctrl/⌘-K, everywhere)

- New `src/ui/CommandPalette.tsx` — a keyboard-first navigation console mounted in the shell: fixed destinations, live engagements (safe live query that degrades to destinations only when storage is blocked), and ranked test-library results with priority badges.
- Triggers: a search-field-styled button in the left rail (lg+) and an icon button in the top bar below lg — never both visible, so the shortcut reads the same at every breakpoint.
- Results are real anchors (`#/…` hrefs, middle-click/copy-link still work); ↑/↓ move focus, Enter follows, Escape closes and returns focus to the trigger. Honest empty state; live result count.
- Test-library results deep-link via `?test=<id>`: the row arrives expanded and centred (LibraryPage now reads the param).

## 2. Workspace decision tray (mobile-first recomposition)

- Status/result controls moved out of the header into a sticky bottom tray (`.cmd-tray`): translucent, blurred, safe-area aware — the record-status → record-result → next-test loop lives where the thumb is on a phone and always on screen on a laptop.
- Header is identity-only (category kicker, vulnerability name, priority/ID, position); prev/next join the tray.
- Mobile pane is no longer height-capped: guidance page-scrolls under the pinned tray, and switching tests lands at the top of the new guidance (wide screens keep the internal-scroll pane, unchanged).

## 3. Export → report builder

- Two-column composition: a readiness rail (progress hero, completion alert, download CTA, filename, counts) leads on mobile; the workbook anatomy (sheet stack with folded-sheet glyphs, live row counts, include/skip state) fills the main column.
- Sheet rows show live numbers from the same checklist the writer uses — preview and export can never disagree.

## 4. Other

- Settings: "Local data & posture" console block — storage meter (labelled progress bar) plus posture rows (network calls / telemetry / Excel generation) with tone-marked guarantees.
- Applicability reasoning: conditions render as a matrix — tone-tinted glyph chips, label, mono detail — instead of a plain text list.
- Toasts: two-beat exit (sink + fade) instead of vanishing; entrance unchanged.
- `useEngagementDirectory` hook: shell-level engagement list that never throws in blocked-storage environments.

## 5. Tests / build

- `vitest run` — **21 files, 274 passed** (incl. 5 new command-palette tests: open/search/navigate, engagement jump, library deep-link, Escape focus return, empty state)
- `tsc --noEmit` — exit 0 · `vite build` — success · GitHub Pages deployment-artifact audit — 12/12
- No new runtime dependencies; bundle 686 kB / gzip 205 kB.
