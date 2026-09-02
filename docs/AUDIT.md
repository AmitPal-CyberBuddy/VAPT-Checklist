# End-to-End Product Audit

Performed against the built application from two positions: a senior application security
consultant running an engagement, and an engineer reviewing for production readiness.

Nothing below was accepted as working because it looked implemented. Each area was driven through
the real write path or the real interface, and the checks are kept as executable suites in
[`src/audit/`](../src/audit) so they run on every change.

| Suite | Covers |
| --- | --- |
| `integrity.audit.test.ts` | §2 state machine · §3 applicability profiles · §5 isolation · §6 persistence · §7 export parity · §11 corrupted data |
| `workflow.audit.test.tsx` | §1 the workflow through the UI · §4 dashboard arithmetic · §8 search and filters |
| `production.audit.test.ts` | §10 the deployment artefact · §11 untrusted input |

**186 tests pass.** Seven defects were found and fixed; three are security issues.

---

## Defects found and fixed

### 1. Stored self-XSS through the Application URL — *high*

`href={engagement.applicationUrl}` rendered whatever the tester typed. A `javascript:` URL was a
click away from script execution in the app's own origin, and it survived a JSON backup, so it
could travel between testers.

**Fixed** — `safeExternalUrl()` (`src/domain/untrusted.ts`) allows only `http:`/`https:`. Anything
else is displayed as plain text, never linked. A bare host is assumed `https`, so ordinary input
still works.

### 2. Formula injection in our own Excel export — *high*

A note beginning `=`, `+`, `-` or `@` was written to the workbook verbatim. The moment a client
converted the deliverable to CSV it became a formula — the exact issue this product ships a test
for (**INJ-017, CSV / Formula Injection**). Shipping it in our own export was indefensible.

**Fixed** — `safeSpreadsheetText()` neutralises a leading formula character on every
tester-controlled cell (notes, engagement name, URL, client, tester, scope, description). Library
prose is left exact.

### 3. Corrupted local data produced impossible dashboard numbers — *medium*

A row with an unrecognised `status` (a partial write, a manual IndexedDB edit, a future build) was
counted as applicable but matched no bucket, so `applicable = 3` while the parts summed to `2`,
breaking the identity the product guarantees.

**Fixed** — unrecognised statuses count as `Not Tested`, so the identities hold for whatever is on
disk, and `repairIntegrity()` now rewrites those rows to a legal value when the engagement opens.

### 4. The first chip in every group had a garbled accessible name — *accessibility*

`Field` wraps its children in a `<label>`, which implicitly labels the **first** labellable
descendant. Around a chip group that gave chip one an accessible name of
*"Application type REST API GraphQL API SOAP / XML-RPC API … Drives which whole families of tests
apply"*, and clicking the field's text toggled it. It also made the control unfindable by name — the
audit hit this immediately.

**Fixed** — added `FieldGroup` (`fieldset`/`legend`) for groups of controls, used for the
application-type chips; the context form's multi-selects now carry `role="group"` and a name. A
contract test fails the build if a `Field` ever wraps more than one button again.

### 5. The wizard's default questions left a third of the list unconfirmed — *product*

`core` — the set asked by default — was arbitrary: 10 of the 38 facts that drive rules.
`datastore` was core while `handlesPayments`, `hasWorkflowOrTransactions` and `callsExternalServices`
were not. Completing the default wizard still left **48 unconfirmed** tests, so the "intelligently
narrowed checklist" did not arrive.

**Fixed** — `core` now means *"answering this decides two or more tests"*. Eleven high-impact,
one-tap questions were promoted, and the container question is asked only for cloud hosting.
Completing the default wizard now leaves **19 unconfirmed** — a 60% reduction for about 30 extra
seconds of setup. A test enforces both halves: unconfirmed must stay under 15% of the list, and the
default question set must stay at or below 24 questions.

### 6. Unconfirmed tests were not visible where the decision is made — *product*

The dashboard only mentioned incomplete context when under 50% of questions were answered, which is
not the signal that matters.

**Fixed** — the banner now triggers on the unconfirmed count itself and says how many questions
remain; `Total applicable` carries an `N unconfirmed` hint; the wizard shows the unconfirmed count
live as questions are answered.

### 7. Long tester input could overflow the layout — *responsive*

There was no `break-words` anywhere in the application, and notes are exactly where long unbroken
tokens live — payloads, JWTs, base64. A single long token in a note or a pasted URL would push the
container sideways.

