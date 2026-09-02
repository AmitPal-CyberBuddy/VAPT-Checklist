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

## Workflow files

The two workflows in this directory are ready to use. Copy them into place:

```bash
mkdir -p .github/workflows
cp docs/deployment/deploy.yml .github/workflows/deploy.yml
cp docs/deployment/ci.yml     .github/workflows/ci.yml
git add .github/workflows && git commit -m "Add CI and Pages workflows"
```

> They live here rather than in `.github/workflows/` because the automation account that created
> this branch is not granted the GitHub `workflows` permission and cannot push files to that path.
> Committing them from your own account works normally.

| File | Purpose |
| --- | --- |
| `deploy.yml` | On push to `main`: typecheck → test → build → publish `dist/` to GitHub Pages |
| `ci.yml` | On pull requests and non-`main` branches: typecheck → test → build |

## Enabling Pages

1. Commit the workflows and push to `main`.
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
