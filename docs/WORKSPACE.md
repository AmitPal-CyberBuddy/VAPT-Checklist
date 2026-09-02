# Testing Workspace

The screen a tester lives in during an assessment. Everything here is judged against one loop:

```text
read guidance → test the application → record status → record result → note → next test
```

---

## The loop, measured

| Action | Cost |
| --- | --- |
| Mark a test **N/A** | **1 interaction**, from the list, without opening it |
| Record **Tested → Vulnerable** | **2 interactions**, written as one atomic change |
| Move to the next outstanding test | **1 key** (`⏎`) |
| Reverse any decision | Same control, same place |

Status and result are on every row, so a checklist can be worked top to bottom without opening a
single test. Opening one is for reading the guidance, not for recording the outcome.

### Keyboard

| Key | Action |
| --- | --- |
| `j` / `k` (or ↑ / ↓) | Previous / next test |
| `1` `2` `3` | Not Tested · Tested · N/A |
| `v` / `b` | Vulnerable · Not Vulnerable |
| `e` | Jump to notes |
| `⏎` | Next test still Not Tested |
| `/` | Focus search |

The list is a **single tab stop** — arrow keys walk the rows, so Tab does not trap you in ~150
buttons — and the active test is announced through a live region.

---

## The three axes stay separate

**Applicability** (should I test this?) · **Status** (have I?) · **Result** (what did I find?)

They are never merged into one control or one colour. Every row states each in words with a shape
glyph, so the distinction survives colour blindness, greyscale and a screen reader:

```text
SQL Injection
● Tested   ▲ Vulnerable
▰▰▰ Critical   INJ-001   Input Validation & Injection
```

`Tested` is **never stored without a result** — the store refuses it. Choosing Tested reveals the
result buttons with an amber ring and writes nothing until you choose. `N/A` records immediately and
asks for nothing.

---

## Finding the right test

Search covers vulnerability name, aliases, test ID, category, subcategory, tags, standards codes,
description, guidance and your own notes. Common terminology finds the canonical entry: **`IDOR`
→ IDOR / Broken Object Level Authorization (BOLA)**.

Filters are deliberately few — status, result, priority, category, applicability, subcategory —
behind a disclosure that shows how many are active. **Options are drawn from the engagement**: a web
engagement is not offered a Mobile Application filter that can only ever return nothing.

## High-value work

The dashboard's ranking is available in the workspace as a sort mode, and the top ten outstanding
tests carry a **★ High value** badge wherever they appear. Ranking combines priority, how strongly
the recorded context points at the test, category exploitability, whether that category already
produced a finding, and whether you pulled the test into scope yourself.

## Completion

When every applicable test has a status:

> **Checklist completed** — all N applicable tests have a recorded status: X tested, Y marked N/A,
> Z vulnerable. *This records what was assessed; it is not a statement that the application is
> secure.*

The wording is deliberate, and a test asserts the application never says "secure" or "no
vulnerabilities found".

---

## Performance

Measured with 155 rows in the list (jsdom, so treat these as relative figures):

| Change | Before | After |
| --- | --- | --- |
| Row renders per status change | **155** | **2** |
| Row renders per keystroke that does not change results | 0 | 0 |
| Keystroke cost | 22.5 ms | 18.1 ms |

The cause was not the filter: every write re-runs the Dexie live query, which rebuilds every
`ChecklistItem`, so a default `memo` compared new object identities and re-rendered the whole list.
The row is now memoised on **the fields it actually draws**.

Two things were tried and rejected on the evidence:

- **`useDeferredValue` on the search query** — measurably *slower* here (29.6 ms per keystroke), an
  extra render pass with no idle time to exploit. Reverted rather than kept on the theory that it
  helps perceived responsiveness, which the measurement could not show.
- **Virtualising the list** — 155 rows do not justify it, and windowing would fight the roving
  tabindex, the scroll-into-view behaviour and the single-tab-stop guarantee. Revisit if the library
  passes a few hundred applicable tests.

Both figures are pinned by regression tests.

---

## Deliberate deviations

- **Notes sit directly below Testing Guidance**, ahead of Applicability and References, rather than
  last. A tester writes the note while the guidance is still on screen; making them scroll past
  reference material to reach the field would be worse.
- **Status and result live in a sticky header** in the detail pane rather than in the body flow, so
  they are reachable without scrolling past long guidance.
