# The Test Library

The bundled VAPT knowledge base: **184 vulnerability test definitions**, 18 categories,
99 subcategories and 542 searchable aliases.

Content and applicability were audited against WSTG 4.2, ASVS 4.0, OWASP Top 10 2021 and API Top 10
2023 — see [`CONTENT-AUDIT.md`](CONTENT-AUDIT.md) for what changed and why.

It is a product asset, not a list of headings. This document is the contract for keeping it that
way.

---

## 1. Anatomy of a test

```ts
{
  id: 'AUTHZ-002',
  vulnerabilityName: 'IDOR / Broken Object Level Authorization (BOLA)',
  category: 'authorization',
  subcategory: 'Object Level Authorization',
  priority: 'Critical',
  description:
    'Object identifiers supplied by the client are used to retrieve or modify records without ' +
    'verifying that the requester owns them, exposing other users\' data.',
  testingGuidance: [
    'Enumerate every request carrying an object reference (id, uuid, filename, account number, hash).',
    'Substitute identifiers belonging to a second test account and observe read, update and delete outcomes.',
    'Test indirect references too: exports, print views, attachments, notification links and bulk endpoints.',
    'Where identifiers are UUIDs, look for leakage of other users\' identifiers elsewhere in the application.',
  ],
  applicability: rule.all(auth, objectResources),
  aliases: ['IDOR', 'BOLA', 'Insecure Direct Object Reference', 'Broken Object Level Authorization'],
  owasp: ['API1:2023', 'WSTG-ATHZ-04'],
  cwe: ['CWE-639', 'CWE-566'],
  tags: ['authorization', 'idor'],
}
```

| Field | Purpose | Required |
| --- | --- | --- |
| `id` | Stable reference used by engagement state; prefix must match the category code | ✔ |
| `vulnerabilityName` | The canonical industry name — WHAT is being assessed | ✔ |
| `category` / `subcategory` | Two-level taxonomy for grouping and filtering | ✔ |
| `priority` | Inherent risk of the class, drives ordering and the "Next up" queue | ✔ |
| `description` | What the weakness is and why it matters | ✔ |
| `testingGuidance` | HOW to test — ordered, concrete steps | ✔ (≥2) |
| `applicability` | Declarative rule over the application context | ✔ |
| `aliases` | Other industry terms, searchable, prevents duplicate tests | recommended |
| `owasp` / `cwe` | Standards mapping; also the source of the References links | ✔ (≥1) |
| `tags` | Cross-cutting labels (`xss`, `rce`, `rate-limiting`) | optional |

**References are derived, not stored.** `src/data/references.ts` turns each standards code into a
canonical URL. A hand-maintained link list per test would rot and drift; a code→URL map gives every
test correct links and lets `validateLibrary()` reject a malformed code.

---

## 2. Naming rules

1. **The title is the vulnerability, never the activity.**
   `Username Enumeration` ✓ — `Test Authentication` ✗.
   Enforced by a unit test that rejects titles starting with test/check/perform/verify/review/assess.
2. **One canonical name, many aliases.** If the industry calls the same issue IDOR, BOLA and
   Insecure Direct Object Reference, that is *one* test with two aliases — not three near-duplicates
   the tester has to reconcile.
3. **Names and aliases share one namespace.** `validateLibrary()` fails if any term is claimed by
   two tests, which is how "Forced Browsing", "WSDL Exposure" and "Content-Type Bypass" were
   assigned to a single owner each.
4. **Consistent terminology.** Use the term a report reader will recognise, spelled the way OWASP
   spells it.

---

## 3. Taxonomy

Two levels. A third would look tidy and slow testers down.

| Category | Code | Subcategories |
| --- | --- | --- |
| Information Gathering | `INFO` | OSINT & Exposure · Technology Fingerprinting · Content Discovery · Client-Side Artefacts · Attack Surface Mapping |
| Configuration & Deployment | `CONF` | Security Headers · Platform Hardening · Component Management · Response Caching · Logging & Monitoring · Supply Chain |
| Transport Security | `TLS` | TLS Configuration · Certificate Validation · Data in Transit |
| Authentication | `AUTH` | Authentication Logic · Credential Security · Password Policy · Login Controls · Multi-Factor Authentication · Account Recovery · Account Registration · Federated Identity |
| Session Management | `SESS` | Session Lifecycle · Cookie Security · Token Security · Request Forgery |
| Authorization & Access Control | `AUTHZ` | Access Control Enforcement · Object Level Authorization · Function Level Authorization · Privilege Escalation · Tenant Isolation |
| Input Validation & Injection | `INJ` | Database Injection · Query Language Injection · Command & Code Injection · Cross-Site Scripting · XML & Parser Injection · Path & File Injection · Protocol & Header Injection · Object Injection · Server-Side Request Forgery · Data Validation |
| Client-Side Security | `CLI` | DOM Security · Browser Storage · Cross-Origin Policy · UI Redressing · Real-Time Channels · Third-Party Content |
| Business Logic | `LOGIC` | Workflow Integrity · Transaction Integrity · Authorisation Workflow · Anti-Automation · Trust Boundary |
| Cryptography | `CRYPTO` | Credential Storage · Algorithm Strength · Key Management · Randomness · Data at Rest · Integrity Protection |
| File Handling | `FILE` | Upload Validation · Upload Storage · Content Processing · Resource Limits |
| API Security | `API` | API Authentication · API Data Exposure · API Resource Controls · API Surface Management · Request Handling · Third-Party Integration · SOAP Services |
| GraphQL | `GQL` | Schema Exposure · Query Controls · GraphQL Authorization · GraphQL Injection · Transport Security |
| Information Disclosure | `DISC` | Error Handling · Response Data Exposure · Artefact Exposure · Metadata & Logs · Enumeration |
| Availability & Rate Limiting | `DOS` | Rate Limiting · Resource Exhaustion · Abuse Prevention |
| Cloud & Infrastructure | `CLOUD` | Storage Exposure · Identity & Access · Network Exposure · Container Security · Orchestration · DNS & Domains |
| Mobile Application | `MOB` | Local Data Storage · Binary & Secrets · Platform Integration · Network Security · Resilience |
| Privacy & Data Protection | `PRIV` | Data Minimisation · Third-Party Sharing · Consent Management · Data Presentation · Regulated Data · Data Subject Rights |

