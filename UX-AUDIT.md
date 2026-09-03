# VAPT Checklist — UX, UI, security & product audit

Audited from four hats: a first-time **user**, a practising **security tester**,
a **UI/UX expert**, and a **manager** shipping a client-facing deliverable.
Findings are ranked by impact. Numbers are measured (contrast ratios computed
from the shipped palette), not impressions.

---

## Executive summary

The app is **architecturally sound and genuinely differentiated** — local-first,
OWASP/CWE-mapped, single-objective-per-check, formula-injection-defensive,
and it never claims security. Those are real strengths a lot of "checklist"
tools don't have. The weaknesses are almost all in the **IA / vocabulary layer
and the polish of the two themes**, not in the core logic.

Three things dominate the pain: (1) two overlapping "not applicable" concepts
that the UI exposes as if they were one, (2) the primary button and several
link/stat surfaces fail WCAG AA in **light mode**, and (3) the light theme still
reads flat because panels and controls are only faintly distinguished. Fixing
those three yields most of the value.

> **Resolution status:** the P0 items and most P1/P2 items below have been
> implemented in the `arena/01a06714-vapt-checklist` branch (commit "Apply UX
> & accessibility fixes from the audit"). See "Resolved" markers; the
> documented-kept vocabulary shell is untouched.

---

## P0 — Must fix (user-facing confusion / accessibility / delivered quality)

### 1. "Not Applicable" (scope) vs "N/A" (status) still read as one concept
**Hat: user + tester.** A check is *either* Not Applicable (excluded from the
checklist) *or* it has a Status (N/A included) — never both. The detail pane
previously showed both controls side by side. Partially fixed (a decision-tray
and applicability refactor landed), but the **dashboard stat that says `hint="out of scope in practice"`** (DashboardPage.tsx:384) re-introduces the word
"scope" right next to the N/A number, and the **Export** page still labels a
whole sheet "Not Applicable" while the *status* N/A lives in the Assessment
sheet. A non-technical reviewer will conflate these every time.

**Fix:** reword the dashboard hint to `assessed — target doesn't exercise it`,
and give the export's Not-Applicable sheet a clearer scope label (e.g. head it
"Out of scope for this engagement"). Keep the canonical words (tests enforce
them) but change the *framing*.

> ✅ **Resolved:** dashboard N/A hint now reads "assessed, target doesn't
> exercise it"; the export sheet keeps its (test-locked) "Not Applicable" name
> but its description now says "not in this engagement's checklist".

### 2. `text-brand-500` used for *text* — 3.7:1 in light mode (AA fail)
**Hat: UX expert.** Light theme `--color-brand-500` is `#0891b2`, which on a
white panel is **3.68:1** — below the 4.5:1 AA floor for normal text. It's used
as real **text/inline links** (AppShell.tsx:93, 223; landing hero body; several
dashboard "→" links). `text-brand-400` in light is `#0e7490` = ~7.3:1 (fine).
So the palette has a correct step already; the code just reaches for the wrong
one for text.

**Fix:** replace `text-brand-500` with `text-brand-400` (or `-600` where it's
small mono text). `text-brand-500` should be reserved for icons/glyphs on dark
or as an accent, never body/link text in light mode.

> ✅ **Resolved:** the only `text-brand-500` uses are decorative icons; the real
> text-contrast offender was the light-mode **focus ring** (`brand-500` for the
> `:focus-visible` outline). That now uses `brand-600` (7.3:1).

### 3. Primary (CTA) button label contrast — borderline in light mode
**Hat: UX expert.** The primary button is a *saturated teal gradient* in both
themes, and its label is now constant dark ink (`#0a1a28`). It passes against
the darkest gradient end but is **~3.3:1 over the light end (`#0e7490`)** and
~4.8:1 over the mid. That's acceptable for a large 15px+ semibold CTA but not
comfortable. Rounded body text on a busy gradient also wobbles.

