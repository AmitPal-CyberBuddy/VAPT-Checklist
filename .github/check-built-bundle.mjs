/**
 * Fail the Pages build if the bundle we're about to publish would render as a
 * blank page.
 *
 * Two ways a Vite app can silently publish "nothing":
 *   1. The built index.html still points at the RAW SOURCE entry
 *      (`/src/main.tsx`) instead of the compiled, hashed assets. That happens
 *      when Pages source is set to "Deploy from a branch" and serves the repo
 *      root — browsers can't execute a `.tsx` import, so #root stays empty.
 *   2. The compiled JS/CSS assets aren't actually present next to index.html.
 *
 * We assert the opposite: dist/index.html must reference a hashed `./assets/*`
 * module script, must NOT reference the `/src/*` source entry, and the assets
 * must exist on disk. If Pages is later reconfigured to "Deploy from a branch",
 * this fails loudly in CI instead of shipping a blank site.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(ROOT, 'dist');
const indexPath = resolve(dist, 'index.html');

const problems = [];

if (!existsSync(indexPath)) {
  problems.push('dist/index.html is missing — did the build run?');
} else {
  const html = readFileSync(indexPath, 'utf8');

  const scriptSrcs = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(
    (m) => m[1],
  );
  const styleHrefs = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(
    (m) => m[1],
  );

  // Raw source entry: a Vite source is imported as /src/main.tsx (or similar).
  // The built bundle never references it.
  if (/\/src\/main\.[jt]sx?/.test(html)) {
    problems.push(
      'dist/index.html references the raw Vite source entry (/src/main.tsx). ' +
        'This packages source, not the compiled app, and renders a blank page. ' +
        'Check the Pages source is "GitHub Actions", and that `base: "./"` is intact.',
    );
  }

  const compiledScript = scriptSrcs.find((s) => /\.\/assets\/.*\.(js|mjs)$/.test(s));
  const compiledStyle = styleHrefs.find((s) => /\.\/assets\/.*\.(css|css)$/.test(s));
  if (!compiledScript) {
    problems.push(
      'dist/index.html has no hashed ./assets/*.js module script — the compiled bundle is ' +
        'not being linked. Attempting to publish would serve a blank page.',
    );
  }
  if (!compiledStyle) {
    problems.push(
      'dist/index.html has no hashed ./assets/*.css stylesheet.',
    );
  }

  // The production Content-Security-Policy must be present, self-only, and
  // actually pin the inline scripts in the document (vite.config.ts computes
  // the hashes at build time; this proves they match what ships).
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1];
  if (!csp) {
    problems.push('dist/index.html has no Content-Security-Policy meta — the build-time CSP plugin did not run.');
  } else {
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    if (!csp.includes("default-src 'self'") || !csp.includes("object-src 'none'")) {
      problems.push(`CSP is weaker than intended (needs default-src 'self' and object-src 'none'): ${csp}`);
    }
    if (scriptSrc.includes("'unsafe-inline'") || /https?:/.test(scriptSrc)) {
      problems.push(`CSP script-src must not allow inline or remote scripts: ${scriptSrc.trim()}`);
    }
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      const hash = `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`;
      if (!scriptSrc.includes(hash)) {
        problems.push(`An inline script in dist/index.html is not hash-pinned by the CSP (${hash}) — it would be blocked in production.`);
      }
    }
    if (html.indexOf('Content-Security-Policy') > html.indexOf('<script')) {
      problems.push('The CSP meta appears after the first <script> — a meta policy only governs what follows it.');
    }
  }

  // Every referenced asset must actually exist on disk, so GitHub Pages can't
  // 404 the JS/CSS and leave #root empty.
  for (const src of [...scriptSrcs, ...styleHrefs]) {
    if (!src.startsWith('./')) continue;
    const assetPath = resolve(dist, src);
    if (!existsSync(assetPath)) {
      problems.push(`Referenced asset missing from dist: ${src}`);
    }
  }
}

if (problems.length > 0) {
  console.error('\n❌ Build verification failed — refusing to publish a blank page.\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  '✅ Build verification: compiled bundle linked (' +
    'script + stylesheet present, no raw source entry, all assets exist).',
);
