import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
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
  },
});