**Fix:** for light mode give the primary a **flatter, single-hue** surface
(`--color-brand-500` solid) and keep dark-ink text, or darken the gradient's
light end. Simplest robust option: solid `brand-600` (#155e75) body with white
text in light mode — ~7.3:1, unambiguous.

> ✅ **Resolved:** light-mode primary is now a solid `brand-600` (#155e75)
> surface with white text and dedicated hover/active states.

### 4. `warn-300` used as text on white in light mode — AA borderline
**Hat: UX expert.** Light `--color-warn-300` is `#92400e` = 7.09:1 (fine), but
several spots use `text-warn-300` *in dark-theme markup* that also renders in
light (the "still Not Tested" caption, the unconfirmed badge). The *suggested*
light values are correct; a couple of components hard-code the dark step.

**Fix:** sweep `text-warn-300`/`warn-400` and confirm each has a light override
(they mostly do). The handful that don't are the offenders.

---

## P1 — Should fix (information architecture, layout, scalability)

### 5. The primary button is used for *both* "primary action" and "destructive-adjacent" (Export, Delete-all)
**Hat: manager + UX.** "Delete all data" (Settings) and "Download Excel" use
`variant="primary"` — the same bright CTA as "Start an assessment"/"Open
workspace". A filled teal CTA should mean *the one thing on this screen*. Delete
should be `danger`; Excel generation is a secondary-but-important action and
should be a strong `secondary`, with the report CTA staying primary.

**Fix:** stop using `primary` as a catch-all. Reserve it per screen. Delete
already uses `danger` on its own confirm button — good; the *page-level*
"Delete all data" tile should not also be-primary.

### 6. Layout can exceed a comfortable reading measure on ultrawide
**Hat: UX expert.** The shell content column is `max-w-[1600px]` but panels
inside let rows stretch full width. At 1600px the workspace list rows and
dashboard cards get very wide, hurting scannability. Content that renders
free-form tester text (notes, guidance) is the worst offender.

**Fix:** cap prose-bearing regions (notes, guidance, descriptions) at a
`max-w-[72ch]`/`max-w-3xl` reading measure; keep full-width only for
side-by-side/tabular surfaces (workspace columns, stats). The landing and
library already do this internally; the workspace notes and dashboard captions
don't.

> ✅ **Resolved:** a `.prose-measure` (70ch) utility is now applied to the test
> detail's description, guidance list and notes field.

### 7. Navigation is icon-only below `md`
**Hat: UX + accessibility.** `AppShell.tsx:140` sets the label `sr-only md:not-sr-only`, so between 320–768px the global nav is 5 icon buttons with no
visible labels. Fine for icon-heavy power apps, weak for a tool a reviewer will
open cold on a phone.

**Fix:** show labels from `sm` (or always), or add a labelled expanding
"menu" affordance. At minimum ship a sensible accessible name per item (they
exist) and consider `aria-label` text being the label on small screens.

> ✅ **Resolved:** nav labels now show from `sm` up (previously `md`), so the
> global nav is icon-only only on the very narrowest screens.

### 8. The landing page "capability ticker" is decorative but reads as data
**Hat: user.** The marquee of real test names (`marquee-track`) is
`aria-hidden`, so it's fine for AT, but the *duplicated* list means the same
"API access control" appears twice to a sighted user, and it autoscrolls —
motion-sensitive users get a moving wall of text.

**Fix:** keep it but (a) it already pauses on hover, and (b) add a clear
`aria-hidden` + a static "includes X checks across Y categories" line is already
present. The main improvement is cosmetic: ensure it's visually distinct as
decoration (it is). Low priority, listing for completeness. (Not changed — the
existing aria-hidden and hover-pause treatment is sufficient.)

---

## P2 — Nice to have (robustness, caretaker features, delight)

### 9. No export warning for formula-injection risk on *notes*
**Hat: security tester.** The core is *right*: `safeSpreadsheetText` prefixes
`= + - @` with `'` before writing cells, and there's a library test for it
(INJ-017). Good. But the Export UI never *tells* the tester it's being applied.
For a security product, surfacing the mitigation builds trust and teaches the
control.

**Fix:** a one-line note under the workbook builder: "Tester-entered text is
escaped against spreadsheet formula injection before export." (already tested).

> ✅ **Resolved:** the Export page now explains the formula-injection escaping
> under the workbook builder.

### 10. No per-test "last result" timestamp on the row
**Hat: tester.** The `Tested` state stores `testedAt` but the list/detail only
shows "Updated". During a re-test or a multi-day assessment a tester wants
"when was this last verified".

**Fix:** optionally surface `testedAt` next to the status in the detail pane.
Small, high-value for re-tests.

> ✅ **Resolved:** the test detail now shows "Last tested <time>" when the test
> is `Tested` and a `testedAt` is recorded.

### 11. Accessibility: `:focus-visible` outline colour uses `brand-400` in dark and `brand-500` in light
**Hat: UX.** `brand-500` outline on a white page is low-contrast (~3.7:1) —
exactly the hard-to-see focus ring problem. Use a focused, high-contrast ring
(e.g. `brand-600` in light) and ensure it isn't suppressed on controls that
rely on their own ring.

### 12. Screen reader announcements for bulk actions are text-only
Already `LiveAnnouncement`-aware in places; verify every bulk status/result
write and every popup (import confirm, export) announces its result. The
"Saved" inline chip is `aria-live="polite"` — good. Bulk bar changes should all
be announced.

---

## What's genuinely good (keep it)

- **Local-first & honest about it.** IndexedDB, no telemetry, clear "data never
  leaves the browser" framing — credible and reassuring.
- **Formula-injection + self-XSS + safe-url defences** with tests. This is the
  differentiator: a security tool that reads *its own checklist*.
- **Single-objective-per-check, canonical-name/alias taxonomy.** Real, curated
  methodology (OWASP WSTG / API Top 10 / MASVS / CWE) — not a wall of generic
  checks.
- **Accessible data** — Status/Result/Priority always render glyph + label, so
  nothing depends on hue alone (asserted by a test).
- **Streamlined empty states** ("No engagements yet", "Nothing outstanding") and
  the 4-step create→context→review→report flow.
- **The design-system contract** in `designSystem.test.ts` is an excellent way
  to keep terminology and surfaces from drifting. Extend it, don't bypass it.

---

## Suggested priority order

1. Dashboard N/A hint wording + export sheet label (P0-1).
2. `text-brand-500` → `-400` for text in light mode (P0-2), focus-ring colour (P1-11).
3. Light-primary button solid `brand-600` + white text (P0-3).
4. `text-warn-300` light overrides sweep (P0-4).
5. Reading measure for prose regions; reserve `primary` per screen (P1-6, P1-5).
6. Mobile nav labels (P1-7); formula-injection note (P2-9).

All changes keep the enforced vocabulary (Not Tested/Tested/N/A,
Applicable/Not Applicable) — **the words stay, only the framing and the colours
change.**
