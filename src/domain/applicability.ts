/**
 * VAPT Checklist — Applicability engine
 * ---------------------------------------------------------------------------
 * Evaluates a TestDefinition's declarative rule against an ApplicationContext.
 *
 * Product principle: *the tester remains the final authority.*
 * Therefore the engine is deliberately conservative:
 *
 *   - It returns a SUGGESTION, never a verdict.
 *   - Unknown facts resolve to `unknown`, and an unknown result is treated as
 *     "include, but flag as uncertain" — a missed test is worse than an extra.
 *   - Every suggestion carries the individual conditions that produced it, so
 *     the UI can show "Applicable because: ✓ API available, ✓ Multiple roles".
 */

import type { ApplicabilityRule, TestDefinition } from './types';
import {
  FACT_BY_KEY,
  formatFactValue,
  type ApplicationContext,
  type ContextFactKey,
} from './context';

export type Trilean = true | false | 'unknown';

/** Outcome of one leaf condition inside a rule. */
export type ConditionOutcome = 'met' | 'unmet' | 'unknown';

export interface ApplicabilityCondition {
  outcome: ConditionOutcome;
  /** Short, positive phrasing: "File upload", "Authentication mechanisms: JWT". */
  label: string;
  /** What the engagement actually recorded for the underlying fact. */
  detail: string;
  fact: ContextFactKey;
}

export interface ApplicabilitySuggestion {
  applicable: boolean;
  /** True when the decision relied on facts the tester has not recorded. */
  uncertain: boolean;
  /** Leaf conditions with their individual outcomes, for explanation UI. */
  conditions: ApplicabilityCondition[];
  /** One-line human summary, used in exports and tooltips. */
  summary: string;
  /** Flat reason lines (condition label + detail). */
  reasons: string[];
}

