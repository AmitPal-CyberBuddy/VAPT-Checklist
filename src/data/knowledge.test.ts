import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_BY_ID, SUBCATEGORIES } from './categories';
import { SEARCH_INDEX, TEST_LIBRARY, libraryStats, validateLibrary } from './library';
import { isKnownStandardCode, resolveReferences } from './references';
import { parseQuery, relevance } from './searchIndex';
import { suggestApplicability, rulefacts } from '../domain/applicability';
import { CONTEXT_FACTS, FACT_BY_KEY } from '../domain/context';
import type { TestDefinition } from '../domain/types';

const byId = (id: string) => TEST_LIBRARY.find((t) => t.id === id)!;

function search(query: string): TestDefinition[] {
  const terms = parseQuery(query);
  return TEST_LIBRARY.filter((t) => {
    const entry = SEARCH_INDEX.get(t.id);
    return terms.every((term) => entry?.haystack.includes(term));
  }).sort((a, b) => relevance(SEARCH_INDEX.get(b.id), terms) - relevance(SEARCH_INDEX.get(a.id), terms));
}

describe('taxonomy', () => {
  it('validates cleanly, including subcategories and standards codes', () => {
    expect(validateLibrary()).toEqual([]);
  });

  it('gives every test a subcategory declared on its category', () => {
    for (const t of TEST_LIBRARY) {
      expect(CATEGORY_BY_ID[t.category].subcategories).toContain(t.subcategory);
    }
  });

  it('has no empty subcategory — every declared bucket is used', () => {
    const used = new Set(TEST_LIBRARY.map((t) => `${t.category}/${t.subcategory}`));
    const unused = SUBCATEGORIES.filter(
      (s) => !used.has(`${s.category}/${s.subcategory}`),
    ).map((s) => `${s.category}/${s.subcategory}`);
    expect(unused).toEqual([]);
  });

  it('keeps categories to a workable size', () => {
    for (const category of CATEGORIES) {
      expect(category.subcategories.length).toBeGreaterThanOrEqual(3);
      expect(category.subcategories.length).toBeLessThanOrEqual(10);
    }
  });
});

describe('vulnerability naming and aliases', () => {
  it('uses canonical names plus aliases rather than duplicate tests', () => {
    const idor = byId('AUTHZ-002');
    expect(idor.vulnerabilityName).toBe('IDOR / Broken Object Level Authorization (BOLA)');
    expect(idor.aliases).toContain('IDOR');
    expect(idor.aliases).toContain('BOLA');
    expect(idor.aliases).toContain('Insecure Direct Object Reference');
  });

  it('shares one namespace between names and aliases', () => {
    const terms = new Map<string, string>();
    for (const t of TEST_LIBRARY) {
      for (const term of [t.vulnerabilityName, ...(t.aliases ?? [])]) {
        const key = term.toLowerCase();
        expect(terms.get(key) ?? t.id).toBe(t.id);
        terms.set(key, t.id);
      }
    }
  });

  it('gives the overwhelming majority of tests at least one alias', () => {
    const withAliases = TEST_LIBRARY.filter((t) => (t.aliases?.length ?? 0) > 0);
    expect(withAliases.length / TEST_LIBRARY.length).toBeGreaterThan(0.95);
    expect(libraryStats().aliases).toBeGreaterThan(400);
  });
});

describe('search', () => {
  it('finds a test by its alias, not just its title', () => {
    expect(search('bola').map((t) => t.id)).toContain('AUTHZ-002');
    expect(search('cswsh').map((t) => t.id)).toContain('CLI-010');
    expect(search('zip slip').map((t) => t.id)).toContain('FILE-004');
    expect(search('billion laughs').map((t) => t.id)).toContain('DOS-003');
  });

  it('finds a test by ID, CWE, OWASP code, tag and guidance text', () => {
    expect(search('auth-001').map((t) => t.id)).toEqual(['AUTH-001']);
    expect(search('cwe-89').map((t) => t.id)).toContain('INJ-001');
    expect(search('api1:2023').map((t) => t.id)).toContain('AUTHZ-002');
    expect(search('collaborator').map((t) => t.id)).toContain('INJ-010');
    expect(search('mfa').length).toBeGreaterThan(1);
  });

  it('searches subcategory names', () => {
    const hits = search('tenant isolation');
    expect(hits.map((t) => t.id)).toContain('AUTHZ-008');
  });

  it('applies AND semantics across terms and ranks title matches first', () => {
    const hits = search('sql injection');
    expect(hits[0].id).toBe('INJ-001');
    expect(hits.every((t) => SEARCH_INDEX.get(t.id)!.haystack.includes('sql'))).toBe(true);
  });

  it('builds the index once and covers every test', () => {
    expect(SEARCH_INDEX.size).toBe(TEST_LIBRARY.length);
  });
});