**Fixed** — wrapping/truncation on every element that renders free-form tester text, with a
contract test to keep it that way.

---

## Verified working

### §1 Workflow

Driven through the interface, not the API: create → application type → context (answering a question
visibly shrinks the generated list) → review → create → dashboard → workspace → search → open test →
Tested → Vulnerable → note → back to dashboard, where the finding and its note appear → export
screen offers the workbook with the right filename.

### §2 State integrity

All seven valid transitions verified through the repository, plus the four impossible combinations
attempted by three routes each (direct write, arriving from another state, bulk edit). None can be
stored. `Tested` without a result is rejected rather than half-written. Marking a test Not
Applicable clears execution state but keeps the note that explains the decision.

### §3 Applicability

Eight engagement profiles — basic web app, API-heavy, multiple roles, file upload, MFA, payments,
OAuth/SSO, WebSockets — each asserted to surface its relevant tests and exclude the irrelevant ones.

One finding worth recording: **two partially-described profiles can share an identical applicable
set**, because an unrecorded fact resolves to *applicable, unconfirmed*. That is the intended
trade-off (a missed test is worse than an extra one). What discriminates is the **confirmed** set,
which differs for all eight — and that is now the assertion. No Critical test is ever hidden without
an explicitly recorded fact ruling it out.

### §4 Dashboard accuracy

A known distribution (7 Vulnerable, 13 Not Vulnerable, 5 N/A) was recorded and every number on
screen compared against the database, including the progress bar's `aria-valuenow`. Both identities
hold: `applicable = notTested + tested + na` and `tested = vulnerable + notVulnerable`.

### §5 Isolation

Two engagements; 60 edits, a bulk update and a context sweep applied to one. The other is byte-identical
afterwards. The workbook and the JSON backup for one engagement contain no string from the other.

### §6 Persistence

Statuses, results, notes, manual applicability overrides and a changed context all survive closing
and reopening the database. Recorded work is protected from an applicability sweep. Notes flush on
tab hide, page unload and test switch.

### §7 Excel

Every summary statistic compared against `computeMetrics`; every Assessment row compared field by
field against its state; the Vulnerable sheet asserted to be exactly the Tested + Vulnerable set.

### §8 Search and filters

Search × category, status × result, priority × status, the N/A-only view, and the applicability
filter (`applicable + notApplicable = all`). Clearing restores the full dataset exactly.

### §9 Responsive

Every route mounts at desktop and mobile widths. Below 1024px the workspace is a list → detail →
back flow, verified by test. Wide tables scroll inside their own container. Overflow risk from
untrusted text is fixed above.

### §10 GitHub Pages

The built `dist/` was copied to `/VAPT-Checklist/` and served statically:

```text
/VAPT-Checklist/                     200
  assets/index-*.js                  200
  assets/index-*.css                 200
  favicon.svg                        200
/VAPT-Checklist/#/e/abc/workspace    200
absolute asset paths in index.html   0
```

No dev-server plumbing, no `fetch`/worker/`importScripts` to a remote origin, no remote `url()` in
CSS, no off-origin subresource. `http://localhost` does appear inside react-router's bundle as
`new URL('http://localhost')`, its internal parsing base — inert, and confirmed by inspection rather
than assumed. The Excel writer is a separate chunk, absent from the entry bundle.

### §11 Security

`npm audit`: 0 vulnerabilities. No `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function`
anywhere. Every `target="_blank"` carries `rel="noreferrer noopener"`. Malformed imports are
rejected before the transaction opens, and eleven malformed-backup cases are covered. The three
findings above are fixed.

### §12 Product quality

| Question | Answer |
| --- | --- |
| Understand the product in 30 seconds? | Yes — the empty state states the job and the one action |
| Create an engagement quickly? | Yes — name, URL, type, then optional detail behind one toggle |
| Immediately see what is relevant? | Yes — and after the fixes above, the list is genuinely narrowed rather than nominally so |
| Update a test in seconds? | Yes — `2` then `v`, or two clicks, without leaving the screen |
| Understand progress? | Yes — one formula, stated on the dashboard |
| Find vulnerable tests? | Yes — dashboard section, workspace filter, its own workbook sheet |
| Export without confusion? | Yes — from the engagement card or the Export tab |
| Feel like one product? | Yes — enforced by the design-system contract test, not by review |
