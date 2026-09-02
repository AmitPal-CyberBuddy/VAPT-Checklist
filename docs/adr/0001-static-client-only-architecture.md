# ADR 0001 — Static, client-only architecture

**Status:** Accepted

## Context

The product must be deployable to GitHub Pages and usable by a tester with no installation, no
account and no infrastructure. Engagement data is client-confidential; testers frequently work in
environments where sending assessment data to a third-party service is not permitted.

## Decision

Build the application as a **static bundle** (Vite + React + TypeScript) with **no server-side
runtime of any kind**. All logic — persistence, applicability evaluation, metric calculation and
Excel generation — executes in the browser. All dependencies are bundled at build time; there are no
runtime CDN or external API calls.

## Consequences

**Positive**

- Deploys anywhere static files can be served, including `file://`.
- Confidential engagement data physically cannot leave the machine.
- Zero operational cost and no attack surface to defend.

**Negative / accepted trade-offs**

- No multi-user collaboration or cross-device sync (explicitly a non-goal).
- Data durability depends on the browser; mitigated by `navigator.storage.persist()` and JSON
  backup/restore.
- Everything the app can do must fit in a browser tab, which rules out server-side scanning or
  reporting pipelines — consistent with the product scope.
