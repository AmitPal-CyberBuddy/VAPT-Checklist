/**
 * VAPT Checklist — Test execution state machine
 * ---------------------------------------------------------------------------
 *      Not Tested ──► Tested ──► Vulnerable | Not Vulnerable
 *                 └─► N/A
 *
 * Invariants (enforced here, nowhere else):
 *   I1. status === 'Tested'  ⇒ result !== null
 *   I2. status !== 'Tested'  ⇒ result === null
 *   I3. applicable === false ⇒ status is reset to 'Not Tested', result null
 *   I4. Any decision can be revised at any time (no terminal states).
 */

import type { TestResult, TestState, TestStatus } from './types';

export interface StateTransition {
  status?: TestStatus;
  result?: TestResult | null;
  notes?: string;
  applicable?: boolean;
  applicabilitySource?: 'auto' | 'manual';
}

export interface ValidationIssue {
  field: 'result' | 'status';
  message: string;
}

/** Returns issues that block a state from being considered complete/valid. */
export function validateState(state: Pick<TestState, 'status' | 'result'>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (state.status === 'Tested' && !state.result) {
    issues.push({ field: 'result', message: 'A result is required when status is Tested.' });
  }
  if (state.status !== 'Tested' && state.result !== null) {
    issues.push({ field: 'result', message: 'A result may only be set when status is Tested.' });
  }
  return issues;
}

/**
 * Pure reducer. Applies a transition and normalises the record so the
 * invariants above always hold.
 */
export function applyTransition(
  current: TestState,
  change: StateTransition,
  now: string = new Date().toISOString(),
): TestState {
  const next: TestState = { ...current };

  if (change.applicable !== undefined && change.applicable !== current.applicable) {
    next.applicable = change.applicable;
    next.applicabilitySource = change.applicabilitySource ?? 'manual';
    if (!change.applicable) {
      // I3 — excluded tests carry no execution state.
      next.status = 'Not Tested';
      next.result = null;
    }
  } else if (change.applicabilitySource) {
    next.applicabilitySource = change.applicabilitySource;
  }

  if (change.status !== undefined) {
    next.status = change.status;
    if (change.status === 'Tested') {
      // Preserve an existing result, otherwise wait for the tester to choose.
      next.result = change.result !== undefined ? change.result : current.result;
      next.testedAt = current.testedAt ?? now;
    } else {
      next.result = null; // I2
    }
  }

  if (change.result !== undefined && next.status === 'Tested') {
    next.result = change.result;
    next.testedAt = next.testedAt ?? now;
  }

  if (change.notes !== undefined) {
    next.notes = change.notes;
  }

  next.updatedAt = now;
  return next;
}

/** A test that a tester still has to act on. */
export function isOutstanding(state: TestState): boolean {
  return state.applicable && state.status === 'Not Tested';
}

/** Applicable + Tested but missing its mandatory result. */
export function isIncomplete(state: TestState): boolean {
  return state.applicable && state.status === 'Tested' && !state.result;
}

/** Counted as done for progress purposes: Tested (with result) or N/A. */
export function isResolved(state: TestState): boolean {
  if (!state.applicable) return false;
  if (state.status === 'N/A') return true;
  return state.status === 'Tested' && !!state.result;
}

export function isFinding(state: TestState): boolean {
  return state.applicable && state.status === 'Tested' && state.result === 'Vulnerable';
}

export function createInitialState(
  engagementId: string,
  testId: string,
  suggestedApplicable: boolean,
  now: string = new Date().toISOString(),
): TestState {
  return {
    id: stateKey(engagementId, testId),
    engagementId,
    testId,
    applicable: suggestedApplicable,
    suggestedApplicable,
    applicabilitySource: 'auto',
    status: 'Not Tested',
    result: null,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function stateKey(engagementId: string, testId: string): string {
  return `${engagementId}::${testId}`;
}
