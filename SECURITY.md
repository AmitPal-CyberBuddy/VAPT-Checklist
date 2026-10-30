# Security policy

VAPT Checklist is a security tool, so its own security posture is part of the product.
This page says how to report a problem and what the architecture already guarantees.

## Reporting a vulnerability

Please report vulnerabilities **privately** via GitHub's
[private vulnerability reporting](https://github.com/AmitPal-CyberBuddy/VAPT-Checklist/security/advisories/new)
rather than a public issue. Include the version (Settings shows the library version),
the browser, and a minimal reproduction. You should get an acknowledgement within a few
days; fixes ship to `main` and deploy automatically.

There is no bug-bounty programme — reports are credited in the fix commit unless you
prefer otherwise.

## Threat model in one paragraph

The app is a static bundle with **no backend and no account system**. Engagement data —
target details, results, notes — lives only in the tester's browser (IndexedDB) and in
files the tester explicitly exports. Nothing is transmitted anywhere: the production
build is test-verified to issue no remote request, and a Content-Security-Policy
(`default-src 'self'`, inline scripts hash-pinned) is injected into the shipped HTML so
that even a hypothetical injection bug could not load remote code or call out with data.
The realistic attack surfaces are therefore the two places untrusted text is consumed:
**rendering** (React escaping everywhere; the stored application URL is scheme-checked
before it can become a link) and **files** (backup imports are fully validated before a
single record is written; Excel exports neutralise spreadsheet formula injection —
the issue this tool itself tests for as INJ-017).

## Protecting your own data

- Browser storage is per-origin and unencrypted at rest. On a shared machine, export a
  backup and clear site data when you finish an engagement.
- Treat exported JSON backups and Excel reports as what they are: client-confidential
  documents. Store and send them under your engagement's handling rules.

## Supported versions

Only the latest deployment from `main` is supported — the Pages site always serves the
tip of `main`, and dependencies are kept current through Dependabot with `npm audit`
gating both CI and the deploy pipeline.