describe('references', () => {
  it('resolves OWASP and CWE codes to canonical URLs', () => {
    const refs = resolveReferences(byId('INJ-001'));
    const labels = refs.map((r) => r.label);
    expect(labels).toContain('A03:2021');
    expect(labels).toContain('CWE-89');
    expect(refs.every((r) => r.url.startsWith('https://'))).toBe(true);
    expect(refs.find((r) => r.label === 'CWE-89')!.url).toContain('/89.html');
  });

  it('rejects placeholder or wildcard standard codes', () => {
    expect(isKnownStandardCode('WSTG-ATHN-*')).toBe(false);
    expect(isKnownStandardCode('-')).toBe(false);
    expect(isKnownStandardCode('WSTG-ATHN-04')).toBe(true);
    expect(isKnownStandardCode('API1:2023')).toBe(true);
    expect(isKnownStandardCode('MASVS-STORAGE-1')).toBe(true);
  });

  it('gives every test at least one resolvable reference', () => {
    const without = TEST_LIBRARY.filter((t) => resolveReferences(t).length === 0);
    expect(without.map((t) => t.id)).toEqual([]);
  });
});

describe('applicability rules', () => {
  it('drives most of the library from context rather than blanket inclusion', () => {
    const stats = libraryStats();
    expect(stats.contextDriven / stats.total).toBeGreaterThan(0.8);
    expect(stats.baseline).toBeGreaterThan(0); // baseline coverage still exists
  });

  it('references only facts that exist in the context schema', () => {
    const known = new Set(CONTEXT_FACTS.map((f) => f.key));
    for (const t of TEST_LIBRARY) {
      for (const fact of rulefacts(t.applicability)) {
        expect(known.has(fact), `${t.id} uses unknown fact ${fact}`).toBe(true);
      }
    }
  });

  it('gives each test its own rule rather than a category-wide one', () => {
    const fileTests = TEST_LIBRARY.filter((t) => t.category === 'file-handling');
    const shapes = new Set(fileTests.map((t) => JSON.stringify(t.applicability)));
    expect(shapes.size).toBeGreaterThan(1);

    // The specific examples called out by the product brief.
    expect(byId('FILE-001').applicability).toEqual({
      kind: 'fact',
      fact: 'hasFileUpload',
      equals: true,
    });
    expect(byId('CLI-010').applicability).toEqual({
      kind: 'fact',
      fact: 'usesWebsockets',
      equals: true,
    });
    expect(byId('LOGIC-002').applicability.kind).toBe('any');
    expect(rulefacts(byId('AUTH-013').applicability)).toContain('authMechanisms');
  });

  it('every non-metadata context fact drives at least one test', () => {
    const used = new Set<string>();
    for (const t of TEST_LIBRARY) rulefacts(t.applicability).forEach((f) => used.add(f));
    const dead = CONTEXT_FACTS.filter((f) => !f.metadataOnly && !used.has(f.key)).map((f) => f.key);
    expect(dead).toEqual([]);
  });

  it('never lets a rule depend on a metadata-only fact', () => {
    const metadata = new Set(CONTEXT_FACTS.filter((f) => f.metadataOnly).map((f) => f.key));
    for (const t of TEST_LIBRARY) {
      for (const fact of rulefacts(t.applicability)) {
        expect(metadata.has(fact), `${t.id} depends on metadata fact ${fact}`).toBe(false);
      }
    }
  });
});