function isUnset(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function and(values: Trilean[]): Trilean {
  if (values.some((v) => v === false)) return false;
  if (values.some((v) => v === 'unknown')) return 'unknown';
  return true;
}

function or(values: Trilean[]): Trilean {
  if (values.some((v) => v === true)) return true;
  if (values.some((v) => v === 'unknown')) return 'unknown';
  return false;
}

function not(value: Trilean): Trilean {
  if (value === 'unknown') return 'unknown';
  return !value;
}

function factLabel(fact: ContextFactKey): string {
  return FACT_BY_KEY[fact]?.label ?? fact;
}

function optionLabel(fact: ContextFactKey, value: string): string {
  return FACT_BY_KEY[fact]?.options?.find((o) => o.value === value)?.label ?? value;
}

function conditionLabel(rule: ApplicabilityRule & { kind: 'fact' | 'includes' }): string {
  if (rule.kind === 'fact') {
    if (rule.equals === true) return factLabel(rule.fact);
    if (rule.equals === false) return `No ${factLabel(rule.fact).toLowerCase()}`;
    return `${factLabel(rule.fact)}: ${optionLabel(rule.fact, rule.equals)}`;
  }
  return `${factLabel(rule.fact)}: ${rule.anyOf.map((v) => optionLabel(rule.fact, v)).join(' or ')}`;
}

function outcomeOf(value: Trilean): ConditionOutcome {
  if (value === 'unknown') return 'unknown';
  return value ? 'met' : 'unmet';
}

function flip(outcome: ConditionOutcome): ConditionOutcome {
  if (outcome === 'unknown') return 'unknown';
  return outcome === 'met' ? 'unmet' : 'met';
}

/** Core tri-state evaluation, collecting leaf conditions as it goes. */
function evaluate(
  rule: ApplicabilityRule,
  context: ApplicationContext,
  conditions: ApplicabilityCondition[],
): Trilean {
  switch (rule.kind) {
    case 'always':
      return true;

    case 'fact': {
      const value = context[rule.fact];
      const result: Trilean = isUnset(value)
        ? 'unknown'
        : Array.isArray(value)
          ? value.includes(String(rule.equals))
          : value === rule.equals;
      conditions.push({
        outcome: outcomeOf(result),
        label: conditionLabel(rule),
        detail: isUnset(value) ? 'Not recorded' : formatFactValue(rule.fact, value),
        fact: rule.fact,
      });
      return result;
    }

    case 'includes': {
      const value = context[rule.fact];
      let result: Trilean;
      if (isUnset(value)) {
        result = 'unknown';
      } else {
        const list = Array.isArray(value) ? value : [String(value)];
        result = rule.anyOf.some((v) => list.includes(v));
      }
      conditions.push({
        outcome: outcomeOf(result),
        label: conditionLabel(rule),
        detail: isUnset(value) ? 'Not recorded' : formatFactValue(rule.fact, value),
        fact: rule.fact,
      });
      return result;
    }

    case 'all':
      return and(rule.rules.map((r) => evaluate(r, context, conditions)));

    case 'any':
      return or(rule.rules.map((r) => evaluate(r, context, conditions)));

    case 'not': {
      const before = conditions.length;
      const result = not(evaluate(rule.rule, context, conditions));
      for (let i = before; i < conditions.length; i += 1) {
        conditions[i] = { ...conditions[i], outcome: flip(conditions[i].outcome) };
      }
      return result;
    }

    default:
      return 'unknown';
  }
}

function dedupe(conditions: ApplicabilityCondition[]): ApplicabilityCondition[] {
  const seen = new Set<string>();
  return conditions.filter((c) => {
    const key = `${c.label}|${c.outcome}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Suggest whether a test belongs in this engagement.
 * `unknown` resolves to applicable=true, uncertain=true.
 */
export function suggestApplicability(
  definition: TestDefinition,
  context: ApplicationContext,
): ApplicabilitySuggestion {
  if (definition.applicability.kind === 'always') {
    return {
      applicable: true,
      uncertain: false,
      conditions: [],
      summary: 'Baseline test — applies to every engagement',
      reasons: ['Baseline test — applies to every engagement'],
    };
  }

  const collected: ApplicabilityCondition[] = [];
  const outcome = evaluate(definition.applicability, context, collected);
  const conditions = dedupe(collected);
  const reasons = conditions.map((c) => `${c.label} (${c.detail})`);

  if (outcome === 'unknown') {
    return {
      applicable: true,
      uncertain: true,
      conditions,
      summary: 'Kept in scope — the application context does not yet rule it out',
      reasons: ['Kept in scope because the application context is incomplete', ...reasons],
    };
  }

  return {
    applicable: outcome,
    uncertain: false,
    conditions,
    summary: outcome
      ? `Applicable because ${conditions
          .filter((c) => c.outcome === 'met')
          .map((c) => c.label.toLowerCase())
          .join(', ')}`
      : `Not applicable — ${conditions
          .filter((c) => c.outcome === 'unmet')
          .map((c) => c.label.toLowerCase())
          .join(', ')} not present`,
    reasons,
  };
}

/** Batch helper used when creating or re-syncing an engagement. */
export function suggestAll(
  definitions: TestDefinition[],
  context: ApplicationContext,
): Map<string, ApplicabilitySuggestion> {
  const out = new Map<string, ApplicabilitySuggestion>();
  for (const def of definitions) {
    out.set(def.id, suggestApplicability(def, context));
  }
  return out;
}

/* ------------------------------ rule helpers ------------------------------ */

export const rule = {
  always: (): ApplicabilityRule => ({ kind: 'always' }),
  is: (fact: ContextFactKey, equals: boolean | string = true): ApplicabilityRule => ({
    kind: 'fact',
    fact,
    equals,
  }),
  includes: (fact: ContextFactKey, ...anyOf: string[]): ApplicabilityRule => ({
    kind: 'includes',
    fact,
    anyOf,
  }),
  all: (...rules: ApplicabilityRule[]): ApplicabilityRule => ({ kind: 'all', rules }),
  any: (...rules: ApplicabilityRule[]): ApplicabilityRule => ({ kind: 'any', rules }),
  not: (r: ApplicabilityRule): ApplicabilityRule => ({ kind: 'not', rule: r }),
};

/** Render a rule as a compact readable string (test drawer + export). */
export function describeRule(r: ApplicabilityRule): string {
  switch (r.kind) {
    case 'always':
      return 'Always applicable';
    case 'fact':
      return `${factLabel(r.fact)} = ${
        typeof r.equals === 'boolean' ? (r.equals ? 'Yes' : 'No') : optionLabel(r.fact, r.equals)
      }`;
    case 'includes':
      return `${factLabel(r.fact)} includes ${r.anyOf.map((v) => optionLabel(r.fact, v)).join(' or ')}`;
    case 'all':
      return r.rules.map(describeRule).join(' AND ');
    case 'any':
      return `(${r.rules.map(describeRule).join(' OR ')})`;
    case 'not':
      return `NOT (${describeRule(r.rule)})`;
    default:
      return 'Unknown rule';
  }
}

/** Every context fact a rule depends on — used to highlight relevant questions. */
export function rulefacts(r: ApplicabilityRule, out: Set<ContextFactKey> = new Set()) {
  switch (r.kind) {
    case 'fact':
    case 'includes':
      out.add(r.fact);
      break;
    case 'all':
    case 'any':
      r.rules.forEach((child) => rulefacts(child, out));
      break;
    case 'not':
      rulefacts(r.rule, out);
      break;
    default:
      break;
  }
  return out;
}
