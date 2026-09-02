# Design System

One visual language across every screen. Anything not described here should not exist in the UI.

Implementation: [`src/ui/primitives.tsx`](../src/ui/primitives.tsx) (components) and
[`src/styles.css`](../src/styles.css) (tokens).

---

## 1. Tokens

| Scale | Values | Used for |
| --- | --- | --- |
| **Surface** | `ink-950` app · `ink-900` panel · `ink-850` inset | Three levels, no more |
| **Text** | `ink-50/100` primary · `ink-300` secondary · `ink-400` tertiary · `ink-500` faintest | `ink-500` is the lightest tone allowed for text |
| **Line** | `ink-700` panel border · `ink-600` control border | Never used for text |
| **Radius** | `--radius-control` 0.5rem · `--radius-panel` 0.75rem | Two radii only |
| **Accent** | `brand-500` action · `vuln-500` vulnerable · `safe-500` not vulnerable | Semantic, never decorative |

The background is a flat colour. There are no gradients, no hero sections, no decorative
illustrations and no shadows beyond what a border already conveys. Motion is limited to a 140 ms
fade on newly mounted content and is disabled entirely under `prefers-reduced-motion`.

---

## 2. One vocabulary

The same concept uses the same word in the UI, the export and this documentation.

| Concept | Canonical terms | Never |
| --- | --- | --- |
| Status | **Not Tested · Tested · N/A** | Pending, Untested, Incomplete, Done |
| Result | **Vulnerable · Not Vulnerable** | Found, Failed, Issue, Pass, Clean |
| Applicability | **Applicable · Not Applicable** | In scope, Excluded, Skipped |
| Applicable but unproven context | **Unconfirmed** | Uncertain, Maybe, Assumed |
| Progress | **Completed** = Tested + N/A | Resolved, Finished, Closed |
| Main working screen | **Testing Workspace** | Checklist, Test list, Grid |
| Vulnerable tests, collectively | **Vulnerable tests** | Findings, Issues, Bugs |

Status, result and priority are rendered exclusively by `StatusBadge`, `ResultBadge` and
`PriorityBadge`, so a screen physically cannot invent a synonym or a different colour.

---

## 3. Never colour alone

Every state carries a **glyph and a word** as well as a hue, so it survives colour blindness,
greyscale printing and screen readers.

| State | Glyph | Label |
| --- | --- | --- |
| Not Tested | `○` | Not Tested |
| Tested | `●` | Tested |
| N/A | `⊘` | N/A |
| Vulnerable | `▲` | Vulnerable |
| Not Vulnerable | `✓` | Not Vulnerable |
| Critical → Low | `▰▰▰` → `▱▱▱` | Critical / High / Medium / Low |

Glyphs are `aria-hidden`; the accessible name is always the plain label, which a unit test asserts.

---

## 4. Information hierarchy

Every test-bearing surface orders information the same way:

```text
1  Vulnerability name      largest, highest contrast
2  Status                  labelled badge
3  Result                  labelled badge
4  Priority                badge with shape
5  Testing guidance        body text (detail view)
6  Notes                   editable field (detail view)
7  Supporting metadata     ID, category, subcategory, references — smallest, tertiary colour
```

A tester should be able to answer *what am I testing, what is its priority, have I tested it, what
was the result* from a single glance at any row.

---

## 5. Components

| Component | Rule |
| --- | --- |
| `Button` | 5 variants, 3 sizes. Icon-only buttons must use `IconButton`, whose `label` is mandatory |
| `Badge` | 11 semantic tones, optional decorative glyph |
| `Card` / `panel` | One border, one radius, no shadow. Cards group; they do not nest |
| `PageHeader` | Every top-level screen starts with one — title, description, actions |
| `SectionHeading` | Every card section — title, optional description, optional actions |
| `Field` | Wraps its control in a `<label>`; marks required fields for sighted and screen-reader users |
| `FilterSelect` | A `<select>` whose visible label would cost too much room; `label` is mandatory |
| `SegmentedControl` | `role="radiogroup"` with a mandatory group `label` |
| `EmptyState` / `InlineAlert` / `LoadingPanel` | The only ways to render empty, informational and loading states |

**Lists, not cards, for repeated data.** The workspace list is a dense `<ul>`: at ~170 rows every
pixel of card chrome is a pixel not spent on the vulnerability name.

---

## 6. Responsive behaviour

Content reflows; it is not shrunk.

| Width | Behaviour |
| --- | --- |
| **≥1280px** | Workspace two panes; 6-across statistics; keyboard hint bar visible |
| **1024–1279px** | Workspace two panes; statistics wrap to 3 across |
| **768–1023px** | Workspace becomes list → detail → back; statistics 3 across; nav labels persist |
| **<768px** | Nav collapses to icons (labels remain for screen readers); statistics 2 across; filters stay behind the Filters disclosure; detail sections stack |

The workspace filter row is a **disclosure**, not a wall of dropdowns: search and sort are always
visible, the six filters open on demand and show an active count. This is what keeps the toolbar
from overflowing on a tablet.

Wide tables (the engagement wizard's preview) scroll horizontally inside their own container with a
minimum width, so the page itself never overflows.

---

## 7. Accessibility commitments

- **Landmarks**: `banner`, `navigation` (named), `main`, `contentinfo`, plus a skip link.
- **Keyboard**: every action reachable; the workspace loop is fully keyboard-driven
  (`j`/`k`, `1`/`2`/`3`, `v`/`b`, `e`, `⏎`, `/`); modals close on `Escape` and restore focus.
- **Focus**: one visible treatment (`2px` brand outline, `2px` offset) on every focusable element.
- **Names**: icon-only controls, filter selects, progress bars and radio groups all carry explicit
  accessible names.
- **Contrast**: the lightest text token clears WCAG AA (4.5:1) on both the app and panel surfaces.
  Line colours are never used for text.
- **Live regions**: toasts announce politely; the result count updates via `aria-live`.
- **Motion**: fully disabled under `prefers-reduced-motion`.

---

## 8. Every state is designed

| State | Where |
| --- | --- |
| No engagements | Engagements list — explains what an engagement is and offers the create action |
| No search results | Engagements, workspace, library — quotes the query, says what search covers, offers a reset |
| No applicable tests | Workspace — suggests widening the applicability filter |
| Nothing outstanding | Dashboard high-value section |
| No vulnerable tests | Dashboard — explains what makes a test appear there |
| Engagement not found | Engagement layout — explains local-only storage and points to import |
| Storage unavailable | App shell banner — names the likely cause and the fix |
| Export failed | Export screen — keeps the message, offers retry, points at JSON backup |
| Backup rejected | Import dialog — lists the specific problems, confirms nothing was written |
| Loading | `LoadingPanel` skeletons matching the shape of the content that follows |
