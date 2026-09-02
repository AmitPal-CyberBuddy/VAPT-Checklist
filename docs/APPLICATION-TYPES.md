# Application Type & Engagement Applicability Review

The dropdown listed eight application types. This review measured what the library actually covers
for each, then rebuilt the engagement flow around that answer.

The headline finding: **`Thick / Desktop Client` had zero tests aimed at it, yet selecting it
produced a 119-test checklist of web and API tests.** That is a false representation of capability,
and it is now refused rather than dressed up.

---

## 1. Coverage matrix

Measured from the library, not asserted. *Domain-specific* counts tests whose applicability rule
names that asset type and is not simply a shared HTTP-layer rule; *shared* counts the generic HTTP
tests a type inherits; *universal* is the 105 tests with no asset-type gate at all.

| Application Type | Domain-specific | Shared HTTP | Checklist size | Questions asked | Supported? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Web Application** | 42 | — | 155 | 21 | ✅ **Supported** | The library was built around this domain: client-side 10, config 8, injection 7, recon 5, session 5 |
| **REST API** | 14 | 17 | 146 | 20 | ✅ **Supported** | Full OWASP API Top 10 2023 — API 9, authorization 3, plus CORS and schema exposure |
| **GraphQL API** | 21 | 17 | 153 | 20 | ✅ **Supported** | 7 GraphQL-specific tests on top of the whole API surface |
| **SOAP / XML-RPC** | 12 | 16 | 145 | 20 | ⚠️ **Limited** | Only **one** genuinely SOAP-specific test (WSDL/operation abuse); the rest is the generic API and XML surface. No WS-Security, WS-Addressing or SAML-in-SOAP, no WSDL-driven fuzzing |
| **Android Application** | 10 | 0 | 129 | 19 | ⚠️ **Limited** | MASVS-aligned screening set, not MASTG depth. No runtime instrumentation, no reverse-engineering workflow, no SDK inventory |
| **iOS Application** | 10 | 0 | 129 | 19 | ⚠️ **Limited** | The same ten tests — guidance is shared with Android rather than iOS-specific (no Keychain-vs-Keystore split) |
| **Cloud Environment** | 4 | 0 | 119 | 14 | ⚠️ **Limited** | Exposure testing only: public storage, instance metadata, management ports, plus container/orchestration and subdomain takeover. **Not** a configuration review — no CIS benchmark, no serverless, no cloud logging |
| **Thick / Desktop Client** | **0** | 0 | — | — | ❌ **Not supported** | No binary or memory analysis, no local privilege or DLL hijacking, no local storage review, no IPC, no update-channel integrity |

Support level is computed at runtime by `src/data/typeCoverage.ts`: 0 domain-specific tests →
unsupported, fewer than 14 → limited, otherwise supported. **The UI cannot claim coverage the
library does not carry**, and if someone adds ten iOS tests the product stops calling iOS limited on
its own. A unit test pins the current verdicts so a change is deliberate.

---

## 2. Architecture: type before context

Application type is now a first-class engagement field, not a context answer:

```text
Engagement
├── Basic information      name, URL
├── Application Type       ← the testing domain, chosen second
├── Application Context    ← only the questions that domain needs
└── Assessment state
```

```text
Application Type → effective asset surface → context questions
                                          → applicability rules → checklist
```

`context.assetTypes` is no longer asked. It is **derived** at evaluation time from
`applicationType` + `additionalSurfaces` by `effectiveContext(engagement)`, so the domain is stored
once and the 42 rules that read `assetTypes` keep working unchanged. Every place that evaluates
rules — engagement creation, applicability re-sync, dashboard, workspace, high-value ranking, Excel
export — goes through that one derivation.

### Flow

| Step | Screen | Why |
| --- | --- | --- |
| 1 | Engagement name and URL | Cheap, no dependencies |
| 2 | **Application type** | Establishes the domain; shows measured coverage and states limitations before anything is committed |
| 3 | Context | Only the questions that domain uses |
| 4 | Review | The generated checklist, with confirmed vs unconfirmed |

Four steps rather than five: client, tester, dates and scope stay collapsed behind one optional
toggle on step 1 rather than occupying a step of their own.

---

## 3. Behaviour for limited and unsupported types

**Limited** (SOAP, Android, iOS, Cloud): usable, with a panel that names what is covered — by
category, with counts — and a *"What it does not cover"* list. Nothing is hidden to make the option
look better. The dashboard and the Excel summary both carry the support level, so the limitation
travels with the deliverable.

