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

---

# Round 7 — Instrumentation & tactility

**Theme:** upgrades to the design system itself, not individual pages: tactile controls, instrumented metrics, honest motion, and browser-chrome integration. Still zero new runtime dependencies.

## 1. Segmented control: sliding indicator

- `SegmentedControl` (the status/result/applicability control across the workspace) is now an equal-column grid with a single tone-aware indicator surface that travels between segments (200ms, standard ease). Changing a result reads as one motion instead of two static states.
- Radios, accessible names, roving tabindex, glyphs and tones are unchanged — only the presentation layer moved.

## 2. Dashboard instruments

- **Progress ring** in the command band: an SVG gauge whose stroke fills with the same eased count-up that drives the percentage, centred on `completed/applicable`. Turns safe-green at 100%.
- **Severity distribution strip** above the vulnerable list: Critical → Low proportions in one bar (tone-coded, `aria-hidden`; the counts remain spelled out in the section description for non-visual readers).

## 3. Toast honesty

- A hairline **countdown bar** drains over the 5s auto-dismiss window, in the toast's tone colour. Hovering or focusing the toast pauses both the timer and the bar — the bar never lies about when the toast will leave.

## 4. Scroll-driven section reveals

- Modern CSS only: `animation-timeline: view()` with `@supports` progressive enhancement and a `prefers-reduced-motion: no-preference` guard. Sections rise in as they enter the viewport and hold; browsers without support render instantly. Applied to landing sections, dashboard sections, library category cards and settings cards — never to controls or mid-action content.

## 5. Browser integration

- **Route-aware tab titles**: Engagements / New engagement / Test library / Data & settings / `<engagement name>` — so history and tabs stay meaningful with several assessments open.

## 6. Tests / build

- `vitest run` — **21 files, 274 passed** (one environmental timing flake in a first run did not reproduce across two subsequent full runs)
- `tsc --noEmit` — exit 0 · `vite build` — success · deployment-artifact audit — 12/12 · bundle 689.7 kB / gzip 206.1 kB

---

# Round 8 — Console aesthetic (parity pass with CyberBuddy / ScriptSentry)

**Theme:** the reference tools were studied directly and their visual vocabulary adopted where it fits: display-scale headlines, a mock terminal session, a capability marquee, a bold mono stat band, and tag-chip cards. Still zero new dependencies; landing-first because that is the first impression.

## 1. Hero, rebuilt as a console

- **Display typography:** `.display-hero` (clamp 2rem → 3.4rem, 700 weight, balanced wrap) — the H1 was previously capped at 24px by the audited UI scale; display sizes now live in CSS alongside `metric-hero-value`, keeping the JSX scale audited.
- **Punchy two-tone headline:** "Penetration testing methodology, *every check your assessment needs.*" — the phrase anchors (H1 regex, CTAs, stat labels) are preserved for the smoke tests.
- **Live status line:** pulsing safe-green dot + the local-first kicker, in the style of ScriptSentry's "Private by default" banner.
- **Terminal session mock:** a CRT-styled console (`.terminal` — scan-line texture, traffic-dot title bar, brand prompt, blinking block cursor, HUD corner brackets via `.corner-frame`) walking `vapt new → vapt status → vapt export`. Decorative: `aria-hidden`, honest numbers (library total read live).

## 2. Capability marquee

- A seamless ticker (`.marquee` + `-track`, masked edges, hover-to-pause) streaming 16 **real** checks from the library — SQL Injection, IDOR/BOLA, SSRF, XXE, request smuggling, cloud metadata exposure… `aria-hidden`; reduced motion freezes it.

## 3. Stat band

- The four headline numbers (checks / categories / library version / report sheets) moved from small tiles to a divided band with oversized mono values (`.stat-band-value`). Labels and hints unchanged for the smoke tests.

## 4. Tool-card energy

- "What it does" cards gain tag-chip rows (application type · context facts · applicability rules / CWE · OWASP WSTG · testing guidance / status · result · notes · Excel workbook · JSON backup) — the same scanning affordance CyberBuddy's tool cards carry.

## 5. Tests / build

- `vitest run` — **21 files, 274 passed** · `tsc --noEmit` — exit 0 · `vite build` — success · bundle 694.5 kB / gzip 206.9 kB
- All landing anchors preserved: H1 regex, `Start an assessment` / `Explore the test library` links, `Methodology checks`, `How it works`, `Export the report`, maintainer links.

---

# Round 9 — Complete visual makeover: "Luminous Obsidian"

