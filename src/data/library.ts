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

export const LIBRARY_VERSION = '1.0.0';

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

export interface LibraryStats {
  total: number;
  byCategory: Record<string, number>;
  byPriority: Record<Priority, number>;
}

export function libraryStats(): LibraryStats {
  const byCategory: Record<string, number> = {};
  const byPriority: Record<Priority, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const t of TEST_LIBRARY) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    byPriority[t.priority] += 1;
  }
  return { total: TEST_LIBRARY.length, byCategory, byPriority };
}

/** Development-time integrity check: unique IDs, valid categories, content present. */
export function validateLibrary(): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const validCategories = new Set(CATEGORIES.map((c) => c.id));

  for (const t of TEST_LIBRARY) {
    if (seenIds.has(t.id)) errors.push(`Duplicate test ID: ${t.id}`);
    seenIds.add(t.id);

    const nameKey = t.vulnerabilityName.toLowerCase();
    if (seenNames.has(nameKey)) errors.push(`Duplicate vulnerability name: ${t.vulnerabilityName}`);
    seenNames.add(nameKey);

    if (!validCategories.has(t.category)) errors.push(`${t.id}: unknown category ${t.category}`);
    if (!t.vulnerabilityName.trim()) errors.push(`${t.id}: missing vulnerability name`);
    if (t.description.trim().length < 40) errors.push(`${t.id}: description too short`);
    if (t.testingGuidance.length < 2) errors.push(`${t.id}: needs at least two guidance steps`);
    if (!t.applicability) errors.push(`${t.id}: missing applicability rule`);
  }
  return errors;
}
