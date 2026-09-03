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

The repository carries a deploy workflow, `.github/workflows/pages.yml`, that on a push to `main`
builds the bundle and publishes `dist/` to GitHub Pages. (The `docs/deployment/deploy.yml` and
`docs/deployment/ci.yml` files are kept here as reference mirrors.)

### Protecting against a blank page

The hosted page was blank once because GitHub Pages was set to "Deploy from a branch", which serves
the **raw source** `index.html` (browsers can't run the `/src/main.tsx` entry). That setting is now
"GitHub Actions", and the workflow deploys the compiled app. To keep it that way, the repo ships two
guards — but note they must be **wired into the workflow by the repo owner**, because the
automation account that maintains this branch does not have the GitHub `workflows` permission and
cannot push edits to `.github/workflows/`.

1. **Bundle verification** — `.github/check-built-bundle.mjs` refuses to publish if `dist/index.html`
   links the raw source entry, is missing the hashed `./assets/*.js` + stylesheet, or references an
   asset that isn't on disk. Run it after the build:
   ```yaml
   - name: Verify built bundle (never a blank page)
     run: node .github/check-built-bundle.mjs
   ```
2. **Accessibility gate** — `src/ui/designSystem.test.ts` fails the build on retired vocabulary,
   colour-only status, unlabelled controls, missing progress-bar names and hand-rolled button
   lookalikes. Run it before building:
   ```yaml
   - name: Accessibility contract (design-system)
     run: npx vitest run src/ui/designSystem.test.ts
   ```

Until those steps are added to `pages.yml`, the guards exist but aren't enforced in the workflow.
A minimal hardened `build` job that includes both, plus `npx tsc --noEmit` and `npm run build`,
is shown in the throwaway `docs/deployment/ci.yml`.

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