describe('applicability explanation', () => {
  it('explains inclusion with the conditions that were met', () => {
    const suggestion = suggestApplicability(byId('AUTHZ-002'), {
      hasAuthentication: true,
      assetTypes: ['rest-api'],
      hasMultipleRoles: true,
      hasUserOwnedResources: true,
    });
    expect(suggestion.applicable).toBe(true);
    expect(suggestion.uncertain).toBe(false);
    const met = suggestion.conditions.filter((c) => c.outcome === 'met').map((c) => c.label);
    expect(met).toContain('Application has authentication');
    expect(met).toContain('Users own individual records or objects');
    expect(suggestion.summary.startsWith('Applicable because')).toBe(true);
  });

  it('explains exclusion with the conditions that were not met', () => {
    const suggestion = suggestApplicability(byId('CLI-010'), { usesWebsockets: false });
    expect(suggestion.applicable).toBe(false);
    expect(suggestion.conditions[0]).toMatchObject({
      outcome: 'unmet',
      label: 'Uses WebSockets or SSE',
      detail: 'No',
    });
  });

  it('marks unrecorded facts as unknown and keeps the test in scope', () => {
    const suggestion = suggestApplicability(byId('CLI-010'), {});
    expect(suggestion.applicable).toBe(true);
    expect(suggestion.uncertain).toBe(true);
    expect(suggestion.conditions[0].outcome).toBe('unknown');
    expect(suggestion.conditions[0].detail).toBe('Not recorded');
  });

  it('reports a partially satisfied OR rule honestly', () => {
    const suggestion = suggestApplicability(byId('AUTHZ-002'), {
      hasAuthentication: true,
      hasUserOwnedResources: false,
      hasMultiTenancy: false,
      assetTypes: ['rest-api'],
    });
    expect(suggestion.applicable).toBe(true);
    const outcomes = suggestion.conditions.map((c) => c.outcome);
    expect(outcomes).toContain('met');
    expect(outcomes).toContain('unmet');
  });

  it('labels conditions with the human fact label from the schema', () => {
    for (const t of TEST_LIBRARY.slice(0, 40)) {
      for (const condition of suggestApplicability(t, {}).conditions) {
        expect(FACT_BY_KEY[condition.fact]).toBeTruthy();
        expect(condition.label.length).toBeGreaterThan(2);
      }
    }
  });
});

describe('conservative filtering', () => {
  it('keeps a large checklist when nothing about the target is known', () => {
    const applicable = TEST_LIBRARY.filter((t) => suggestApplicability(t, {}).applicable);
    expect(applicable.length).toBe(TEST_LIBRARY.length);
  });

  it('narrows meaningfully once the target is described', () => {
    const context = {
      assetTypes: ['web-app'],
      hasAuthentication: true,
      hasMfa: false,
      hasFileUpload: false,
      usesWebsockets: false,
      handlesPayments: false,
      parsesXml: false,
      usesSerialization: false,
      usesTemplating: false,
      hasMultiTenancy: false,
      hasSubdomains: false,
      usesContainers: false,
      hasSelfRegistration: false,
      hasPasswordReset: false,
      hasDataExport: false,
      hasEmailNotifications: false,
    };
    const applicable = TEST_LIBRARY.filter((t) => suggestApplicability(t, context).applicable);
    // Focused, but never so aggressive that whole areas disappear.
    expect(applicable.length).toBeLessThan(TEST_LIBRARY.length * 0.8);
    expect(applicable.length).toBeGreaterThan(TEST_LIBRARY.length * 0.4);

    const categories = new Set(applicable.map((t) => t.category));
    for (const required of [
      'authentication',
      'session',
      'authorization',
      'input-validation',
      'client-side',
      'business-logic',
      'cryptography',
      'disclosure',
    ]) {
      expect(categories.has(required as never), `${required} coverage lost`).toBe(true);
    }
  });

  it('never excludes a critical test on unknown facts alone', () => {
    const criticals = TEST_LIBRARY.filter((t) => t.priority === 'Critical');
    expect(criticals.every((t) => suggestApplicability(t, {}).applicable)).toBe(true);
  });
});
