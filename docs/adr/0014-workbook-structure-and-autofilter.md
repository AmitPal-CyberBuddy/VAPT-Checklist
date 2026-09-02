# ADR 0014 — Workbook structure and autofilter post-processing

**Status:** Accepted (refines [ADR 0007](0007-client-side-excel-generation.md))

## Context

The Excel workbook is the client-facing deliverable, so its structure is part of the product, not an
implementation detail. Three sheets carry the assessment:

| Sheet | Answers |
| --- | --- |
| Engagement Summary | What was assessed, when, and where does it stand? |
| Assessment | What was tested, and what happened? |
| Vulnerable Tests | What did you find? |

Two smaller sheets — *Not Applicable* (the audit trail for scope decisions) and *Coverage* — are
useful but not universal, so they are toggleable.

For readability the sheets need frozen headers, sensible column widths and **filter dropdowns**.
`write-excel-file` supports the first two (`stickyRowsCount`, `stickyColumnsCount`, `columns`) but
has no API for autofilter, and an assessment sheet with ~170 rows without filters is noticeably
worse to work with.

## Decision

**Structure.** `planWorkbook()` returns a plain description of the sheets — name, data, column
widths, whether the sheet is tabular — which is what the unit tests assert against. The Application
Context is a block on *Engagement Summary* rather than a separate sheet, so nothing is duplicated.
The Assessment sheet leads with the eight columns the product promises (Test ID, Vulnerability Name,
Category, Subcategory, Priority, Status, Result, Notes) and carries description, guidance, aliases,
applicability reasoning and standards mapping after them.

**Autofilter by post-processing.** An `.xlsx` is a zip of XML parts. After
`writeXlsxFile(...).toBlob()`, `withAutoFilters()` unzips the blob, resolves worksheet names to
their parts via `xl/workbook.xml` + its rels, splices `<autoFilter ref="A1:O167"/>` in after
`</sheetData>` (the position the SpreadsheetML schema requires), and rezips. `fflate` does the work
— it is already in the bundle as a dependency of `write-excel-file`, so the cost is a direct
dependency declaration and roughly 2 kB of code.

The whole step is best-effort: any failure returns the original blob, which is a valid, complete
workbook without filter dropdowns.

## Consequences

- Delivered sheets open with frozen headers, frozen ID/name columns, filter dropdowns and tuned
  widths — a spreadsheet a client can actually work in.
- The structure is unit-tested through `planWorkbook()` without needing a browser, and the XML
  splice is tested against the exact tag shape `write-excel-file` emits (attribute order included —
  it writes `r:id` before `name`, which the first implementation of the parser got wrong).
- Rezipping costs one extra pass over a ~60 kB archive; imperceptible.
- Risk: the injection depends on `write-excel-file`'s output containing a `sheetData` element. If a
  future version changes that, filters silently disappear rather than the export breaking — and the
  unit tests catch the shape change.
