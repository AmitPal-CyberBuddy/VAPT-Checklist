/**
 * Untrusted-input handling.
 *
 * Everything a tester types — engagement name, application URL, notes — is
 * untrusted as far as this application is concerned. React escapes it on
 * render, but two sinks bypass that protection:
 *
 *   1. `href` on the application URL. A `javascript:` or `data:` URL there is
 *      stored self-XSS, and it survives a JSON backup so it can travel between
 *      testers.
 *   2. Spreadsheet cells. A note beginning with `=`, `+`, `-` or `@` is a
 *      formula the moment the workbook is converted to CSV — the exact issue
 *      this product ships a test for (INJ-017, CSV / Formula Injection).
 *
 * Shipping a security tool with either would be indefensible.
 */

const SAFE_URL_SCHEMES = new Set(['http:', 'https:']);

/**
 * Returns the URL only if it is safe to place in an `href`, otherwise null.
 * Callers render the raw string as plain text when this returns null, so the
 * tester still sees what they typed.
 */
export function safeExternalUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  try {
    // A bare host ("app.example.com") is a legitimate thing to type.
    const url = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`);
    return SAFE_URL_SCHEMES.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Length ceilings for stored text.
 *
 * Not arbitrary: an engagement lives in IndexedDB alongside ~184 test states,
 * and unbounded text is how a local-first application exhausts its quota and
 * loses an assessment. The notes ceiling also keeps every cell inside Excel's
 * hard 32,767-character limit, below which a workbook is silently truncated or
 * rejected.
 */
export const TEXT_LIMITS = {
  engagementName: 200,
  applicationUrl: 2048,
  clientName: 120,
  testerName: 120,
  scopeEntry: 300,
  description: 5_000,
  notes: 20_000,
} as const;

/** Excel refuses to open a workbook with a longer cell than this. */
export const EXCEL_CELL_LIMIT = 32_767;

/** Trims and caps a stored string. Returns '' for anything that is not a string. */
export function clampText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

/** Characters a spreadsheet may treat as the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Neutralises formula injection in a spreadsheet cell by prefixing the value
 * with an apostrophe — the standard mitigation. Applied only to fields the
 * tester controls; text from the bundled library is left untouched so the
 * deliverable's prose stays exact.
 */
export function safeSpreadsheetText(value: string | undefined | null): string {
  let text = typeof value === 'string' ? value : '';
  if (FORMULA_START.test(text)) text = `'${text}`;
  if (text.length > EXCEL_CELL_LIMIT) {
    // Truncating visibly beats handing the client a workbook Excel will not open.
    const marker = ' […truncated]';
    text = text.slice(0, EXCEL_CELL_LIMIT - marker.length) + marker;
  }
  return text;
}
