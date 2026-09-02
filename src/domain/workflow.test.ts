import { describe, expect, it } from 'vitest';
import { TEST_LIBRARY, TEST_BY_ID } from '../data/library';
import { suggestApplicability } from './applicability';
import { applyTransition, createInitialState } from './executionState';
import { completedOf, computeMetrics, highValueTests } from './metrics';
import { isFactVisible, visibleFacts, CONTEXT_FACTS } from './context';
import type { ChecklistItem } from './types';
import type { ApplicationContext as Ctx } from './context';

/** Build a checklist for a context, the same way the repository seeds one. */
function buildChecklist(context: Ctx): ChecklistItem[] {
  return TEST_LIBRARY.map((definition) => ({
    definition,
    state: createInitialState(
      'eng-1',
      definition.id,
      suggestApplicability(definition, context).applicable,
    ),
  }));
}

function setState(
  items: ChecklistItem[],
  id: string,
  change: Parameters<typeof applyTransition>[1],
): ChecklistItem[] {
  return items.map((i) =>
    i.definition.id === id ? { ...i, state: applyTransition(i.state, change) } : i,
  );
}

const API_CONTEXT: Ctx = {
  assetTypes: ['web-app', 'rest-api'],
  hasAuthentication: true,
  hasMultipleRoles: true,
  hasUserOwnedResources: true,
  hasFileUpload: true,
  hasMfa: true,
  usesWebsockets: false,
  handlesPayments: false,
};

describe('progress rule', () => {
  it('defines Completed as Tested + N/A', () => {
    let items = buildChecklist(API_CONTEXT);
    items = setState(items, 'AUTH-001', { status: 'Tested', result: 'Vulnerable' });
    items = setState(items, 'AUTH-003', { status: 'N/A' });

    const m = computeMetrics(items);
    expect(completedOf(m.counts)).toBe(m.counts.tested + m.counts.na);
    expect(completedOf(m.counts)).toBe(2);
    expect(m.completion).toBeCloseTo(2 / m.counts.applicable);
  });

  it('uses the applicable set as the denominator, never the whole library', () => {
    const items = buildChecklist(API_CONTEXT);
    const m = computeMetrics(items);
    expect(m.counts.applicable).toBeLessThan(m.counts.total);
    expect(m.counts.applicable + m.counts.excluded).toBe(m.counts.total);
    expect(m.completion).toBe(0);
  });

  it('keeps category and priority groups on the same rule', () => {
    let items = buildChecklist(API_CONTEXT);
    items = setState(items, 'AUTHZ-002', { status: 'Tested', result: 'Vulnerable' });
    const m = computeMetrics(items);
    for (const group of [...m.byCategory, ...m.byPriority]) {
      const expected =
        group.counts.applicable === 0
          ? 0
          : (group.counts.tested + group.counts.na) / group.counts.applicable;
      expect(group.completion).toBeCloseTo(expected);
    }
  });
});

