# Deployment to GitHub Pages

The application is a static bundle. `npm run build` produces `dist/`, which can be published to
GitHub Pages, any static host, or opened directly from disk.

## How the build is served

Two live workflows — there are no copies to keep in sync:

| Workflow | Trigger | What it runs |
| --- | --- | --- |
| [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml) | Push to `main`, manual dispatch | Dependency audit (production) → typecheck → lint → accessibility contract → build → bundle verification → **full test suite** → publish `dist/` to Pages |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | Pull requests, pushes to non-`main` branches | The same gates, without publishing |

Both pin Node via [`.nvmrc`](../../.nvmrc). Action and dependency updates arrive as Dependabot
pull requests (`.github/dependabot.yml`), so versions are bumped deliberately, never silently.

The full suite runs **after** the build on purpose: the production audit tests
(`src/audit/production.audit.test.ts`) inspect the real `dist/` artefact and skip when it is
absent. Building first means CI actually covers the deployed bundle — links, assets, CSP and
no-dev-plumbing — on every change.

## Why it works under a repository sub-path

| Mechanism | Effect |
| --- | --- |
| `base: './'` in `vite.config.ts` | Asset URLs are relative, so the same build works at `/` and at `/<repo>/` |
| `HashRouter` | Routes live behind `#/`; refreshing a deep link never reaches the Pages 404 handler |
| `public/.nojekyll` | Stops Jekyll from stripping hashed asset directories |

No environment variable, no per-repository rebuild, no `404.html` redirect shim.

## Protecting against a blank page

The hosted page was blank once because GitHub Pages was set to "Deploy from a branch", which serves
the **raw source** `index.html` (browsers can't run the `/src/main.tsx` entry). That setting is now
"GitHub Actions", and the workflow deploys the compiled app. Two enforced guards keep it that way:

1. **Bundle verification** — `.github/check-built-bundle.mjs` refuses to publish if `dist/index.html`
   links the raw source entry, is missing the hashed `./assets/*.js` + stylesheet, references an
   asset that isn't on disk, or lacks the production Content-Security-Policy. It runs in both
   workflows immediately after the build.
2. **Accessibility gate** — `src/ui/designSystem.test.ts` fails the build on retired vocabulary,
   colour-only status, unlabelled controls, missing progress-bar names and hand-rolled button
   lookalikes. It runs before the build (and again inside the full suite).

## ⚠️ If the hosted page is blank — read this first

A blank page at `https://<user>.github.io/<repo>/` is almost always one thing: GitHub Pages is set
to **Deploy from a branch** instead of **GitHub Actions**.

When source is *Deploy from a branch*, GitHub publishes the raw `main` branch. The repo's root
`index.html` is the Vite *source* entry (`<script src="/src/main.tsx">`), which is **not** a runnable
browser bundle — so browsers show an empty `<div id="root">` and nothing else. The compiled app in
`dist/` is never published in that mode.

### One required setting

1. Open **Settings → Pages → Build and deployment → Source**.
2. Choose **GitHub Actions** (not "Deploy from a branch").
3. Push a change to `main` (or re-run the `Deploy to GitHub Pages` workflow). The workflow builds
   the real app and serves it.

That single switch is the whole fix. Everything else (relative asset URLs, `HashRouter`,
`.nojekyll`) already works in both modes.

> The app ships a graceful fallback: if it is ever served from the raw source (or the bundle fails
> to load), the page shows a short, styled message instead of an empty void.

## Enabling Pages

1. Push to `main`.
2. **Settings → Pages → Build and deployment → Source:** select **GitHub Actions**.
3. The first run publishes to `https://<user>.github.io/<repo>/`.

## Manual deployment

```bash
npm ci
npm run build
# then publish the contents of dist/ however you prefer, e.g.
npx gh-pages -d dist --dotfiles
```

`--dotfiles` matters: it preserves `.nojekyll`.

## Verifying a build locally

```bash
npm run verify            # build + bundle check + full suite (what CI runs)
npm run preview           # serves dist/ at http://localhost:4173
npx serve dist            # or any static file server
```

To simulate a repository sub-path, serve `dist/` from a nested directory (for example
`public/VAPT-Checklist/`) and load `http://localhost:PORT/VAPT-Checklist/`. Because assets are
relative and routing is hash-based, no configuration change is required.
