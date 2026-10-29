<!-- One idea per PR keeps review and rollback simple. -->

## What changed and why

## Gates

- [ ] `npm run verify` passes (build → bundle check → full suite; the build must
      precede the tests or the production audit silently skips)
- [ ] `npm run lint` clean
- [ ] If the test library changed: `LIBRARY_VERSION` bumped, `RETIRED_TEST_MERGES`
      updated for any retired test, and the docs still match the recomputed
      numbers (`src/data/documentation.test.ts`)
- [ ] If UI vocabulary/states changed: same wording in the Excel export and docs,
      and every status/result/priority still pairs a glyph and a label with colour

## Screenshots (UI changes)

<!-- Before/after at desktop and ≤1024px widths. -->
