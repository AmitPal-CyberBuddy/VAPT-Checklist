# ADR 0010 — References derived from validated standards codes

**Status:** Accepted

## Context

Testers expect references on a test definition. The obvious implementation is a `references` array
of `{ label, url }` per test. With 184 tests that means several hundred hand-typed URLs that:

- rot silently as OWASP restructures its sites,
- drift in style (some tests get five links, some get none),
- invite placeholder entries just to fill the field,
- and cannot be validated.

The first draft of the library also revealed the failure mode in the standards mapping itself: codes
like `WSTG-ATHN-*`, `WSTG-BUSL-*` and `-` had crept in where no precise mapping was known. Those are
placeholders wearing a standards costume.

## Decision

**Remove the `references` field. Derive references from the standards codes the test already
declares.**

`src/data/references.ts` maps:

| Code shape | Destination |
| --- | --- |
| `A0n:2021` | OWASP Top 10 2021 chapter |
| `APIn:2023` | OWASP API Security Top 10 2023 chapter |
| `WSTG-XXXX-NN` | The corresponding WSTG chapter |
| `MASVS-AREA-N` | OWASP MASVS |
| `CWE-NNN` | MITRE CWE definition |

`isKnownStandardCode()` recognises only well-formed codes, and `validateLibrary()` fails the build on
anything else. Every placeholder code was replaced with a concrete one, or the mapping was dropped
where none genuinely exists.

## Consequences

- Every test has correct, consistently formatted references with zero per-test maintenance, and a
  unit test asserts that no test resolves to an empty reference list.
- A malformed or wildcard standards code is now a build failure rather than a dead link.
- Link rot is fixed in one map instead of 184 definitions.
- Trade-off: a test cannot cite a resource outside the standards mapping (a specific research blog
  post, for example). That content belongs in `testingGuidance`, where it is actionable, rather than
  as a link the tester has to leave the app to read.
