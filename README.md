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

## One vocabulary

The same word means the same thing in the app, the export and the docs — **Not Tested / Tested /
N/A**, **Vulnerable / Not Vulnerable**, **Applicable / Not Applicable**, **Completed**. Status,
result and priority always render with a glyph and a label as well as a colour, so nothing depends
on hue alone. See [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md).

## Core concepts

| Concept | Meaning | Lives in |
| --- | --- | --- |
| **Test Definition** | Permanent knowledge base entry: vulnerability name, category, priority, description, testing guidance, applicability rule | Bundled with the app (`src/data`) — immutable |
| **Application Context** | Facts about the target (has file upload? uses JWT? multi-tenant?) | Per engagement (IndexedDB) |
| **Applicability** | *Should* this test be in this engagement? Suggested by rules, always overridable | Per engagement per test |
| **Status** | Has the test been performed? `Not Tested` / `Tested` / `N/A` | Per engagement per test |
| **Result** | `Vulnerable` / `Not Vulnerable` — required only when status is `Tested` | Per engagement per test |
| **Notes** | Free text observations | Per engagement per test |

### Progress and integrity

```text
Completed = Tested + N/A
Progress  = Completed / Total Applicable Tests
```

One formula, defined once in `src/domain/metrics.ts`, used by the engagement list, the dashboard,
every category and priority bar, and the Excel export.

Two identities always hold — on screen, in the export and in the database:

```text
Total Applicable = Not Tested + Tested + N/A
Tested           = Vulnerable + Not Vulnerable
```

They hold because inconsistent states are **unrepresentable**: status and result are written in a
single atomic transition, and the repository refuses any record that would break an invariant. A
row with `Status = N/A` and `Result = Vulnerable` cannot be created by the UI, by a bulk edit, or by
importing a hand-edited backup file.

Global test definitions and engagement state are never mixed. See
[`docs/DATA-MODEL.md`](docs/DATA-MODEL.md).

### The working loop

```text
Open test → read guidance → test → status → result → optional note → next test
```

All of it happens on one screen. The **Testing Workspace** is a two-pane view: the filtered test
list on the left, the full test on the right — description, guidance, applicability, references,
status, result and notes — with keyboard shortcuts so you never reach for the mouse between tests:

| Key | Action |
| --- | --- |
| `j` / `k` (or ↑ / ↓) | Previous / next test |
| `1` `2` `3` | Not Tested · Tested · N/A |
| `v` / `b` | Vulnerable · Not Vulnerable |
| `e` | Jump to the notes field |
| `⏎` | Next test that is still Not Tested |
| `/` | Focus search |

Below 1024px the two panes become a list → detail → back flow rather than a squeezed split, and the
filters collapse behind a disclosure that shows how many are active.

Selecting **Tested** highlights the result control until you record Vulnerable or Not Vulnerable.
Selecting **N/A** asks nothing, but offers one-click reasons ("Feature not present", "Out of agreed
scope") so the report stays defensible without forcing anyone to type.

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
| Vulnerability tests | **184** (31 Critical · 64 High · 73 Medium · 16 Low) |
| Taxonomy | 18 categories → 99 subcategories |
| Searchable aliases | 542 |
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

The context form shows how many tests each question decides, and follow-up questions only appear
when they are relevant — asking "does it have MFA?" after you said there is no authentication is
noise. Hidden questions stay *unrecorded*, which the engine treats as unknown, so shortening setup
never quietly narrows the checklist.

### High-value tests

The dashboard leads with what to test next on **this** application — deliberately not a severity
sort. The score combines priority, how strongly the recorded context points at the test,
category exploitability, whether that category already produced a finding, and whether you pulled
the test into scope yourself:

```text
HIGH-VALUE TESTS

IDOR / Broken Object Level Authorization (BOLA)   Critical
Application has authentication + Users own individual records      Not Tested

Broken Function Level Authorization (BFLA)        Critical
Asset types: REST API · related finding in category                Not Tested

Unrestricted File Upload                          Critical
File upload                                                        Not Tested
```

Each row opens straight into the workspace at that test.

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

## Persistence

Everything is stored in **IndexedDB** (`vapt-checklist`) via Dexie — engagement details, application
context, applicability overrides, statuses, results and notes. There is no server to transmit to and
nothing is held only in memory, so a refresh, a crash or a closed tab never costs recorded work.
Notes are debounced but flushed on tab hide, page unload and when you move to another test.

Engagements are fully independent: each has its own context, its own applicable set, its own
statuses, results, notes and metrics. Nothing is shared but the immutable test library.

## Excel export

**Download Excel** from any engagement card, or from the engagement's Export tab.

| Sheet | Contents |
| --- | --- |
| **Engagement Summary** | Name, application URL and type, client, tester, created & export dates, the six assessment statistics, overall progress, findings by priority, and the full application context |
| **Assessment** | Every applicable test — Test ID, Vulnerability Name, Category, Subcategory, Priority, Status, Result, Notes, plus description, guidance, aliases, applicability reasoning and OWASP/CWE |
| **Vulnerable Tests** | Only `Status = Tested` and `Result = Vulnerable`, ordered Critical → Low |
| **Not Applicable** *(optional)* | Excluded tests with the rule and reason — the audit trail for scope decisions |
| **Coverage** *(optional)* | Per-category counts and progress, with a total row |

Frozen header rows, frozen ID/name columns, filter dropdowns on every data sheet, tuned column
widths and colour-coded priority and result cells. Generated in the browser with a bundled XLSX
writer — no server, no upload — from the same data the dashboard renders.

## Backup and restore

- **Export Engagement JSON** (Export tab) — one engagement, complete and re-importable.
- **Export all engagements** / **Import Engagement JSON** (Data & Settings).

Imports are validated *before* anything is written: file shape, enum values, timestamps,
cross-references, duplicate ids and the state-machine invariants. You get a report of what will be
added and any warnings, and confirm before it lands. A rejected file changes nothing, and a
colliding engagement id is re-keyed rather than overwritten — an import can only ever add.

Clearing site data deletes your engagements, so take a backup before you do.

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, data flow, module map
- [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) — entities, invariants, metrics, export model
- [`docs/TEST-LIBRARY.md`](docs/TEST-LIBRARY.md) — knowledge base conventions, taxonomy, authoring guide
- [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) — visual language, vocabulary, responsive and accessibility rules
- [`docs/AUDIT.md`](docs/AUDIT.md) — end-to-end product audit: what was tested, what was found, what was fixed
- [`docs/CONTENT-AUDIT.md`](docs/CONTENT-AUDIT.md) — security content and applicability audit against WSTG / ASVS / OWASP Top 10
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`docs/deployment/`](docs/deployment/) — GitHub Pages deployment and workflows

## Licence

MIT
