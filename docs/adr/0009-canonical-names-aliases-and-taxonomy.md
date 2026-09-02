# ADR 0009 — Canonical vulnerability names with aliases, and a two-level taxonomy

**Status:** Accepted

## Context

Security terminology is redundant. The same weakness is called IDOR, BOLA, Insecure Direct Object
Reference and Broken Object Level Authorization depending on which document you read. A library that
creates one entry per term produces near-duplicate tests, splits a tester's attention and makes
coverage counts meaningless.

Grouping has a similar trap. A flat 184-entry list is unusable; a deep tree
(`Injection → SQL → Blind → Time-Based`) looks rigorous and turns navigation into a chore. Categories
alone are also too coarse once one holds 21 tests.

## Decision

**One canonical name per vulnerability, plus `aliases`.**
`vulnerabilityName` carries the term a report reader expects; every other industry term for the same
issue goes into `aliases`, which are indexed for search. Names and aliases share a single namespace
and `validateLibrary()` fails if two tests claim the same term.

**Exactly two taxonomy levels.** Each category declares its `subcategories` in
`src/data/categories.ts`, and every test must use one of them (validated). 18 categories,
100 subcategories, 184 tests.

## Consequences

- Searching "BOLA", "IDOR" or "object level" lands on the same single test, and the library shows
  *matched on synonyms* so the tester understands why.
- Coverage percentages mean something: one vulnerability is one row.
- Subcategories give the checklist a useful grouping and filter axis without a tree widget.
- Adding a test requires choosing from the declared subcategories, which keeps the taxonomy from
  quietly sprawling — a new bucket is a deliberate edit to the category definition.
- Cost: 536 alias strings to maintain. The duplicate-term validator makes that maintenance safe.
