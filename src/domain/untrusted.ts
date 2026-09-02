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

/** Characters a spreadsheet may treat as the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Neutralises formula injection in a spreadsheet cell by prefixing the value
 * with an apostrophe — the standard mitigation. Applied only to fields the
 * tester controls; text from the bundled library is left untouched so the
 * deliverable's prose stays exact.
 */
export function safeSpreadsheetText(value: string | undefined | null): string {
  const text = value ?? '';
  return FORMULA_START.test(text) ? `'${text}` : text;
}
