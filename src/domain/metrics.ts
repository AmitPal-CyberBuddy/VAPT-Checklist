/**
 * VAPT Checklist — Derived dashboard metrics
 * ---------------------------------------------------------------------------
 * Every number shown anywhere in the product is computed here from the single
 * source of truth (definitions + states). No component counts on its own.
 */

import { isFinding, isResolved } from './executionState';
import type { CategoryId, ChecklistItem, Priority, TestDefinition, TestState } from './types';
import { PRIORITIES, PRIORITY_ORDER } from './types';
import { CATEGORIES } from '../data/categories';
import { suggestApplicability } from './applicability';
import type { ApplicationContext } from './context';

export interface CoverageCounts {
  total: number;
  applicable: number;
  excluded: number;
  notTested: number;
  tested: number;
  na: number;
  vulnerable: number;
  notVulnerable: number;
}

export interface GroupMetrics<K extends string = string> {
  key: K;
  label: string;
  counts: CoverageCounts;
  completion: number;
}

export interface EngagementMetrics {
  counts: CoverageCounts;
  /**
   * Progress = Completed / Total Applicable, where Completed = Tested + N/A.
   * This single definition is used by every screen and by the Excel export.
   * `counts.awaitingResult` separately flags Tested rows with no result yet —
   * a data-quality signal, not a different progress number.
   */
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
    case 'N/A':
      counts.na += 1;
      break;
    case 'Tested':
      // Defensive: `Tested` always carries a result (the repository refuses to
      // write otherwise), but a row from an older build might not. Counting it
      // as Not Tested keeps both identities exact no matter what is on disk:
      //   applicable = notTested + tested + na
      //   tested     = vulnerable + notVulnerable
      if (state.result === 'Vulnerable') {
        counts.tested += 1;
        counts.vulnerable += 1;
      } else if (state.result === 'Not Vulnerable') {
        counts.tested += 1;
        counts.notVulnerable += 1;
      } else {
        counts.notTested += 1;
      }
      break;
    // 'Not Tested' and anything unrecognised (a row corrupted on disk, or one
    // written by a future build) count as Not Tested, so the identities hold
    // for whatever is actually in the database.
    default:
      counts.notTested += 1;
  }
}

/** The identities the product guarantees. Exposed so tests can assert them. */
export function countsAreConsistent(counts: CoverageCounts): boolean {
  return (
    counts.applicable === counts.notTested + counts.tested + counts.na &&
    counts.tested === counts.vulnerable + counts.notVulnerable &&
    counts.total === counts.applicable + counts.excluded
  );
}

/** Completed = Tested + N/A. The one progress formula in the product. */
export function completedOf(counts: CoverageCounts): number {
  return counts.tested + counts.na;
}

function completionOf(counts: CoverageCounts): number {
  if (counts.applicable === 0) return 0;
  return completedOf(counts) / counts.applicable;
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

/* ---------------------------------------------------------------- high value */

/**
 * High-value tests: what this tester should do next on *this* application.
 *
 * Deliberately not "sort by severity". Severity is the starting point, then the
 * score reflects how strongly the engagement context points at the test, how
 * exploitable the category tends to be, and what has already been found:
 *
 *   priority weight          Critical 100 · High 70 · Medium 40 · Low 15
 *   + confirmed context      +10 per explicitly recorded condition (max +30)
 *   - unconfirmed            −30 when the test is only in scope because facts
 *                            are unknown (the context does not point at it)
 *   + exploitability         +0..20 by category (authz/injection high,
 *                            recon/privacy low)
 *   + corroborating finding  +15 when the same category already has a finding
 *   + tester intent          +12 when the tester manually pulled it into scope
 *   - baseline               −8 for tests that apply to every engagement
 */
const CATEGORY_EXPLOITABILITY: Partial<Record<CategoryId, number>> = {
  authorization: 20,
  'input-validation': 20,
  authentication: 18,
  api: 16,
  'file-handling': 16,
  session: 14,
  graphql: 12,
  'business-logic': 12,
  cryptography: 10,
  cloud: 10,
  'client-side': 8,
  mobile: 8,
  config: 6,
  transport: 4,
  disclosure: 4,
  availability: 4,
  privacy: 2,
  recon: 0,
};

const PRIORITY_WEIGHT: Record<Priority, number> = {
  Critical: 100,
  High: 70,
  Medium: 40,
  Low: 15,
};

export interface HighValueTest {
  item: ChecklistItem;
  score: number;
  /** Short "why this one" line, e.g. "API + Multiple user roles". */
  rationale: string;
  /** True when it is in scope only because the context is incomplete. */
  uncertain: boolean;
}

export function highValueTests(
  items: ChecklistItem[],
  context: ApplicationContext,
  limit = 6,
): HighValueTest[] {
  const findingCategories = new Set(
    items.filter((i) => isFinding(i.state)).map((i) => i.definition.category),
  );

  const scored: HighValueTest[] = [];

  for (const item of items) {
    const { definition, state } = item;
    if (!state.applicable || state.status !== 'Not Tested') continue;

    const suggestion = suggestApplicability(definition, context);
    const met = suggestion.conditions.filter((c) => c.outcome === 'met');

    let score = PRIORITY_WEIGHT[definition.priority];
    score += Math.min(met.length * 10, 30);
    if (suggestion.uncertain) score -= 30;
    score += CATEGORY_EXPLOITABILITY[definition.category] ?? 5;
    if (findingCategories.has(definition.category)) score += 15;
    if (state.applicabilitySource === 'manual') score += 12;
    if (definition.applicability.kind === 'always') score -= 8;

    const reasons: string[] = [];
    if (met.length > 0) reasons.push(met.slice(0, 2).map((c) => c.label).join(' + '));
    if (findingCategories.has(definition.category)) reasons.push('related finding in category');
    if (state.applicabilitySource === 'manual') reasons.push('added by you');
    if (reasons.length === 0) {
      reasons.push(suggestion.uncertain ? 'context incomplete' : 'baseline coverage');
    }

    scored.push({
      item,
      score,
      rationale: reasons.join(' · '),
      uncertain: suggestion.uncertain,
    });
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        PRIORITY_ORDER[a.item.definition.priority] - PRIORITY_ORDER[b.item.definition.priority] ||
        a.item.definition.id.localeCompare(b.item.definition.id),
    )
    .slice(0, limit);
}

/** Plain outstanding queue: applicable, not tested, ordered by priority. */
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