**Unsupported** (Thick client): selectable so the reason can be read, then refused. The panel
explains that there are no thick-client tests, that proceeding would produce web tests wearing the
wrong label, and what to do instead — assess the backend as a REST API, SOAP or Web Application
engagement. **Continue** stays disabled.

---

## 4. Questions

| Change | Detail |
| --- | --- |
| **Removed from the form** | `assetTypes` — now derived from the application type, never asked |
| **Added** | `additionalSurfaces` — "Other surfaces in scope", for a web app that also exposes an API. Asked only where it makes sense; declared as `feeds: 'assetTypes'` so the "every question changes the checklist" invariant stays honest |
| **Scoped to domains (16 questions)** | `clientRendering`, `usesThirdPartyScripts`, `usesCrossOriginRequests`, `hasUserGeneratedContent` → web only. `usesWebsockets`, `parsesXml`, `usesTemplating`, `usesSerialization` → HTTP domains. `acceptsUrlsFromUsers`, `hasSearch`, `hasFileUpload`, `hasFileDownload`, `hasDataExport`, `hasCouponsOrPricing`, `hasWorkflowOrTransactions`, `hasEmailNotifications` → HTTP and mobile |
| **Removed entirely** | None. Every remaining question already drove at least one test — an invariant enforced by test since the earlier content audit |

Result: a cloud engagement is asked **14** core questions instead of 21, and is never asked about
single-page rendering or server-side templating.

---

## 5. Applicability rules changed

No test's rule was rewritten in this review — the rules were already keyed on `assetTypes`, and the
change is *where that value comes from*. What changed:

- Asset types are derived from the application type rather than typed in by hand, so the domain and
  the checklist can no longer disagree.
- Six evaluation sites now resolve the context through `effectiveContext()` instead of reading
  `engagement.context` directly.
- Database schema **v2** with a migration: engagements written before this change take their type
  from the first asset type they recorded, and the remainder become additional surfaces — the
  derived list matches what the engagement had before, so no checklist shifts under a tester.

---

## 6. Scenario verification

| Scenario | Result |
| --- | --- |
| **A** — Web + auth + roles + MFA + upload | AUTH-001/007/008, AUTHZ-003/010, FILE-001/002, SESS-008/013, INJ-004, CLI-001, CONF-001 all present; no mobile or GraphQL tests |
| **B** — Web, no auth, no upload, no payment | Materially smaller. AUTH-001, AUTH-007, SESS-001, SESS-013, FILE-001, PRIV-005 all correctly gone; INJ-001, INJ-004, CONF-001, TLS-004, DISC-001 still present |
| **C** — REST API + JWT | API-001/002/003/005, AUTHZ-002/009, SESS-010 present; CONF-001, CLI-002, CLI-003, TLS-003 and mobile tests correctly absent |
| **D** — Thick client | Explained and refused; Continue disabled; choosing REST API unblocks it |
| **D2** — Android | Usable, with the MASTG-depth limitation stated |

---

## 7. Nothing else was broken

Verified by the full suite (**209 tests**): vulnerability-centric library, applicability engine, the
Not Tested default, Tested → Vulnerable / Not Vulnerable, N/A, notes, dashboard, high-value ranking,
search, filters, persistence, multiple engagements and the Excel export — all updated to understand
application type rather than patched around it. The export now carries **Application type**,
**Support level** and **Surfaces in scope** on the summary sheet.

---

## 8. Remaining gaps

1. **Thick-client support needs a methodology, not a few tests.** Binary and memory analysis, local
   privilege escalation, DLL hijacking, local storage, IPC and update-channel integrity — roughly
   15–20 definitions and a context section of its own. Until then the type stays refused.
2. **iOS and Android share one test set.** Honest for screening, wrong for a real mobile engagement.
   Splitting them means platform-specific guidance (Keychain vs Keystore, ATS vs network config) and
   probably doubling the mobile set.
3. **SOAP is one test deep.** WS-Security, WS-Addressing, SAML-in-SOAP and WSDL-driven operation
   fuzzing would move it from limited to supported.
4. **Cloud is exposure testing.** A configuration review needs a different input model — credentials
   and an account inventory rather than an application context — which is arguably a different
   product.
5. **105 tests remain ungated by asset type.** They are genuinely protocol-agnostic (business logic,
   cryptography, disclosure, rate limiting), but they are also why an unsupported domain looked
   plausible. The type gate now sits in front of them.
