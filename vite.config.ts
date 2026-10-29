import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Content-Security-Policy for the production artefact.
 *
 * GitHub Pages cannot send headers, so the policy ships as a <meta> tag.
 * It is injected at build time only: the dev server (HMR websockets, inline
 * dev client) must not be governed by it. The app loads nothing remote —
 * no CDN, no analytics, no fetch at all — so the policy can be close to
 * 'self'-only, which contains the damage if any stored text ever escaped
 * React's escaping: an injected script cannot load, and nothing can call
 * out to exfiltrate engagement data.
 *
 * The two inline scripts index.html legitimately carries (theme init and
 * the blank-page watchdog) are pinned by SHA-256 hash computed from the
 * final HTML, so editing them never requires hand-updating the policy.
 * style-src keeps 'unsafe-inline' because React's style props produce
 * style attributes at runtime; scripts get no such allowance.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'vapt-content-security-policy',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
      const hashes = inlineScripts.map(
        (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
      );
      const csp = [
        `default-src 'self'`,
        `script-src 'self' ${hashes.join(' ')}`.trim(),
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob:`,
        `font-src 'self'`,
        `connect-src 'self'`,
        `worker-src 'self' blob:`,
        `manifest-src 'self'`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
      ].join('; ');
      // A <meta> CSP only governs what follows it, so it goes immediately
      // after the charset declaration — ahead of the theme script it pins.
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

/**
 * GitHub Pages compatibility
 * -------------------------------------------------------------------------
 * The app is deployed as a static bundle that may live at either:
 *   https://<user>.github.io/<repo>/     (project pages -> sub path)
 *   https://<user>.github.io/            (user pages    -> root)
 *   file:// or any static host           (portable)
 *
 * `base: './'` emits relative asset URLs so the exact same build artefact
 * works in all of the above without rebuilding per-path. Routing uses a
 * HashRouter so deep links never hit the GitHub Pages 404 handler.
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  build: {
    outDir: 'dist',
    target: 'es2022',
    // Warn well before the production audit's hard budgets (entry < 500 kB,
    // eager set < 700 kB) so growth is noticed in development, not in CI.
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow sandboxed/preview hosts (e.g. *.e2b.app) to reach the dev server.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // The audit suites drive the whole app (render + fake IndexedDB +
    // real library) per test; the heaviest measures ~4.8s locally, which
    // the default 5s timeout called a failure on a shared CI runner.
    // 20s keeps a hung test detectable without failing on CPU weather.
    testTimeout: 20_000,
  },
});
