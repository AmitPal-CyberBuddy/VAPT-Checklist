/**
 * XLSX post-processing — autofilter injection
 * ---------------------------------------------------------------------------
 * `write-excel-file` covers styling, column widths and frozen panes but has no
 * API for autofilter, and a delivered assessment workbook really wants filter
 * dropdowns on the data sheets.
 *
 * An .xlsx file is a zip of XML parts, so the filter is added by unzipping the
 * generated blob, inserting `<autoFilter ref="A1:O185"/>` after `</sheetData>`
 * in the relevant worksheet parts, and zipping it back up. `fflate` is already
 * in the bundle (write-excel-file depends on it), so this costs nothing extra.
 *
 * Everything is best-effort: any failure returns the original workbook, which
 * is valid and complete — just without filter dropdowns.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/** Earliest timestamp representable in a zip entry. */
const ZIP_EPOCH = new Date(Date.UTC(1980, 0, 1));

export interface FilterTarget {
  /** Worksheet name as passed to write-excel-file. */
  sheet: string;
  /** Number of columns in the header row. */
  columns: number;
  /** Total row count including the header. */
  rows: number;
}

/** 1 → A, 26 → Z, 27 → AA … */
export function columnLetter(index: number): string {
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || 'A';
}

export function filterRef(columns: number, rows: number): string {
  return `A1:${columnLetter(Math.max(1, columns))}${Math.max(1, rows)}`;
}

/** Maps worksheet display names to their part path inside the archive. */
function mapSheetFiles(files: Record<string, Uint8Array>): Map<string, string> {
  const map = new Map<string, string>();
  const workbook = files['xl/workbook.xml'];
  const rels = files['xl/_rels/workbook.xml.rels'];
  if (!workbook || !rels) return map;

  const relTargets = new Map<string, string>();
  for (const match of strFromU8(rels).matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relTargets.set(match[1], match[2].replace(/^\/?xl\//, ''));
  }

  // Attribute order is not guaranteed (write-excel-file emits r:id first), so
  // each <sheet/> tag is matched whole and its attributes read individually.
  for (const tag of strFromU8(workbook).matchAll(/<sheet\b[^>]*\/>/g)) {
    const name = /\bname="([^"]*)"/.exec(tag[0])?.[1];
    const rid = /\br:id="([^"]*)"/.exec(tag[0])?.[1];
    if (!name || !rid) continue;
    const target = relTargets.get(rid);
    if (target) map.set(decodeXml(name), `xl/${target}`);
  }
  return map;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Inserts an `<autoFilter>` element into each named worksheet.
 * Per the SpreadsheetML schema autoFilter comes after `sheetData`, so it is
 * spliced immediately after the closing tag.
 */
export function injectAutoFilters(
  files: Record<string, Uint8Array>,
  targets: FilterTarget[],
): Record<string, Uint8Array> {
  const sheetFiles = mapSheetFiles(files);
  const out = { ...files };

  for (const target of targets) {
    const path = sheetFiles.get(target.sheet);
    if (!path || !out[path]) continue;
    const xml = strFromU8(out[path]);
    if (xml.includes('<autoFilter')) continue;
    // sheetData may be closed normally or self-closed when the sheet is empty.
    const marker = xml.includes('</sheetData>') ? '</sheetData>' : '<sheetData/>';
    const at = xml.indexOf(marker);
    if (at === -1) continue;
    const insertion = `<autoFilter ref="${filterRef(target.columns, target.rows)}"/>`;
    out[path] = strToU8(
      xml.slice(0, at + marker.length) + insertion + xml.slice(at + marker.length),
    );
  }
  return out;
}

export async function withAutoFilters(blob: Blob, targets: FilterTarget[]): Promise<Blob> {
  if (targets.length === 0) return blob;
  try {
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const patched = injectAutoFilters(files, targets);
    // Fixed timestamp keeps output deterministic. (fflate only accepts dates
    // in the zip-representable 1980–2099 range, so epoch 0 is not an option.)
    const zipped = zipSync(patched, { mtime: ZIP_EPOCH });
    return new Blob([zipped as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  } catch {
    return blob;
  }
}
