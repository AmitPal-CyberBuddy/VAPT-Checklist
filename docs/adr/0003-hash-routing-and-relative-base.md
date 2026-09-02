# ADR 0003 — Hash routing and relative asset base

**Status:** Accepted

## Context

GitHub Pages serves static files with no rewrite capability. A project site is hosted under
`https://<user>.github.io/<repo>/`, but the same build may also be served from `/`, another static
host, or opened from disk.

Two problems follow:

1. **Deep links.** With history routing, refreshing `/<repo>/e/abc/checklist` asks GitHub Pages for a
   file that does not exist → 404. The common workaround (copying `index.html` to `404.html` plus a
   redirect shim) is fragile and produces an ugly redirect flash.
2. **Asset paths.** An absolute base (`/assets/…`) breaks under a repository sub-path, and hardcoding
   `/<repo>/` couples the artefact to one deployment location.

## Decision

- Use **`HashRouter`**: all routes live behind `#/`, so the server is only ever asked for
  `index.html`.
- Set **`base: './'`** in `vite.config.ts` so emitted asset URLs are relative.
- Ship **`public/.nojekyll`** so Jekyll does not interfere with hashed asset paths.

## Consequences

- One build artefact works at `/`, at `/<repo>/`, on any static host and from `file://` — no
  rebuild, no environment variable, no 404 shim.
- URLs contain `#` (`…/#/e/abc/checklist`). Acceptable for a local tool; deep links still work,
  including the query parameters used to focus a specific test.
- Server-side rendering and pre-rendering are unavailable — irrelevant for a local-first tool.
