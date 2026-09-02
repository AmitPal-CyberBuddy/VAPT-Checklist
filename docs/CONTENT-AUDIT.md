# Security Content & Applicability Audit

Reviewed the complete test library and the applicability engine against OWASP WSTG 4.2, ASVS 4.0,
OWASP Top 10 2021 and API Security Top 10 2023 — as reference points, not as a list to copy. The
question throughout was whether an experienced tester running a real Web/API assessment would find
the generated checklist useful.

**Library after the audit: 184 tests** (three merged away, three added), 18 categories,
99 subcategories, 542 aliases. Library version **1.2.0**.

---

## 1. Coverage gaps found

| Gap | Reference | Action |
| --- | --- | --- |
| **Web cache poisoning / deception** had no test of its own — one guidance line in CONF-009 and one in INJ-012 | PortSwigger research; A05:2021; CWE-349/524 | **Added INJ-022**, High, gated on CDN/proxy |
| **Cross-Site Script Inclusion (XSSI)** entirely absent | WSTG-CLNT-13 | **Added CLI-012**, Medium, gated on authenticated web app |
| **Session cookie scope** — SESS-002/003/004 covered Secure, HttpOnly and SameSite, but nothing asked *which hosts receive the cookie*. A parent-domain cookie plus a takeover-able subdomain (which CLOUD-008 tests for) is session theft without touching the app | WSTG-SESS-02; ASVS 3.4 | **Added SESS-013**, Medium |
| **Email verification bypass** was implied by one line in AUTH-015 | ASVS 2.1 | **Rewrote AUTH-015 guidance** with the bypass scenarios rather than adding a test |

Checked and found already covered: all ten OWASP API Top 10 2023 entries, all ten OWASP Top 10 2021
entries (A04 Insecure Design is represented through the business-logic category rather than as a
single test — a category is not a testable finding), and the ASVS chapters for session management,
cryptography, error handling, data protection, communications, files, API and configuration.

---

## 2. Duplicate / overlapping tests found

| Overlap | Judgement | Action |
| --- | --- | --- |
| **FILE-006 Arbitrary File Download** vs **INJ-011 Path Traversal / LFI** — FILE-006's guidance was literally "manipulate the file parameter with traversal, absolute paths". Same root cause, same technique, and FILE-005 already covered access control on stored files | Genuine duplicate | **Merged into INJ-011**, whose guidance now names download and report endpoints explicitly, with the aliases carried over |
| **TLS-006 "Sensitive Data Exposed in TLS-Adjacent Channels"** — a vague title over three unrelated checks that belong to CLI-010 (`wss://`), CONF-001 (Referrer-Policy) and TLS-004 (plaintext endpoints) | Not a vulnerability class | **Removed**; the `wss://` check moved into CLI-010 |
| **CONF-006 Cross-Domain Policy Misconfiguration** — `crossdomain.xml` is Flash-era technology | Real but no longer deserving its own decision | **Merged into CONF-011** as one guidance line and an alias |
| **DOS-001 / API-003 / LOGIC-005** — three rate-limiting tests whose descriptions did not distinguish them, so a finding could plausibly be filed under any | Distinct lenses, indistinct wording | **Rewrote all three descriptions** to state their own scope and name the other two |
| INFO-005 (content discovery) vs AUTHZ-005 (forced browsing) | Discovery vs access control — genuinely different | Kept |

---

## 3. Naming issues

| Test | Was | Now | Why |
| --- | --- | --- | --- |
| INFO-008 | *Application Entry Point and Attack Surface Gaps* | **Undocumented Application Entry Points** | "Gaps" is not a vulnerability; the title must state what is assessed |
| AUTHZ-006 | *Path Traversal in Access Control* | **Access Control Bypass via URL Path Normalisation** | Collided conceptually with INJ-011. This test is about a proxy and origin disagreeing on a URL, not about reading files |

The `vulnerabilityName` / `testingGuidance` split was checked across all 184 entries: every name
states **what** is assessed, and the naming validator already rejects task-style titles
(*Test…*, *Check…*, *Verify…*).

---

## 4. Applicability issues

Seven defects, six of them under- or over-filtering that would have cost coverage on a real job.

| # | Issue | Impact | Fix |
| --- | --- | --- | --- |
| 1 | **NoSQL Injection was hidden when the tester answered "Unknown" datastore.** SQL Injection allowed `datastore = unknown`; NoSQL did not | A Critical test removed by answering a question *honestly* | Added `unknown` to INJ-002 |
| 2 | **Weak OTP gated on MFA alone** | OTPs are also used for password reset and passwordless login — a High test hidden on any app with reset but no MFA | `any(hasMfa, hasPasswordReset)` |
| 3 | **CSRF gated on the web-app asset type** | A cookie-authenticated API is CSRF-able with no browser app in scope | `all(auth, any(web-app, session-cookie))`. A bearer-token API is still correctly excluded — no ambient credential |
| 4 | **Malware scanning required upload *and* download** | An upload processed internally still carries malware | Gated on upload alone |
| 5 | **Mechanism-specific tests survived "no authentication".** SESS-010 (JWT), SESS-013, AUTH-013 (OAuth), AUTH-014 (SAML), API-006 (API keys) and INJ-008 (LDAP) key on `authMechanisms`, which is simply *unrecorded* when there is no auth — so unknown kept them applicable | Six irrelevant tests on every unauthenticated target | All now require `hasAuthentication` as well. An unrecorded mechanism list still keeps them, conservatively |
| 6 | **`syncLibrary` never recorded the version when nothing was added** | An engagement reported itself as outdated forever after a sync | Version always written; the result now also reports states belonging to retired tests |
| 7 | Cloud tests trigger on `hosting = cloud` rather than the cloud environment being in scope | Reviewed and **kept**: checking for public buckets and exposed management ports on a cloud-hosted target is standard practice, and IAM review is already gated to grey/white box | — |

