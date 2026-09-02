# VAPT Checklist

A **vulnerability assessment and penetration testing checklist and assessment tracker** that runs
entirely in the browser.

It answers one question well:

> **Given this application — what vulnerabilities should I test, what have I tested, and what were
> the results?**

No backend, no database server, no API keys, no installation. Open the page, create an engagement,
describe the target, work the checklist, export to Excel.

---

## What it is

```text
Create Engagement
        ↓
Define Application Context
        ↓
Determine Relevant Vulnerabilities / Test Cases
        ↓
Perform Testing
        ↓
Record Testing Status
        ↓
Record Result
        ↓
Add Notes
        ↓
Track Progress
        ↓
Export Assessment to Excel
```

## What it is not

A vulnerability management platform · a retesting platform · an evidence store · a remediation
tracker · a client collaboration portal · a Burp Suite replacement · a scanner.

---

## Core concepts

| Concept | Meaning | Lives in |
| --- | --- | --- |
| **Test Definition** | Permanent knowledge base entry: vulnerability name, category, priority, description, testing guidance, applicability rule | Bundled with the app (`src/data`) — immutable |
| **Application Context** | Facts about the target (has file upload? uses JWT? multi-tenant?) | Per engagement (IndexedDB) |
| **Applicability** | *Should* this test be in this engagement? Suggested by rules, always overridable | Per engagement per test |
| **Status** | Has the test been performed? `Not Tested` / `Tested` / `N/A` | Per engagement per test |
| **Result** | `Vulnerable` / `Not Vulnerable` — required only when status is `Tested` | Per engagement per test |
| **Notes** | Free text observations | Per engagement per test |

Global test definitions and engagement state are never mixed. See
[`docs/DATA-MODEL.md`](docs/DATA-MODEL.md).

### Execution state model

```text
Not Tested
   │
   ├──→ Tested
   │       ├──→ Vulnerable
   │       └──→ Not Vulnerable
   │
   └──→ N/A
```

Any decision can be revised at any time. There are deliberately no `Retest`, `Evidence Pending`,
`Finding Created`, `Remediation Pending` or `Closed` states.

---

## Bundled test library

**184 vulnerability test definitions** across 18 categories, each with a real vulnerability name
(SQL Injection, IDOR / BOLA, MFA Bypass, JWT Misconfiguration, SSRF, HTTP Request Smuggling …),
priority, description, ordered testing guidance, OWASP/CWE mappings and a declarative applicability
rule.

| | | | |
| --- | --- | --- | --- |
| Information Gathering | Configuration & Deployment | Transport Security | Authentication |
| Session Management | Authorization & Access Control | Input Validation & Injection | Client-Side |
| Business Logic | Cryptography | File Handling | API Security |
| GraphQL | Information Disclosure | Availability & Rate Limiting | Cloud & Infrastructure |
| Mobile Application | Privacy & Data Protection | | |

Browse it in-app under **Test Library**.

---

## Tech stack

| Concern | Choice | Why |
| --- | --- | --- |
| UI | React 19 + TypeScript | Stable, typed, ubiquitous |
| Build | Vite 8 | Static output, fast, zero-config for GitHub Pages |
| Styling | Tailwind CSS v4 | Compiled to a single CSS file, no runtime |
| Routing | React Router (HashRouter) | Deep links survive refresh on GitHub Pages |
| Persistence | IndexedDB via Dexie | Structured, transactional, large quota |
| Excel | `write-excel-file` (bundled) | Small, styled multi-sheet XLSX, browser-native |
| State | React state + Zustand (UI only) | Data comes from Dexie live queries |

**No runtime CDN dependencies.** Everything is bundled at build time.

---

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static bundle in dist/
npm run preview    # serve the production build
npm test           # domain + library unit tests
```

---

## Deploying to GitHub Pages

The app is a pure static bundle and works at any base path.

1. Copy the ready-made workflows into place (they ship under `docs/deployment/` because the
   automation account cannot push to `.github/workflows/`):

   ```bash
   mkdir -p .github/workflows
   cp docs/deployment/deploy.yml .github/workflows/deploy.yml
   cp docs/deployment/ci.yml     .github/workflows/ci.yml
   ```

2. Push to `main`.
3. In **Settings → Pages**, set *Source* to **GitHub Actions**. The workflow typechecks, tests,
   builds and publishes `dist/`.

Full instructions: [`docs/deployment/README.md`](docs/deployment/README.md).

Deployed URL: `https://<user>.github.io/<repo>/`

Why it works under a repository sub-path:

- `base: './'` in `vite.config.ts` emits **relative** asset URLs.
- **HashRouter** keeps all routes behind `#/`, so GitHub Pages never has to resolve a deep path.
- `public/.nojekyll` stops Jekyll from stripping asset directories.

You can also serve `dist/` from any static host, or open it from disk.

---

## Data, privacy and backups

- Everything is stored in **IndexedDB in your browser** (`vapt-checklist` database).
- Nothing is transmitted anywhere — there is no server to transmit to.
- Clearing site data deletes your engagements. Use **Data & Settings → Download full backup** for a
  portable JSON snapshot, and **Export** for the Excel deliverable.

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, data flow, module map
- [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) — entities, invariants, metrics, export model
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`docs/deployment/`](docs/deployment/) — GitHub Pages deployment and workflows

## Licence

MIT
