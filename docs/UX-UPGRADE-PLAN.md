# UX upgrade plan — navigation, motion, visual quality

Owner-requested experience pass, executed phase by phase. The design language
([ADR 0015](adr/0015-design-language.md), [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md))
is the constraint set, not the target: two radii, semantic tokens only, the
120/160/240 ms motion scale, glyph + label with every colour, nothing below
11 px, and `prefers-reduced-motion` disabling all of it. Both contract suites
(`designSystem.test.ts`, `contrast.test.ts`) must stay green after every phase.

## Phase 0 — Plan
- [x] This document; recon of shell, motion utilities, dashboard, landing
      (recon found several planned items already shipped by earlier passes —
      progress ring, landing sample panel, skeleton sheen, light aurora.
      Those became refinements below instead of rebuilds)

## Phase 1 — Navigation & wayfinding
- [x] Rail engagement switcher: recent engagements (name + type), one click
      between clients without going via the list
- [x] Keyboard-shortcuts help dialog (`?` anywhere + a rail button) — the
      workspace loop is powerful but undiscoverable below 1280 px
- [x] Scroll restoration on Back/Forward (lists, library) via location key
- [x] Animated active-tab indicator in the engagement tab bar

## Phase 2 — Motion system in practice
- [x] Test-detail identity crossfade when moving between tests (the body
      already crossfades; the name/priority header hard-swaps)
- [x] Scroll-reveal coverage on the screens that lack it (Application
      Context, Export) and stagger on the application-type cards
- [x] ~~Skeleton shimmer~~ — already shipped (`.skeleton-sheen`)
- [x] ~~Progress-bar transitions~~ — already shipped (500 ms + sheen)

## Phase 3 — Dashboard visual anchor
- [x] ~~Progress ring~~ — already shipped (SVG gauge + count-up)
- [x] Ring centre microcopy: "done" → the canonical "completed"
- [x] Composition bar: Vulnerable / Not Vulnerable / N/A / Not Tested as
      one stacked strip with a glyph legend — same numbers, faster read

## Phase 4 — Landing & atmosphere
- [x] Sample-checks panel shows a *lived-in* checklist (Tested → Vulnerable,
      Not Vulnerable, N/A, Not Tested) instead of every row untouched —
      the panel and real badges already exist
- [x] Light canvas: add the 28 px technical grid the dark canvas has
      (the aurora lights were already retuned for paper)

## Phase 5 — Micro-interactions & finish
- [x] Click-to-copy test ID in the detail panel (report/Burp workflow)
- [x] `text-wrap: pretty` on long guidance prose. (Hover keyline dropped on recon: engagement
      rows are divider-separated list rows with hover background + name-link colour shift —
      per-card keylines don't apply to that pattern.)
- [x] Docs: design-system notes, review addendum, this checklist completed
- [x] Full gates: typecheck · lint · verify · bundle check · preview
