# ADR 0007 — Client-side Excel generation with write-excel-file

**Status:** Accepted

## Context

The Excel workbook is the deliverable. It must be produced entirely in the browser, must support
multiple sheets and cell styling (colour-coded priority and result cells, frozen header, column
widths), and must not bloat the initial page load.

Options considered:

| Library | Notes |
| --- | --- |
| `SheetJS` (xlsx) community build | Widely used, but styling is a pro feature and distribution moved off the public npm registry |
| `exceljs` | Full featured but large (~1 MB) and Node-oriented, with polyfill friction in browsers |
| `write-excel-file` | ~78 kB, browser-first, multi-sheet, per-cell styling, actively maintained |
| Hand-rolled CSV | No styling, no multiple sheets, formula-injection risk |

## Decision

Use **`write-excel-file` v4** (browser entry point), bundled with the application, and
**dynamically import** the export module so the writer is fetched only when the tester clicks
Export.

## Consequences

- Six styled sheets are produced locally with no server and no network request.
- The XLSX writer is a separate ~78 kB chunk, absent from the initial load.
- The v4 API (`writeXlsxFile(sheets).toFile(name)`, `textColor`, `columnSpan`) is pinned; a future
  major upgrade will require touching `src/export/excel.ts` only.
- Export composition lives in one module and consumes the same `ChecklistItem[]` as the dashboard,
  so the workbook cannot disagree with the screen.