Priority distribution: **31 Critical · 64 High · 73 Medium · 16 Low**.

---

## 4. Applicability

40 context facts, 38 of which drive rules (2 are marked `metadataOnly` — recorded for the report,
never used by a rule). Unit tests enforce both directions:

- every non-metadata fact must influence at least one test, so the context form cannot accumulate
  dead questions;
- no rule may depend on a metadata fact.

**163 of 184 tests are context-driven**; the remaining 21 are baseline tests that apply to any
target (missing rate limiting, verbose errors, outdated components…).

Rules are per test, not per category — `FILE-001` keys on file upload, `CLI-010` on WebSockets,
`LOGIC-002` on payments or pricing, `AUTH-013` on OAuth being one of the auth mechanisms. Even
inside one category the rules differ, which is the point.

```ts
// Individual, not category-wide:
rule.is('hasFileUpload', true)
rule.includes('authMechanisms', 'oauth2')
rule.all(auth, rule.any(
  rule.is('hasUserOwnedResources', true),
  rule.is('hasMultiTenancy', true),
  rule.includes('assetTypes', 'rest-api', 'graphql-api'),
))
```

Evaluation is tri-state and conservative; see
[ADR 0005](adr/0005-declarative-tri-state-applicability.md).

---

## 5. Writing testing guidance

Guidance is read **during** testing, so it must be scannable.

- 2–4 ordered steps. Long enough to direct real work, short enough to read at 2 a.m.
- Cover the dimensions that matter for that vulnerability. For authorization that means horizontal
  and vertical boundaries, direct object access, role manipulation, API endpoints and HTTP verbs —
  not a general lecture on access control.
- Name concrete techniques, parameters and payload shapes. "Test `alg=none`, algorithm confusion
  using the public key as an HMAC secret, and `jwk`/`jku`/`kid` header injection."
- Never write "check whether the application is vulnerable". A validator rejects steps under 25
  characters; the reviewer rejects vacuous ones.
- Prefer non-destructive proof and note where client approval is needed (request smuggling,
  deserialization gadgets).

---

## 6. Adding a test

1. Pick the category, then a subcategory **already declared** on it in `src/data/categories.ts`
   (add one only if a genuinely new concern appears).
2. Take the next free ID for the category code. Never reuse an ID — engagement state references it.
3. Search existing names *and aliases* first. If the issue is a synonym of an existing test, add an
   alias instead of a new entry.
4. Write the definition in the relevant `src/data/tests/*.ts` file.
5. Give it an applicability rule keyed on facts that already exist. If a new fact is genuinely
   needed, add it to `src/domain/context.ts` — it will then be required to drive a test.
6. Bump `LIBRARY_VERSION` in `src/data/library.ts`.
7. Run `npm test`. `validateLibrary()` checks IDs, prefixes, subcategories, duplicate terms,
   description length, guidance depth and standards-code validity.

Existing engagements pick up new tests via **Data & Settings → Sync all engagements**, which adds
state rows without touching recorded work.

---

## 7. What the validator rejects

| Check | Why |
| --- | --- |
| Duplicate test ID | Engagement state would collide |
| Duplicate name **or alias** across tests | Ambiguous search results, near-duplicate tests |
| Subcategory not declared on the category | Broken grouping and filters |
| ID prefix ≠ category code | Unreadable IDs |
| Description < 40 characters | Placeholder content |
| Fewer than 2 guidance steps, or a step < 25 characters | Vacuous guidance |
| Unrecognised OWASP code (`WSTG-ATHN-*`, `-`) | Dead references |
| Malformed CWE code | Dead references |
| Task-style title (`Test …`, `Check …`) | Breaks vulnerability-centric naming |
