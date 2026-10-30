# VAPT Checklist — Major Visual Redesign

Presentation-layer overhaul only. No business logic, workflow, data model, persistence, keyboard behaviour or responsive architecture was changed. All 267 existing tests pass unchanged.

---

## What changed, by design goal

### 1. Layout & composition
- **Engagements home** — replaced the large generic empty-state rectangle with an intentional composition: a "Security Assessment Workspace" eyebrow band, an icon-anchored *No engagements yet* block with a primary Create action, and a footer strip listing every supported domain (Web · REST API · GraphQL · … · Cloud). Cards carry only what a scan needs: name, type, client, URL/scope, progress, Not Tested / Tested / Vulnerable counts, last activity, actions.
- **Engagement shell** — identity band now reads as a real app shell: breadcrumb → name → URL/type/scope, with completion + status clustered in an elevated sub-panel and the six counts as a badge strip.
- **Dashboard** — the biggest number (progress %) is now the focal point of the top band; stats keep their 2/3/6-column grid; high-value tests got a rank chip so "what next" is scannable.
- **Workspace** — the detail panel is the hero: sticky header carries identity + status/result controls; guidance steps, notes, applicability and references are grouped sections; notes sit in an elevated inset so the test area reads as a working surface.

### 2. Visual identity
- Kept the semantic token system (ink/brand/vuln/safe/warn/high/medium) but extended the surface ramp with `ink-925`, `ink-875`, `ink-750`, `ink-650` steps.
- Controlled brand glow is reserved for the selected/active/high-value item only (selected type card, active worksheet concept, primary buttons).
- Every page header and section heading carries a **brand tick** — a fixed vertical keyline that anchors identity across screens.

### 3. Background
- The flat grid is now a layered canvas: a very low-intensity radial brand wash at the top over the fine 48px technical grid. Both sit far below content contrast.

### 4. Header / navigation
- Brand lockup tightened ("VAPT Checklist / Security Assessment Workspace"), icon block with subtle glow, active nav pill gets a brand border + brand-tinted icon, header gains a hairline + soft ambient shadow, storage indicator refined into a pill.

### 5. Typography
- Hierarchy strengthened **within** the enforced seven-step scale: micro/uppercase/tracked labels for metadata, semibold tracked titles, larger stat numerals; brand ticks + uppercase section rules create levels without adding sizes.

### 6. Cards & surfaces
- Four surface levels in CSS: app background → `panel` (primary, keyline + ambient shadow) → `panel-inset` (elevated insets) → `panel-active` (selected). Different jobs use different treatments (bordered grouping, elevated insets, flat empty-state canvas) instead of one card style for everything.

### 7. Status visualization
- Status/result keep glyph + label + colour (never colour alone). Segmented controls for status/result gained a clearer active treatment (filled + top highlight); the pending-Tested cue uses a one-shot attention pulse.

### 8. Micro-interactions
- Page entry fades (120 ms keyed by route), cards lift 2px on hover, mode/selection switches use fast transitions, toasts rise from the dock, progress bars get a tone-matched glow. All under 400 ms, nothing loops, and `prefers-reduced-motion` disables everything.

### 9. Forms / wizard
- Stepper: stronger active state with soft brand glow; type cards: selected = brand border + glow + lift, coverage numbers emphasised; context facts: tri controls and multi-select chips keep radiogroup/group semantics but gain filled active states; review screen priority cards are colour-coded by severity and the total-applicable card is keylined.

### 10. Empty states
- The `EmptyState` component itself was redesigned (watermark contour, compact composition) and the engagements empty state is a bespoke composition — no more oversized generic box used everywhere.

### Explicitly avoided
No neon, no particles, no matrix/hacker effects, no glassmorphism, no decorative charts, no fake metrics, no gradient utility classes (enforced by the existing design-system tests), no hero sections. All icons remain the existing consistent family.

---

## Files touched (presentation only)

| File | Scope |
|---|---|
| `src/styles.css` | tokens, layered background, 4-level surface system, refined utilities |
| `src/ui/primitives.tsx` | buttons, badges, headers, modal, stat, empty state, controls, progress |
| `src/app/AppShell.tsx` | brand, nav states, storage pill, footer |
| `src/features/engagements/EngagementsPage.tsx` | hero empty state, scannable cards |
| `src/features/engagements/EngagementLayout.tsx` | identity band, completion cluster, tabs |
| `src/features/dashboard/DashboardPage.tsx` | progress focal point, rank chips, hairline consistency |
| `src/features/workspace/*` | list rows, detail panel sections, toolbar/bulk-bar refinement |
| `src/features/engagements/NewEngagementPage.tsx` · `ApplicationTypeStep.tsx` · `ContextForm.tsx` | wizard, type cards, fact rows |
| `src/features/export/ExportPage.tsx` · `library/LibraryPage.tsx` | keylines, hairline consistency |

## Verification

- `npm test` — **20 files, 267 passed** (0 regressions; all journey, integrity, robustness, workflow, and smoke suites green)
- `npx tsc --noEmit` — exit 0
- `npm run build` — success (CSS 97.2 kB / gzip 32.0 kB; JS 646.5 kB / gzip 194.8 kB)
- Design-system contract tests — 20/20 (typography scale, tokens only, radii, no gradients, badge contract, vocabulary, a11y)

## Remaining

- No real-browser pixel review in-sandbox (browser unavailable); the live dev preview on port 3333 shows the result for manual inspection.
- Unused surface classes (`panel-flat`, `glow-brand`, …) remain defined in CSS for vocabulary completeness; harmless, tree-shaken weigh-in is negligible.