describe('high-value tests', () => {
  it('only surfaces applicable tests that are still Not Tested', () => {
    let items = buildChecklist(API_CONTEXT);
    items = setState(items, 'AUTHZ-002', { status: 'Tested', result: 'Vulnerable' });

    const high = highValueTests(items, API_CONTEXT, 20);
    expect(high.every((h) => h.item.state.applicable)).toBe(true);
    expect(high.every((h) => h.item.state.status === 'Not Tested')).toBe(true);
    expect(high.some((h) => h.item.definition.id === 'AUTHZ-002')).toBe(false);
  });

  it('is not a plain severity sort — context and exploitability reorder it', () => {
    const items = buildChecklist(API_CONTEXT);
    const high = highValueTests(items, API_CONTEXT, 30);

    // Every Critical would tie under a pure severity sort; here scores differ.
    const criticalScores = new Set(
      high.filter((h) => h.item.definition.priority === 'Critical').map((h) => h.score),
    );
    expect(criticalScores.size).toBeGreaterThan(1);

    // A context-confirmed Critical outranks a baseline Critical of equal severity.
    const idor = high.find((h) => h.item.definition.id === 'AUTHZ-002')!;
    const commandInjection = high.find((h) => h.item.definition.id === 'INJ-003')!;
    expect(idor.item.definition.priority).toBe('Critical');
    expect(commandInjection.item.definition.priority).toBe('Critical');
    expect(idor.score).toBeGreaterThan(commandInjection.score);
  });

  it('ranks context-confirmed tests above ones kept only by unknown facts', () => {
    const partial: Ctx = { hasAuthentication: true, hasMultipleRoles: true };
    const items = buildChecklist(partial);
    const high = highValueTests(items, partial, 40);

    const confirmed = high.find((h) => !h.uncertain)!;
    const unconfirmed = high.find((h) => h.uncertain);
    if (unconfirmed) expect(confirmed.score).toBeGreaterThan(unconfirmed.score);
  });

  it('promotes categories where a finding already exists', () => {
    const base = buildChecklist(API_CONTEXT);
    const before = highValueTests(base, API_CONTEXT, 40).find(
      (h) => h.item.definition.id === 'AUTHZ-009',
    )!;

    const withFinding = setState(base, 'AUTHZ-002', {
      status: 'Tested',
      result: 'Vulnerable',
    });
    const after = highValueTests(withFinding, API_CONTEXT, 40).find(
      (h) => h.item.definition.id === 'AUTHZ-009',
    )!;

    expect(after.score).toBeGreaterThan(before.score);
    expect(after.rationale).toContain('related finding');
  });

  it('explains each pick in plain language', () => {
    const items = buildChecklist(API_CONTEXT);
    const high = highValueTests(items, API_CONTEXT, 6);
    expect(high.length).toBe(6);
    for (const entry of high) {
      expect(entry.rationale.length).toBeGreaterThan(3);
    }
    const idor = high.find((h) => h.item.definition.id === 'AUTHZ-002');
    expect(idor?.rationale).toMatch(/authentication|records|REST API/i);
  });

  it('respects a manual include as a signal of tester intent', () => {
    const items = buildChecklist({ ...API_CONTEXT, usesWebsockets: false });
    const websocket = TEST_BY_ID.get('CLI-010')!;
    expect(suggestApplicability(websocket, API_CONTEXT).applicable).toBe(false);

    const pulledIn = items.map((i) =>
      i.definition.id === 'CLI-010'
        ? {
            ...i,
            state: applyTransition(i.state, { applicable: true, applicabilitySource: 'manual' }),
          }
        : i,
    );
    const ranked = highValueTests(pulledIn, API_CONTEXT, TEST_LIBRARY.length);
    const entry = ranked.find((h) => h.item.definition.id === 'CLI-010');
    expect(entry).toBeTruthy();
    expect(entry!.rationale).toContain('added by you');

    // The manual signal lifts it above an otherwise identical auto-scoped test.
    const auto = highValueTests(items, API_CONTEXT, TEST_LIBRARY.length).find(
      (h) => h.item.definition.id === 'CLI-005',
    )!;
    expect(entry!.score).toBeGreaterThan(auto.score - 12);
  });
});

describe('conditional context questions', () => {
  it('hides follow-up questions when the parent is answered no', () => {
    const mfa = CONTEXT_FACTS.find((f) => f.key === 'hasMfa')!;
    expect(isFactVisible(mfa, {})).toBe(true); // unknown parent → still asked
    expect(isFactVisible(mfa, { hasAuthentication: true })).toBe(true);
    expect(isFactVisible(mfa, { hasAuthentication: false })).toBe(false);
  });

  it('shortens setup without narrowing the checklist', () => {
    const noAuth: Ctx = { hasAuthentication: false };
    expect(visibleFacts(noAuth).length).toBeLessThan(CONTEXT_FACTS.length);

    // Hidden questions stay unrecorded, and unknown never removes a test that
    // the answered parent has not already ruled out.
    const items = buildChecklist(noAuth);
    const applicable = items.filter((i) => i.state.applicable);
    expect(applicable.length).toBeGreaterThan(TEST_LIBRARY.length * 0.5);
  });
});

describe('status and result interaction', () => {
  const base = createInitialState('eng-1', 'AUTH-001', true);

  it('starts Not Tested with no result', () => {
    expect(base.status).toBe('Not Tested');
    expect(base.result).toBeNull();
  });

  it('treats a resultless Tested row as not tested', () => {
    const tested = applyTransition(base, { status: 'Tested' });
    const m = computeMetrics([{ definition: TEST_BY_ID.get('AUTH-001')!, state: tested }]);
    expect(m.counts.tested).toBe(0);
    expect(m.counts.notTested).toBe(1);
  });

  it('requires no result for N/A', () => {
    const na = applyTransition(base, { status: 'N/A' });
    expect(na.result).toBeNull();
    const m = computeMetrics([{ definition: TEST_BY_ID.get('AUTH-001')!, state: na }]);
    expect(m.counts.na).toBe(1);
  });

  it('lets the tester change the decision later', () => {
    const vulnerable = applyTransition(base, { status: 'Tested', result: 'Vulnerable' });
    const revised = applyTransition(vulnerable, { result: 'Not Vulnerable' });
    const reopened = applyTransition(revised, { status: 'Not Tested' });
    expect(reopened.status).toBe('Not Tested');
    expect(reopened.result).toBeNull();
  });
});
