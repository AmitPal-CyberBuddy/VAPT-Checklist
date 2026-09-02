import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { safeExternalUrl, safeSpreadsheetText } from '../domain/untrusted';

/**
 * PRODUCTION AUDIT — §10 GitHub Pages compatibility and §11 security posture.
 *
 * The build output is checked as an artefact, not as an intention: whatever is
 * in `dist/` is what a client will load from a repository sub-path with no
 * server, no rewrite rules and possibly no internet access beyond the page.
 *
 * Run `npm run build` first; the deployment checks skip if `dist/` is absent.
 */

const ROOT = new URL('../../', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const built = existsSync(join(DIST, 'index.html'));

function distFiles(dir = DIST, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) distFiles(path, out);
    else out.push(path);
  }
  return out;
}

describe.skipIf(!built)('§10 GitHub Pages deployment artefact', () => {
  const html = built ? readFileSync(join(DIST, 'index.html'), 'utf8') : '';
  const assets = built
    ? distFiles().filter((f) => /\.(js|css)$/.test(f)).map((f) => ({ f, text: readFileSync(f, 'utf8') }))
    : [];

  it('references every asset relatively, so it works under /<repo>/', () => {
    const srcs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThan(0);
    const absolute = srcs.filter((s) => s.startsWith('/') || /^https?:\/\//.test(s));
    expect(absolute).toEqual([]);
    expect(srcs.some((s) => s.startsWith('./assets/'))).toBe(true);
  });

  it('ships every referenced asset', () => {
    for (const src of [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map((m) => m[1])) {
      expect(existsSync(join(DIST, src)), `missing ${src}`).toBe(true);
    }
  });

  it('includes .nojekyll so hashed asset directories survive Pages', () => {
    expect(existsSync(join(DIST, '.nojekyll'))).toBe(true);
  });

  it('carries no dev-server plumbing, and no localhost in our own code', () => {
    expect(html).not.toMatch(/@vite\/client|__vite_ping|\/@react-refresh/);
    for (const { f, text } of assets) {
      expect(text, `${f} contains a vite dev client`).not.toMatch(/@vite\/client|__vite_ping/);
    }
    // Library internals legitimately hold literals such as react-router's
    // `new URL('http://localhost')` base, so the check that matters is whether
    // OUR source names a dev host.
    const sources = distFiles(join(ROOT, 'src'))
      .filter(
        (f) =>
          /\.tsx?$/.test(f) &&
          !/\.test\./.test(f) &&
          !/audit/.test(f) &&
          // src/data is knowledge-base prose: testing guidance quotes payloads
          // such as `X-Forwarded-For: 127.0.0.1`, which is content, not config.
          !f.includes('/src/data/'),
      )
      .map((f) => ({ f, text: readFileSync(f, 'utf8') }));
    for (const { f, text } of sources) {
      expect(text, `${f} hardcodes a dev host`).not.toMatch(/localhost:\d+|127\.0\.0\.1/);
    }
  });

  it('issues no runtime request to a remote origin', () => {
    // What matters is executable network access, not URLs appearing in strings
    // (error messages, XML namespaces and documentation links are inert).
    expect(html.match(/(?:src|href)="https?:/g) ?? []).toEqual([]);
    for (const { f, text } of assets) {
      expect(text.match(/fetch\(\s*[`'"]https?:\/\//g) ?? [], `${f} fetches a remote URL`).toEqual([]);
      expect(text.match(/new Worker\(\s*[`'"]https?:/g) ?? [], `${f} loads a remote worker`).toEqual([]);
      expect(text.match(/importScripts\(/g) ?? [], `${f} uses importScripts`).toEqual([]);
      if (f.endsWith('.css')) {
        expect(text.match(/url\(\s*['"]?https?:/g) ?? [], `${f} loads a remote asset`).toEqual([]);
      }
    }
  });

  it('uses hash routing so deep links survive a refresh without rewrites', () => {
    const bundle = assets.map((a) => a.text).join('');
    expect(bundle).toMatch(/createHashRouter|HashRouter|hashchange/);
  });

  it('bundles the Excel writer locally, split out of the initial load', () => {
    const names = distFiles().map((f) => f.replace(DIST, ''));
    expect(names.some((n) => /excel.*\.js$/.test(n))).toBe(true);
    // The XLSX writer must not be in the entry chunk.
    const entry = assets.find((a) => /index-.*\.js$/.test(a.f))!;
    expect(entry.text).not.toMatch(/xl\/workbook\.xml/);
  });

  it('keeps the entry payload within a sane budget', () => {
    const entry = distFiles().find((f) => /index-.*\.js$/.test(f))!;
    const kb = readFileSync(entry).byteLength / 1024;
    expect(kb).toBeLessThan(900);
  });
});

describe('§11 untrusted input handling', () => {
  it('refuses to linkify a dangerous URL scheme', () => {
    for (const hostile of [
      'javascript:alert(document.domain)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)  ',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      expect(safeExternalUrl(hostile), hostile).toBeNull();
    }
  });

  it('accepts the URLs a tester actually types', () => {
    expect(safeExternalUrl('https://app.example.com/login')).toBe('https://app.example.com/login');
    expect(safeExternalUrl('http://10.0.0.5:8080')).toBe('http://10.0.0.5:8080/');
    // A bare host is assumed https rather than rejected.
    expect(safeExternalUrl('app.example.com')).toBe('https://app.example.com/');
    expect(safeExternalUrl('')).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });

  it('neutralises spreadsheet formula injection in tester-entered text', () => {
    // The product ships INJ-017 for exactly this; its own export must not be it.
    for (const payload of ['=1+1', '+1+1', '-1+1', '@SUM(A1)', '\t=1+1', '\r=1+1']) {
      expect(safeSpreadsheetText(payload).startsWith("'"), payload).toBe(true);
    }
    expect(safeSpreadsheetText('=HYPERLINK("http://evil","x")')).toBe(
      '\'=HYPERLINK("http://evil","x")',
    );
  });

  it('leaves ordinary notes untouched', () => {
    for (const ordinary of [
      'Reproduced on /api/v2/orders?id=1',
      'Payload: \' OR 1=1 --',
      '',
      'Not vulnerable — parameterised query confirmed',
    ]) {
      expect(safeSpreadsheetText(ordinary)).toBe(ordinary);
    }
  });
});
