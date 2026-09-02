/**
 * VAPT Checklist — Derived dashboard metrics
 * ---------------------------------------------------------------------------
 * Every number shown anywhere in the product is computed here from the single
 * source of truth (definitions + states). No component counts on its own.
 */

import { isFinding, isIncomplete, isResolved } from './executionState';
import type { CategoryId, ChecklistItem, Priority, TestDefinition, TestState } from './types';
import { PRIORITIES, PRIORITY_ORDER } from './types';
import { CATEGORIES } from '../data/categories';

export interface CoverageCounts {
  total: number;
  applicable: number;
  excluded: number;
  notTested: number;
  tested: number;
  na: number;
  vulnerable: number;
  notVulnerable: number;
  /** Applicable + Tested but no result recorded yet. */
  awaitingResult: number;
}

export interface GroupMetrics<K extends string = string> {
  key: K;
  label: string;
  counts: CoverageCounts;
  completion: number;
}

export interface EngagementMetrics {
  counts: CoverageCounts;
  /** (tested-with-result + N/A) / applicable, 0..1 */
  completion: number;
  /** vulnerable / (vulnerable + not vulnerable), 0..1 */
  vulnerableRate: number;
  byCategory: GroupMetrics<CategoryId>[];
  byPriority: GroupMetrics<Priority>[];
  findingsByPriority: Record<Priority, number>;
  /** Applicable, still Not Tested, ordered Critical → Low. */
  outstandingByPriority: Record<Priority, number>;
  /** Tests whose applicability the tester manually overrode. */
  manualOverrides: number;
  lastActivityAt: string | null;
}

export function emptyCounts(): CoverageCounts {
  return {
    total: 0,
    applicable: 0,
    excluded: 0,
    notTested: 0,
    tested: 0,
    na: 0,
    vulnerable: 0,
    notVulnerable: 0,
    awaitingResult: 0,
  };
}

function accumulate(counts: CoverageCounts, state: TestState): void {
  counts.total += 1;
  if (!state.applicable) {
    counts.excluded += 1;
    return;
  }
  counts.applicable += 1;
  switch (state.status) {
    case 'Not Tested':
      counts.notTested += 1;
      break;
    case 'N/A':
      counts.na += 1;
      break;
    case 'Tested':
      counts.tested += 1;
      if (state.result === 'Vulnerable') counts.vulnerable += 1;
      else if (state.result === 'Not Vulnerable') counts.notVulnerable += 1;
      if (isIncomplete(state)) counts.awaitingResult += 1;
      break;
  }
}

function completionOf(counts: CoverageCounts): number {
  if (counts.applicable === 0) return 0;
  const done = counts.na + counts.vulnerable + counts.notVulnerable;
  return done / counts.applicable;
}

export function computeMetrics(items: ChecklistItem[]): EngagementMetrics {
  const counts = emptyCounts();
  const catMap = new Map<CategoryId, CoverageCounts>();
  const priMap = new Map<Priority, CoverageCounts>();
  const findingsByPriority: Record<Priority, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const outstandingByPriority: Record<Priority, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  let manualOverrides = 0;
  let lastActivityAt: string | null = null;

  for (const { definition, state } of items) {
    accumulate(counts, state);

    if (!catMap.has(definition.category)) catMap.set(definition.category, emptyCounts());
    accumulate(catMap.get(definition.category)!, state);

    if (!priMap.has(definition.priority)) priMap.set(definition.priority, emptyCounts());
    accumulate(priMap.get(definition.priority)!, state);

    if (isFinding(state)) findingsByPriority[definition.priority] += 1;
    if (state.applicable && state.status === 'Not Tested') {
      outstandingByPriority[definition.priority] += 1;
    }
    if (state.applicabilitySource === 'manual') manualOverrides += 1;
    if (state.status !== 'Not Tested' || state.notes) {
      if (!lastActivityAt || state.updatedAt > lastActivityAt) lastActivityAt = state.updatedAt;
    }
  }

  const byCategory: GroupMetrics<CategoryId>[] = CATEGORIES.filter((c) => catMap.has(c.id)).map(
    (c) => {
      const cc = catMap.get(c.id)!;
      return { key: c.id, label: c.name, counts: cc, completion: completionOf(cc) };
    },
  );

  const byPriority: GroupMetrics<Priority>[] = PRIORITIES.filter((p) => priMap.has(p))
    .sort((a, b) => PRIORITY_ORDER[a] - PRIORITY_ORDER[b])
    .map((p) => {
      const pc = priMap.get(p)!;
      return { key: p, label: p, counts: pc, completion: completionOf(pc) };
    });

  const decided = counts.vulnerable + counts.notVulnerable;

  return {
    counts,
    completion: completionOf(counts),
    vulnerableRate: decided === 0 ? 0 : counts.vulnerable / decided,
    byCategory,
    byPriority,
    findingsByPriority,
    outstandingByPriority,
    manualOverrides,
    lastActivityAt,
  };
}

/** Findings (vulnerable tests) ordered Critical → Low, then by test ID. */
export function collectFindings(items: ChecklistItem[]): ChecklistItem[] {
  return items
    .filter((i) => isFinding(i.state))
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.definition.priority] - PRIORITY_ORDER[b.definition.priority] ||
        a.definition.id.localeCompare(b.definition.id),
    );
}

/** Highest value work remaining: applicable, not tested, ordered by priority. */
export function nextUpQueue(items: ChecklistItem[], limit = 8): ChecklistItem[] {
  return items
    .filter((i) => i.state.applicable && i.state.status === 'Not Tested')
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.definition.priority] - PRIORITY_ORDER[b.definition.priority] ||
        a.definition.id.localeCompare(b.definition.id),
    )
    .slice(0, limit);
}

export function incompleteItems(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((i) => isIncomplete(i.state));
}

export function resolvedCount(items: ChecklistItem[]): number {
  return items.filter((i) => isResolved(i.state)).length;
}

export function joinItems(
  definitions: TestDefinition[],
  states: TestState[],
): ChecklistItem[] {
  const byId = new Map(states.map((s) => [s.testId, s]));
  const out: ChecklistItem[] = [];
  for (const definition of definitions) {
    const state = byId.get(definition.id);
    if (state) out.push({ definition, state });
  }
  return out;
}
