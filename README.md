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

| | |
| --- | --- |
| Vulnerability tests | **184** (31 Critical · 64 High · 72 Medium · 17 Low) |
| Taxonomy | 18 categories → 100 subcategories |
| Searchable aliases | 536 |
| Testing guidance steps | 563 |
| Context-driven tests | 163 (21 baseline tests always apply) |
| Application context facts | 40 (38 drive applicability rules) |

Every entry carries a canonical vulnerability name, category **and subcategory**, priority,
description, ordered testing guidance, a declarative applicability rule, aliases, OWASP/CWE mapping
and derived reference links.

| | | | |
| --- | --- | --- | --- |
| Information Gathering | Configuration & Deployment | Transport Security | Authentication |
| Session Management | Authorization & Access Control | Input Validation & Injection | Client-Side |
| Business Logic | Cryptography | File Handling | API Security |
| GraphQL | Information Disclosure | Availability & Rate Limiting | Cloud & Infrastructure |
| Mobile Application | Privacy & Data Protection | | |

**Canonical names, not duplicates.** IDOR, BOLA and *Insecure Direct Object Reference* are one test
with aliases — searching any of them lands on `AUTHZ-002`. Names and aliases share one namespace and
a validator fails the build if two tests claim the same term.

**Search covers everything**: name, alias, test ID, category, subcategory, tags, description,
testing guidance, OWASP/CWE codes and (on the checklist) your own notes. The index is built once at
load, so filtering stays instant.

Full conventions and how to add a test: [`docs/TEST-LIBRARY.md`](docs/TEST-LIBRARY.md).

---

## How the checklist gets narrowed

```text
Complete VAPT knowledge base  (184 tests)
          ↓
Application context           (40 recorded facts)
          ↓
Applicability rules           (per test, not per category)
          ↓
Relevant vulnerabilities      (explained, never hidden silently)
          ↓
Testing checklist
```

Applicability is **never a black box**. Each test shows the conditions that produced the decision:

```text
IDOR / Broken Object Level Authorization (BOLA)

Applicable because:
  ✓ Application has authentication            — Yes
  ✓ Users own individual records or objects   — Yes
  ✓ Asset types: REST API                     — Web Application, REST API
```

Filtering is deliberately **conservative**. A fact you have not recorded evaluates to *unknown*, and
unknown keeps the test in scope with an **Unconfirmed** badge — never silently removed. No Critical
test is ever excluded on unknown facts alone, and the tester can override any decision from the
checklist row (the override is preserved when the context later changes).

The context form shows how many tests each question decides, so you can see which answers actually
move the checklist.

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
- [`docs/TEST-LIBRARY.md`](docs/TEST-LIBRARY.md) — knowledge base conventions, taxonomy, authoring guide
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`docs/deployment/`](docs/deployment/) — GitHub Pages deployment and workflows

## Licence

MIT
