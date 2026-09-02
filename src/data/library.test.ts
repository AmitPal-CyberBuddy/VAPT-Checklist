import { describe, expect, it } from 'vitest';
import { LIBRARY_VERSION, TEST_LIBRARY, validateLibrary } from './library';
import { suggestApplicability } from '../domain/applicability';
import { applyTransition, createInitialState, validateState } from '../domain/executionState';
import { computeMetrics } from '../domain/metrics';
import type { ChecklistItem } from '../domain/types';

describe('test library', () => {
  it('passes integrity validation', () => {
    expect(validateLibrary()).toEqual([]);
  });

  it('has a meaningful number of tests', () => {
    expect(TEST_LIBRARY.length).toBeGreaterThan(120);
  });

  it('exposes a version', () => {
    expect(LIBRARY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('never uses generic task-style names', () => {
    const banned = /^(test|check|perform|verify|review|assess)\b/i;
    const offenders = TEST_LIBRARY.filter((t) => banned.test(t.vulnerabilityName));
    expect(offenders.map((t) => t.id)).toEqual([]);
  });
});

describe('applicability engine', () => {
  it('includes baseline tests regardless of context', () => {
    const always = TEST_LIBRARY.find((t) => t.applicability.kind === 'always')!;
    expect(suggestApplicability(always, {}).applicable).toBe(true);
  });

  it('treats unknown facts as applicable but uncertain', () => {
    const upload = TEST_LIBRARY.find((t) => t.id === 'FILE-001')!;
    const s = suggestApplicability(upload, {});
    expect(s.applicable).toBe(true);
    expect(s.uncertain).toBe(true);
  });

  it('excludes tests whose fact is explicitly false', () => {
    const upload = TEST_LIBRARY.find((t) => t.id === 'FILE-001')!;
    const s = suggestApplicability(upload, { hasFileUpload: false });
    expect(s.applicable).toBe(false);
    expect(s.uncertain).toBe(false);
  });

  it('matches multi-select facts', () => {
    const gql = TEST_LIBRARY.find((t) => t.id === 'GQL-001')!;
    expect(suggestApplicability(gql, { assetTypes: ['web-app'] }).applicable).toBe(false);
    expect(suggestApplicability(gql, { assetTypes: ['graphql-api'] }).applicable).toBe(true);
  });
});

describe('execution state machine', () => {
  const base = createInitialState('eng-1', 'AUTH-001', true, '2026-01-01T00:00:00.000Z');

  it('starts as Not Tested with no result', () => {
    expect(base.status).toBe('Not Tested');
    expect(base.result).toBeNull();
  });

  it('requires a result once tested', () => {
    const tested = applyTransition(base, { status: 'Tested' });
    expect(validateState(tested)).toHaveLength(1);
    const withResult = applyTransition(tested, { result: 'Vulnerable' });
    expect(validateState(withResult)).toHaveLength(0);
  });

  it('clears the result when moving away from Tested', () => {
    const vulnerable = applyTransition(applyTransition(base, { status: 'Tested' }), {
      result: 'Not Vulnerable',
    });
    const na = applyTransition(vulnerable, { status: 'N/A' });
    expect(na.result).toBeNull();
    expect(validateState(na)).toHaveLength(0);
  });

  it('resets execution state when marked not applicable', () => {
    const vulnerable = applyTransition(applyTransition(base, { status: 'Tested' }), {
      result: 'Vulnerable',
    });
    const excluded = applyTransition(vulnerable, { applicable: false });
    expect(excluded.status).toBe('Not Tested');
    expect(excluded.result).toBeNull();
    expect(excluded.applicabilitySource).toBe('manual');
  });

  it('allows decisions to be revised', () => {
    const a = applyTransition(base, { status: 'Tested', result: 'Vulnerable' });
    const b = applyTransition(a, { result: 'Not Vulnerable' });
    const c = applyTransition(b, { status: 'Not Tested' });
    expect(c.status).toBe('Not Tested');
    expect(c.result).toBeNull();
  });
});

describe('metrics', () => {
  function item(id: string, mutate: (s: ReturnType<typeof createInitialState>) => ReturnType<typeof createInitialState>): ChecklistItem {
    const definition = TEST_LIBRARY.find((t) => t.id === id)!;
    return { definition, state: mutate(createInitialState('eng-1', id, true)) };
  }

  it('computes completion from resolved applicable tests', () => {
    const items = [
      item('AUTH-001', (s) => applyTransition(s, { status: 'Tested', result: 'Vulnerable' })),
      item('AUTH-003', (s) => applyTransition(s, { status: 'N/A' })),
      item('AUTH-004', (s) => s),
      item('AUTH-005', (s) => applyTransition(s, { applicable: false })),
    ];
    const m = computeMetrics(items);
    expect(m.counts.total).toBe(4);
    expect(m.counts.applicable).toBe(3);
    expect(m.counts.excluded).toBe(1);
    expect(m.completion).toBeCloseTo(2 / 3);
    expect(m.counts.vulnerable).toBe(1);
  });

  it('follows the product rule Completed = Tested + N/A', () => {
    const items = [
      item('AUTH-001', (s) => applyTransition(s, { status: 'Tested', result: 'Vulnerable' })),
      item('AUTH-003', (s) => applyTransition(s, { status: 'N/A' })),
      item('AUTH-004', (s) => s),
    ];
    const m = computeMetrics(items);
    expect(m.counts.tested + m.counts.na).toBe(2);
    expect(m.completion).toBeCloseTo(2 / 3);
  });

  it('still flags Tested rows with no result as a data-quality issue', () => {
    const items = [item('AUTH-001', (s) => applyTransition(s, { status: 'Tested' }))];
    const m = computeMetrics(items);
    // Counted as completed (status is Tested) but surfaced for follow-up.
    expect(m.completion).toBe(1);
    expect(m.counts.awaitingResult).toBe(1);
  });
});