### Profile verification

Ten profiles built and inspected, each asserting both what must appear and what must not:

```text
OK  Basic web application (no auth)   OK  MFA
OK  Web application + authentication  OK  OAuth / SSO
OK  Multi-role application            OK  Payment functionality
OK  API-heavy (REST + GraphQL, JWT)   OK  Multi-tenant SaaS
OK  File uploads                      OK  WebSockets
OK  Combined (all of the above)       → 170 applicable, 11 unconfirmed
```

A finding worth stating plainly: **two partially-described profiles can produce the same applicable
set**, because an unrecorded fact resolves to *applicable, unconfirmed*. That is the intended
trade-off. What discriminates is the **confirmed** set, which differs for every profile — and that
is what the UI now reports alongside the total.

Every test explains itself: the checklist row shows the conditions that were met, unmet or unknown,
so the tester can see why something is on the list and override it.

---

## 5. Priority issues

| Test | Was | Now | Reasoning |
| --- | --- | --- | --- |
| AUTH-002 Default or Weak Vendor Credentials | High | **Critical** | A live default admin account is immediate, complete compromise requiring no skill. Every rating framework treats it as critical |

Reviewed and deliberately left unchanged: INJ-014 HTTP Request Smuggling (High — impact is severe
but exploitability depends on a specific proxy pairing), DOS-001 Missing Rate Limiting (High — it is
the enabler for credential stuffing), CRYPTO-005 Padding Oracle (High but `always` applicable; there
is no context fact for "hands the client encrypted blobs", and a baseline test is the conservative
choice).

Distribution after the audit: **31 Critical · 64 High · 73 Medium · 16 Low**.

---

## 6. Changes made

**Added (3):** INJ-022 Web Cache Poisoning · CLI-012 Cross-Site Script Inclusion (XSSI) ·
SESS-013 Overly Broad Session Cookie Scope

**Merged / removed (3):** FILE-006 → INJ-011 · CONF-006 → CONF-011 · TLS-006 → CLI-010 + TLS-004

**Renamed (2):** INFO-008 · AUTHZ-006

**Re-prioritised (1):** AUTH-002 → Critical

**Applicability corrected (11 tests):** INJ-002, AUTH-008, SESS-008, FILE-003, SESS-010, SESS-013,
AUTH-013, AUTH-014, API-006, INJ-008, plus the `syncLibrary` version bug

**Guidance / descriptions rewritten (7):** INJ-011 (absorbs download endpoints), CONF-011 (absorbs
cross-domain policy), CLI-010 (absorbs the `wss://` check), CONF-009 (cache hygiene only, deception
moved to INJ-022), AUTH-015 (email-verification bypass), DOS-001 / API-003 / LOGIC-005 (mutually
exclusive scopes)

**Taxonomy:** removed the now-empty `file-handling / Download Controls` subcategory.

All of it is pinned by tests in `src/audit/integrity.audit.test.ts` so none of it can silently
regress.

---

## 7. Verified against the rest of the product

| Area | Result |
| --- | --- |
| Library integrity | 0 validation errors — unique IDs and aliases, valid subcategories, standards codes, guidance depth |
| Checklist seeding | 184 states per engagement; the three new tests seed, filter and record normally |
| Dashboard | Both counting identities hold; high-value ranking picks up the new tests |
| Filtering | Category, subcategory, priority, status, result and search all resolve against the new content |
| Persistence | Backup round trip preserves notes on the new tests |
| Excel export | Assessment sheet row count equals the applicable set; the new tests appear on the Vulnerable sheet; no merged test IDs remain anywhere in the workbook |
| Upgrade path | An engagement created on 1.1.0 with states for merged tests opens without error, keeps its identities, and `syncLibrary` reports the retired states rather than deleting them |
| Suite | **195 tests pass**; production build clean |

---

## 8. Remaining concerns

1. **A merged test's recorded finding stops being visible.** The state row is preserved on disk and
   reported by sync, but the checklist only renders tests that exist in the library. Deleting the
   row would destroy the tester's work; showing a retired test would clutter the list. Reporting it
   is the least-bad option — and any export or JSON backup taken before the merge still holds it.
2. **`CRYPTO-005` and 20 other baseline tests apply to every engagement.** They are genuinely
   universal, but they are also the bulk of what remains unconfirmed on a lightly-described target.
   Adding a fact for "hands the client encrypted values" would narrow it; that is a content decision
   for a future revision, not a defect.
3. **LDAP Injection (INJ-008) keys on SSO or HTTP Basic.** An intranet application doing forms auth
   against Active Directory would not surface it unless SSO is recorded. Broadening the rule would
   surface it on most authenticated apps, which is worse; the tester can include it manually.
4. **No test covers A04:2021 Insecure Design directly.** By design — it is a category, not a
   finding. The business-logic tests carry the practical content.
5. **Mobile coverage is deliberately shallow** (10 tests against MASVS). The product is aimed at
   Web/API assessment; the mobile category exists so a mixed-scope engagement is not silently
   missing a whole asset type, not as a substitute for a MASTG-driven mobile test.