**Verdict addressed:** the shipped state read as 2/10 — "basic buttons, not styled" and "bad bounce animation choices." This round is a from-the-surface-up reskin of the design layer, not a patch on the skeleton: a deeper obsidian canvas lit by a cyan→violet duotone, buttons rebuilt as layered physical objects, and every overshoot/squeeze removed from the motion system.

## 0. The smoking gun (why buttons looked unstyled)

Tailwind v4's old `[--var]` arbitrary shorthand does **not** wrap the value in `var()` — the built CSS contained `.rounded-\[--radius-control\]{border-radius:--radius-control}`, which is invalid CSS that browsers silently discard. All 52 usages rendered with square corners. Fixed by mass-migrating to the v4 paren syntax: `rounded-(--radius-control)`, `rounded-(--radius-panel)`, `shadow-(--shadow-panel)`. **Verified in the rebuilt `dist/` CSS:** `border-radius:var(--radius-control)` and `border-radius:var(--radius-panel)` now emit correctly, and zero invalid `border-radius:--radius-control` remains.

## 1. The palette: obsidian + duotone light

- Ink foundation deepened (`ink-950 #05070f`, cooler mid-steps, new `ink-750`) so lit surfaces have range.
- **Violet accent duo added as a second voice** (`accent-300/400/500/600`) — used only for gradients, ambient light and identity edges; meaning still rides on brand/vuln/safe/warn. Light theme gets its own darker violet steps for contrast on paper.
- **Aurora canvas:** the dark body now carries three fixed radials (cyan NW, violet E, cyan SE) over the fine technical grid — atmosphere, not decoration. The light paper gets the same two lights retuned.
- Radii grew: controls `0.5→0.625rem`, panels `0.75→1rem`.

## 2. Buttons — physical objects, not flat rectangles

All five variants are now defined in CSS (`styles.css`) as layered surfaces: gradient body + machined top highlight + crisp border + coloured halo.

- `.btn-primary` — 135° cyan→blue gradient, `brand-300→600`, inset top light, 24px brand halo; hover brightens and feeds the glow; press sinks exactly 1px.
- `.btn-secondary` — smoked glass: translucent light gradient over ink, cool hairline, hover picks up a faint brand halo.
- `.btn-subtle` — recessed glass, quiet sibling, no halo.
- `.btn-ghost` — borderless until hover.
- `.btn-danger` — red gradient with its own halo; the only red surface in the UI.
- Disabled buttons lose halo/filter/transform entirely (pointer-events gated in CSS).

## 3. Motion — de-bounced

- `--ease-spring` **deleted**. New system: `--ease-out` (expo-out — decisive settle) and `--ease-smooth` (glide).
- `pop-in` / `rise-in` keyframes rewritten as plain rises — no overshoot keyframes, no scale.
- `pop-confirm` is now a light-up flash (opacity), not a 1.12 scale pulse.
- Removed: `.btn-nudge` icon nudge, card-lift `scale(1.004)`, button `hover:-translate-y-px` + `active:scale-[0.98]` squeeze, segmented-control `active:scale-95`, nav-pill lift, icon-button `hover:scale-105`, result-button squeeze.
- Stagger tightened 55→45ms. `prefers-reduced-motion` kill-switch unchanged.

## 4. Surfaces, focus, identity

- `.panel` is glass over obsidian: a faint white gradient wash, cool hairline (`--glass-border`), layered shadow (`--shadow-panel` now includes a top light edge + contact shadow + wide lift). Light theme trades glass for warm paper + soft shadow.
- **Unified focus language:** inputs and selects focus with `focus:shadow-(--glow-brand)` — the same halo the primary button casts — plus a crisp `brand-400` border.
- `.gradient-heading` is now a true duotone: ink → cyan → violet. The landing hero span, dashboard headings, etc. all inherit it.
- `.brand-mark` (header tile) and `.brand-edge` (header keyline) carry the cyan→violet gradient; `.hero-stage` and `.cmd-band` gained violet corner lights.
- Glow tokens are theme-aware: `--glow-brand/safe/vuln` are luminous halos on dark, tinted halos on light.

## 5. Gates

- `tsc --noEmit` — exit 0 · `vite build` — success, 693.8 kB / gzip 206.8 kB · `vitest run` — **21 files, 274 passed**
- Anchors and audited string contracts untouched (visual-layer-only changes; the only JSX diffs are class names and removed decorative spans).
- Preview re-verified: new tokens (`--ease-out`, `accent-500`) served; `ease-spring` gone.

---

# Round 10 — Instrument-grade status system (the "childish glyphs" purge)

