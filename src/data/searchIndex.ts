/**
 * VAPT Checklist — Search index
 * ---------------------------------------------------------------------------
 * Search must stay instant across the whole library while a tester types, and
 * must match on every field the product promises: vulnerability name, test ID,
 * category, subcategory, aliases, tags, description and testing guidance.
 *
 * Rather than rebuilding a lowercase haystack per keystroke (184 tests ×
 * ~1.5 kB of prose), the index is built once at module load and reused. Notes
 * live in engagement state, so they are matched separately by the caller.
 */

import type { TestDefinition } from '../domain/types';
import { CATEGORY_BY_ID } from './categories';

export interface SearchEntry {
  id: string;
  /** Everything searchable, lowercased and space-joined. */
  haystack: string;
  /** Lowercased name, used to rank exact/prefix matches first. */
  name: string;
}

function buildEntry(definition: TestDefinition): SearchEntry {
  const parts = [
    definition.id,
    definition.vulnerabilityName,
    ...(definition.aliases ?? []),
    CATEGORY_BY_ID[definition.category]?.name ?? definition.category,
    definition.subcategory,
    definition.priority,
    definition.description,
    ...definition.testingGuidance,
    ...(definition.tags ?? []),
    ...(definition.owasp ?? []),
    ...(definition.cwe ?? []),
  ];
  return {
    id: definition.id,
    haystack: parts.join(' \u0001 ').toLowerCase(),
    name: definition.vulnerabilityName.toLowerCase(),
  };
}

export function buildSearchIndex(definitions: TestDefinition[]): Map<string, SearchEntry> {
  return new Map(definitions.map((d) => [d.id, buildEntry(d)]));
}

/**
 * Every whitespace-separated term must appear somewhere in the entry (AND
 * semantics), which is what testers expect from "jwt bypass".
 */
export function matchesQuery(entry: SearchEntry | undefined, terms: string[]): boolean {
  if (terms.length === 0) return true;
  if (!entry) return false;
  return terms.every((term) => entry.haystack.includes(term));
}

export function parseQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Ranking: name match beats alias/description match, then library order. */
export function relevance(entry: SearchEntry | undefined, terms: string[]): number {
  if (!entry || terms.length === 0) return 0;
  const joined = terms.join(' ');
  if (entry.name === joined) return 3;
  if (entry.name.startsWith(joined)) return 2;
  if (entry.name.includes(joined)) return 1;
  return 0;
}
