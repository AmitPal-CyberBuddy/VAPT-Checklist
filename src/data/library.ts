/**
 * VAPT Checklist — Bundled test library
 * ---------------------------------------------------------------------------
 * The knowledge base ships with the application (no network calls, no CDN).
 * It is immutable at runtime: engagements reference tests by ID only.
 *
 * LIBRARY_VERSION must be bumped whenever definitions are added or changed so
 * engagements can report which revision they were seeded from.
 */

import type { CategoryId, Priority, TestDefinition } from '../domain/types';
import { PRIORITY_ORDER } from '../domain/types';
import { CATEGORIES } from './categories';
import { rulefacts } from '../domain/applicability';
import type { ContextFactKey } from '../domain/context';
import { isKnownStandardCode } from './references';
import { buildSearchIndex } from './searchIndex';

import { reconTests } from './tests/recon';
import { configTests, transportTests } from './tests/config';
import { authenticationTests } from './tests/authentication';
import { sessionTests } from './tests/session';
import { authorizationTests } from './tests/authorization';
import { injectionTests } from './tests/injection';
import { clientSideTests, businessLogicTests } from './tests/client-logic';
import { cryptoTests, fileTests } from './tests/crypto-file';
import { apiTests, graphqlTests } from './tests/api-graphql';
import { disclosureTests, availabilityTests, privacyTests } from './tests/disclosure-dos-privacy';
import { cloudTests, mobileTests } from './tests/cloud-mobile';

export const LIBRARY_VERSION = '1.2.0';

const CATEGORY_INDEX: Record<CategoryId, number> = Object.fromEntries(
  CATEGORIES.map((c, i) => [c.id, i]),
) as Record<CategoryId, number>;

const ALL: TestDefinition[] = [
  ...reconTests,
  ...configTests,
  ...transportTests,
  ...authenticationTests,
  ...sessionTests,
  ...authorizationTests,
  ...injectionTests,
  ...clientSideTests,
  ...businessLogicTests,
  ...cryptoTests,
  ...fileTests,
  ...apiTests,
  ...graphqlTests,
  ...disclosureTests,
  ...availabilityTests,
  ...cloudTests,
  ...mobileTests,
  ...privacyTests,
];

/** Canonical ordering used everywhere: category, then priority, then ID. */
export const TEST_LIBRARY: TestDefinition[] = [...ALL].sort(
  (a, b) =>
    CATEGORY_INDEX[a.category] - CATEGORY_INDEX[b.category] ||
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    a.id.localeCompare(b.id),
);

export const TEST_BY_ID: Map<string, TestDefinition> = new Map(
  TEST_LIBRARY.map((t) => [t.id, t]),
);

export function getTest(id: string): TestDefinition | undefined {
  return TEST_BY_ID.get(id);
}

/** Built once at module load; see src/data/searchIndex.ts. */
export const SEARCH_INDEX = buildSearchIndex(TEST_LIBRARY);

/**
 * How many tests each context fact influences. Shown next to the question so a
 * tester can see which answers actually move the checklist.
 */
export const FACT_IMPACT: Map<ContextFactKey, number> = (() => {
  const counts = new Map<ContextFactKey, number>();
  for (const test of TEST_LIBRARY) {
    for (const fact of rulefacts(test.applicability)) {
      counts.set(fact, (counts.get(fact) ?? 0) + 1);
    }
  }
  return counts;
})();

/** Canonical name + every alias, for the "did you mean" affordance in search. */
export const ALIAS_INDEX: Map<string, string> = new Map(
  TEST_LIBRARY.flatMap((t) =>
    (t.aliases ?? []).map((alias) => [alias.toLowerCase(), t.id] as [string, string]),
  ),
);

export interface LibraryStats {
  total: number;
  byCategory: Record<string, number>;
  bySubcategory: Record<string, number>;
  byPriority: Record<Priority, number>;
  aliases: number;
  contextDriven: number;
  baseline: number;
}

export function libraryStats(): LibraryStats {
  const byCategory: Record<string, number> = {};
  const bySubcategory: Record<string, number> = {};
  const byPriority: Record<Priority, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  let aliases = 0;
  let baseline = 0;
  for (const t of TEST_LIBRARY) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    bySubcategory[`${t.category}/${t.subcategory}`] =
      (bySubcategory[`${t.category}/${t.subcategory}`] ?? 0) + 1;
    byPriority[t.priority] += 1;
    aliases += t.aliases?.length ?? 0;
    if (t.applicability.kind === 'always') baseline += 1;
  }
  return {
    total: TEST_LIBRARY.length,
    byCategory,
    bySubcategory,
    byPriority,
    aliases,
    baseline,
    contextDriven: TEST_LIBRARY.length - baseline,
  };
}

/**
 * Integrity check for the knowledge base. Run by the unit tests, so a malformed
 * or duplicated entry fails the build rather than reaching a tester.
 */
export function validateLibrary(): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  /** Canonical names and aliases share one namespace — an alias must not collide. */
  const seenTerms = new Map<string, string>();
  const categoryIds = new Set(CATEGORIES.map((c) => c.id));
  const subcategoriesByCategory = new Map(
    CATEGORIES.map((c) => [c.id, new Set(c.subcategories)]),
  );
  const idPrefixByCategory = new Map(CATEGORIES.map((c) => [c.id, c.code]));

  for (const t of TEST_LIBRARY) {
    if (seenIds.has(t.id)) errors.push(`Duplicate test ID: ${t.id}`);
    seenIds.add(t.id);

    const nameKey = t.vulnerabilityName.toLowerCase();
    if (seenNames.has(nameKey)) errors.push(`Duplicate vulnerability name: ${t.vulnerabilityName}`);
    seenNames.add(nameKey);

    if (!categoryIds.has(t.category)) {
      errors.push(`${t.id}: unknown category ${t.category}`);
    } else {
      if (!subcategoriesByCategory.get(t.category)!.has(t.subcategory)) {
        errors.push(`${t.id}: subcategory "${t.subcategory}" is not declared on ${t.category}`);
      }
      const prefix = idPrefixByCategory.get(t.category)!;
      if (!t.id.startsWith(`${prefix}-`)) {
        errors.push(`${t.id}: ID prefix does not match category code ${prefix}`);
      }
    }

    if (!t.vulnerabilityName.trim()) errors.push(`${t.id}: missing vulnerability name`);
    if (t.description.trim().length < 40) errors.push(`${t.id}: description too short`);
    if (t.testingGuidance.length < 2) errors.push(`${t.id}: needs at least two guidance steps`);
    if (t.testingGuidance.some((g) => g.trim().length < 25)) {
      errors.push(`${t.id}: guidance step is too thin to be useful`);
    }
    if (!t.applicability) errors.push(`${t.id}: missing applicability rule`);

    for (const term of [t.vulnerabilityName, ...(t.aliases ?? [])]) {
      const key = term.toLowerCase();
      const owner = seenTerms.get(key);
      if (owner && owner !== t.id) {
        errors.push(`${t.id}: term "${term}" already used by ${owner}`);
      }
      seenTerms.set(key, t.id);
    }

    for (const code of [...(t.owasp ?? [])]) {
      if (!isKnownStandardCode(code)) errors.push(`${t.id}: unrecognised standard code "${code}"`);
    }
    for (const code of t.cwe ?? []) {
      if (!/^CWE-\d+$/.test(code)) errors.push(`${t.id}: malformed CWE code "${code}"`);
    }
  }
  return errors;
}
