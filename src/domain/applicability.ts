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
 *   - Every suggestion carries human readable reasons for transparency.
 */

import type { ApplicabilityRule, TestDefinition } from './types';
import { FACT_BY_KEY, formatFactValue, type ApplicationContext, type ContextFactKey } from './context';

export type Trilean = true | false | 'unknown';

export interface ApplicabilitySuggestion {
  applicable: boolean;
  /** True when the decision relied on facts the tester has not recorded. */
  uncertain: boolean;
  /** Human readable justification lines. */
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

/** Core tri-state evaluation with reason collection. */
function evaluate(
  rule: ApplicabilityRule,
  context: ApplicationContext,
  reasons: string[],
): Trilean {
  switch (rule.kind) {
    case 'always':
      return true;

    case 'fact': {
      const value = context[rule.fact];
      if (isUnset(value)) {
        reasons.push(`${factLabel(rule.fact)} is not recorded`);
        return 'unknown';
      }
      const matches = Array.isArray(value)
        ? value.includes(String(rule.equals))
        : value === rule.equals;
      reasons.push(
        `${factLabel(rule.fact)} = ${formatFactValue(rule.fact, value)}` +
          (matches ? '' : ` (expected ${typeof rule.equals === 'boolean' ? (rule.equals ? 'Yes' : 'No') : optionLabel(rule.fact, rule.equals)})`),
      );
      return matches;
    }

    case 'includes': {
      const value = context[rule.fact];
      if (isUnset(value)) {
        reasons.push(`${factLabel(rule.fact)} is not recorded`);
        return 'unknown';
      }
      const list = Array.isArray(value) ? value : [String(value)];
      const hit = rule.anyOf.filter((v) => list.includes(v));
      if (hit.length > 0) {
        reasons.push(`${factLabel(rule.fact)} includes ${hit.map((v) => optionLabel(rule.fact, v)).join(', ')}`);
        return true;
      }
      reasons.push(
        `${factLabel(rule.fact)} does not include ${rule.anyOf.map((v) => optionLabel(rule.fact, v)).join(' / ')}`,
      );
      return false;
    }

    case 'all':
      return and(rule.rules.map((r) => evaluate(r, context, reasons)));

    case 'any':
      return or(rule.rules.map((r) => evaluate(r, context, reasons)));

    case 'not':
      return not(evaluate(rule.rule, context, reasons));

    default:
      return 'unknown';
  }
}

/**
 * Suggest whether a test belongs in this engagement.
 * `unknown` resolves to applicable=true, uncertain=true.
 */
export function suggestApplicability(
  definition: TestDefinition,
  context: ApplicationContext,
): ApplicabilitySuggestion {
  const reasons: string[] = [];
  const outcome = evaluate(definition.applicability, context, reasons);

  if (definition.applicability.kind === 'always') {
    return {
      applicable: true,
      uncertain: false,
      reasons: ['Baseline test — always included'],
    };
  }

  if (outcome === 'unknown') {
    return {
      applicable: true,
      uncertain: true,
      reasons: [
        'Included because the application context is incomplete',
        ...dedupe(reasons),
      ],
    };
  }

  return {
    applicable: outcome,
    uncertain: false,
    reasons: dedupe(reasons),
  };
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
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

/** Render a rule as a compact readable string (used in the test drawer + export). */
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