**Verdict addressed:** "the status update thing — vuln or not, tested or not — looks bad and childish… this is for many areas, check the whole tool." Root cause: every state in the product was carried by **mono unicode glyphs** (▲ ✓ ○ ● ⊘ ◐ ▰▰▰ ★) rendered in `font-mono` inside badges and buttons — toy-like, inconsistent across fonts/platforms, and paired with solid-fill buttons and heavy warn rings. This round replaces the entire status vocabulary with a drawn icon set and rebuilds every control that displays a state.

## 1. A real icon set for states (src/ui/icons.tsx)

Five new 24px stroke icons drawn for badge sizes (11–13px, strokeWidth 2.5): `IconCircle` (Not Tested — open ring), `IconCircleFilled` (Tested — filled disc), `IconBan` (N/A — struck circle), `IconCircleHalf` (Limited/partial), `IconSpark` (High value). Together with the existing `IconAlert` (Vulnerable) and `IconCheck` (Not Vulnerable), every state now has one drawn glyph — never colour alone.

## 2. Badge v2 — pills with soft tints

- Shape: `rounded-full` pills with a transparent border slot (bordered and borderless tones keep identical metrics).
- Tones: soft translucent tint + theme-flipped text step. **Only Vulnerable and Critical earn a border** — red reads as an event without every surface shouting. Low priority dropped its misleading brand-blue for quiet ink.
- `glyph` is now a `ReactNode` (drawn icon), not a `font-mono` string.

## 3. PriorityBadge — a signal meter

The `▰▰▰` unicode bars became a three-bar **signal meter** (3px rounded bars, height-stepped, filled by level: Critical 3 / High 2 / Medium 1 / Low 0) — severity readable in shape as well as hue, next to the text label.

## 4. The row status control (the specific complaint)

- **Select:** neutral chrome always (no more colour-tinted text). A small **status dot sits inside the control** — hollow ring / cyan disc / grey disc / amber disc — so the state reads at a glance without tinting the whole surface.
- **Result buttons:** the solid `▲`/`✓` fills are gone. Two compact icon chips (alert-triangle, check) — quiet neutral when inactive; when active a tinted chip with its own border (red / green). Tooltips + `sr-only` names + `aria-pressed` preserved.
- **Awaiting-result state:** the old flashing `ring-2 ring-warn-400` became a calm amber-tinted group (`border-warn-400/45 bg-warn-500/10`) with an amber dot in the select.

## 5. Segmented controls — states, not toy buttons

The detail panel's status/result segmented controls dropped their solid fills (solid red/green/blue chips) for **tinted glass chips with a faint halo** (`.seg-on-*` + `.text-seg-*` in styles.css, theme-aware for both dark and light). A segment marks a state; it should not read like a button.

## 6. Whole-tool sweep

- **Dashboard:** all Badge/Stat glyphs → icons; the readiness banner (—/✓/◐) → IconBan/IconCheckCircle/IconCircleHalf; `★ High-value tests` and `▲ Vulnerable tests` headings → IconSpark/IconAlert; per-category `▲ n` counts → icon + count.
- **Engagement layout:** status legend badges → icons. **Engagements page:** vulnerable badge → icon. **Wizard:** support badges (✓/◐/○) → icons.
- **Workspace:** filter-summary "▲ n vulnerable" chip → icon; detail panel "✓ Saved" → icon; N/A quick-reason chips → pills.
- **Applicability explanation:** ✓/✕ condition marks → IconCheck/IconX chips (`?` stays text).
- **Settings:** the five storage-fact ✓s → IconCheck.
- The landing terminal mock keeps its unicode check marks deliberately — that is what terminal output looks like.

## 7. Test-suite stability (infrastructure, not assertions)

Two journey tests (workflow, final-journey) began deadlocking after "Create engagement": the wizard's ~150-row Dexie write stalls forever if the very next await is RTL's act-wrapped `findBy*` polling (verified deterministic; **reproduced on unchanged HEAD code**, so not a regression from this round). Fix: a `settleWizardWrite()` helper — a 250ms act-scoped sleep before the first post-create query — plus patience bumps (5s find / 20s test budget). **No assertion changed.**

## 8. Gates

- `tsc --noEmit` — exit 0 · `vite build` — success, 696.1 kB / gzip 207.2 kB · `vitest run` — **21 files, 274 passed**
- Verified in built CSS: `.seg-on-brand`, `.text-seg-vuln`, `.h-6\.5`, `.w-[3px]` all compile.
- All anchored strings preserved: `Status for X` / `Result for X` / `title="Vulnerable"` on row buttons, radios `Tested`/`N/A`/`Vulnerable`/`Not Vulnerable`, `High value`, `Not Applicable` counts, `Limited` support badges.
