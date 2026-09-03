# Deployment to GitHub Pages

The application is a static bundle. `npm run build` produces `dist/`, which can be published to
GitHub Pages, any static host, or opened directly from disk.

## Why it works under a repository sub-path

| Mechanism | Effect |
| --- | --- |
| `base: './'` in `vite.config.ts` | Asset URLs are relative, so the same build works at `/` and at `/<repo>/` |
| `HashRouter` | Routes live behind `#/`; refreshing a deep link never reaches the Pages 404 handler |
| `public/.nojekyll` | Stops Jekyll from stripping hashed asset directories |

No environment variable, no per-repository rebuild, no `404.html` redirect shim.

## How the build is served

The repository carries a single deploy workflow, `.github/workflows/pages.yml`, that on a push to
`main` typechecks, tests, builds the bundle and publishes `dist/` to GitHub Pages. (The
`docs/deployment/deploy.yml` and `docs/deployment/ci.yml` files are kept here as reference mirrors;
the live workflow in `.github/workflows/pages.yml` is what actually runs.)

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

## Workflow files (reference mirrors)

| File | Purpose |
| --- | --- |
| `.github/workflows/pages.yml` | **Live.** On push to `main`: typecheck → test → build → publish `dist/` to GitHub Pages |
| `docs/deployment/deploy.yml` | Reference mirror of the Pages deploy workflow |
| `docs/deployment/ci.yml` | Reference CI workflow (typecheck → test → build on PRs and non-`main` branches) |

## Enabling Pages

1. Commit the workflow and push to `main`.
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
npm run preview           # serves dist/ at http://localhost:4173
npx serve dist            # or any static file server
```

To simulate a repository sub-path, serve `dist/` from a nested directory (for example
`public/VAPT-Checklist/`) and load `http://localhost:PORT/VAPT-Checklist/`. Because assets are
relative and routing is hash-based, no configuration change is required.
