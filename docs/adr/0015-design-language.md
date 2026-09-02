# ADR 0015 — One design language, enforced by the components

**Status:** Accepted

## Context

The application was built feature by feature: engagements, then the library, then the workspace,
then persistence and export. Each part worked, but an audit across the whole product found the drift
that always follows that order:

- **Vocabulary.** The same concept appeared as *resolved* / *completed*, *excluded* / *not
  applicable*, *findings* / *vulnerable tests*, *checklist* / *workspace*.
- **Colour as the only signal.** The workspace list encoded status as a coloured dot with no label —
  invisible to a colour-blind tester, to greyscale print, and to a screen reader.
- **Contrast.** 62 uses of text tokens (`ink-500`, `ink-600`, `ink-700`) that failed WCAG AA on the
  app background; `ink-600` sat around 2:1.
- **Inconsistent surfaces.** Four radii, ad-hoc panel opacities (`bg-ink-900/30`, `/40`, `/60`,
  `/70`), and raw palette colours (`rose`, `emerald`, `sky`) alongside semantic ones.
- **Filter overflow.** Eight fixed-width dropdowns in one row: fine at 1600px, broken at 1024px.
- **Thin states.** Loading was the word "Loading…" in a card; several empty states were generic.

Style guidance in a document does not prevent any of this. Only the components can.

## Decision

**Put the rules in the primitives, not in a style guide.**

1. **Status vocabulary is a component.** `StatusBadge`, `ResultBadge` and `PriorityBadge` are the
   only way to render those states. A screen cannot write "Pending" or pick its own red, because it
   never handles the string or the colour.
2. **Never colour alone.** Those badges each render a glyph (`○ ● ⊘ ▲ ✓`, `▰▰▰`…) *and* the label.
   Glyphs are `aria-hidden`, so the accessible name stays the plain canonical word — asserted by a
   unit test.
3. **Two radii, three surfaces, one text ramp.** `--radius-control` / `--radius-panel`, `ink-950 /
   900 / 850`, and a text ramp whose faintest tone still clears 4.5:1. Line tokens are never used
   for text. The old opacity-based surfaces and raw palette colours were swept out.
4. **Accessible names are mandatory in the type system.** `IconButton` requires `label`,
   `SegmentedControl` requires `label`, `FilterSelect` requires `label`. Forgetting one is a
   compile error rather than an audit finding.
5. **Reflow, don't shrink.** The workspace is two panes at `lg` and a list → detail → back flow
   below it (`useIsWide`), and the filter row is a disclosure with an active-filter count instead of
   a row of dropdowns.
6. **Lists for repeated data.** The workspace is a dense `<ul>`, not a grid of cards. Cards group
   sections; they never nest inside each other.
7. **Every state is a component.** `EmptyState`, `InlineAlert` and `LoadingPanel` cover empty,
   informational/error and loading states, so no screen improvises one.

The full language is written up in [`docs/DESIGN-SYSTEM.md`](../DESIGN-SYSTEM.md).

## Consequences

- Screens look and behave like one product because they share the same small set of parts.
- Terminology cannot drift: the words live in the components and in the domain types.
- Accessibility regressions are caught at compile time (missing labels) or by tests (accessible
  names, landmarks, non-colour indicators, the narrow-viewport flow).
- Contrast is a property of the palette, so it holds everywhere rather than needing per-screen care.
- Cost: primitives are stricter to use — an icon button without a label will not compile, and a
  screen cannot quickly hand-roll a one-off badge. That friction is the point.
- The dashboard lost its "Progress by priority" card in this pass; priority is already carried by
  the statistics row and the vulnerable-tests summary, and the card was decoration rather than a
  decision aid.
