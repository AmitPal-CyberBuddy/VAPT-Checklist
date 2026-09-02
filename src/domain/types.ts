/**
 * VAPT Checklist — Core domain types
 * ---------------------------------------------------------------------------
 * Two hard boundaries are enforced by these types:
 *
 *   1. TestDefinition  — immutable, bundled knowledge base. Never engagement
 *                        specific. Never mutated by the UI.
 *   2. TestState       — per-engagement execution state for one definition.
 *
 * Nothing in TestState is duplicated from TestDefinition (no cached names,
 * categories or priorities) so the knowledge base can be updated without
 * invalidating recorded work.
 */

import type { ApplicationContext, ContextFactKey } from './context';

/* -------------------------------------------------------------------------- */
/* Knowledge base                                                             */
/* -------------------------------------------------------------------------- */

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export const PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low'];

export const PRIORITY_ORDER: Record<Priority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export type CategoryId =
  | 'recon'
  | 'config'
  | 'transport'
  | 'authentication'
  | 'session'
  | 'authorization'
  | 'input-validation'
  | 'client-side'
  | 'business-logic'
  | 'cryptography'
  | 'file-handling'
  | 'api'
  | 'graphql'
  | 'disclosure'
  | 'availability'
  | 'cloud'
  | 'mobile'
  | 'privacy';

export interface Category {
  id: CategoryId;
  name: string;
  /** Two/three letter code used as the test ID prefix. */
  code: string;
  description: string;
  /**
   * Second taxonomy level. Every test in the category declares one of these,
   * which keeps grouping and filtering meaningful once a category grows past
   * a dozen entries.
   */
  subcategories: string[];
}

/** A resolved external link. Derived from standards codes, never hand-written. */
export interface Reference {
  label: string;
  url: string;
}

/**
 * Declarative applicability rule.
 *
 * Rules are pure data so they can be serialised, unit tested and explained
 * back to the tester ("included because: File upload = Yes").
 */
export type ApplicabilityRule =
  | { kind: 'always' }
  | { kind: 'fact'; fact: ContextFactKey; equals: boolean | string }
  | { kind: 'includes'; fact: ContextFactKey; anyOf: string[] }
  | { kind: 'all'; rules: ApplicabilityRule[] }
  | { kind: 'any'; rules: ApplicabilityRule[] }
  | { kind: 'not'; rule: ApplicabilityRule };

export interface TestDefinition {
  /** Stable public identifier, e.g. `AUTH-001`. Never reused. */
  id: string;
  /**
   * WHAT vulnerability is assessed — the tester-facing identity and the
   * canonical industry name. Alternative names go in `aliases`, never into a
   * second test.
   */
  vulnerabilityName: string;
  category: CategoryId;
  /** Second taxonomy level; must be one of the category's `subcategories`. */
  subcategory: string;
  priority: Priority;
  /** What the weakness is and why it matters. */
  description: string;
  /** HOW to test — ordered, actionable steps. */
  testingGuidance: string[];
  /** Declarative rule evaluated against the engagement's ApplicationContext. */
  applicability: ApplicabilityRule;
  /**
   * Other industry terms for the same issue. Searchable, so a tester looking
   * for "BOLA", "IDOR" or "Insecure Direct Object Reference" lands on one test
   * rather than three near-duplicates.
   */
  aliases?: string[];
  /** Standards mapping (OWASP WSTG / Top 10 / API Top 10 / MASVS). */
  owasp?: string[];
  cwe?: string[];
  tags?: string[];
}

/* -------------------------------------------------------------------------- */
/* Engagement                                                                 */
/* -------------------------------------------------------------------------- */

export type EngagementStatus = 'Active' | 'Completed' | 'Archived';

export interface Engagement {
  id: string;
  name: string;
  clientName?: string;
  /**
   * Primary application URL / base target. Part of engagement identity because
   * it heads the dashboard and the exported report. The application TYPE is not
   * duplicated here — it lives once in `context.assetTypes`, where the
   * applicability engine reads it.
   */
  applicationUrl?: string;
  /** Additional in-scope targets: hosts, URLs, package names, API base paths. */
  scope: string[];
  description?: string;
  testerName?: string;
  startDate?: string; // ISO yyyy-mm-dd
  endDate?: string; // ISO yyyy-mm-dd
  status: EngagementStatus;
  context: ApplicationContext;
  /** Version of the bundled library the engagement was seeded from. */
  libraryVersion: string;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

/* -------------------------------------------------------------------------- */
/* Execution state                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Execution status. Deliberately three values only:
 *
 *   Not Tested ──► Tested ──► (Vulnerable | Not Vulnerable)
 *              └─► N/A
 */
export type TestStatus = 'Not Tested' | 'Tested' | 'N/A';
export const TEST_STATUSES: TestStatus[] = ['Not Tested', 'Tested', 'N/A'];

export type TestResult = 'Vulnerable' | 'Not Vulnerable';
export const TEST_RESULTS: TestResult[] = ['Vulnerable', 'Not Vulnerable'];

export type ApplicabilitySource = 'auto' | 'manual';

export interface TestState {
  /** Composite key `${engagementId}::${testId}` — one row per test per job. */
  id: string;
  engagementId: string;
  testId: string;

  /** Is this test part of this engagement's checklist? */
  applicable: boolean;
  /** What the rule engine suggested, kept for "differs from suggestion" UX. */
  suggestedApplicable: boolean;
  /** Whether the tester overrode the suggestion. */
  applicabilitySource: ApplicabilitySource;

  status: TestStatus;
  /** Required when status === 'Tested', otherwise null. */
  result: TestResult | null;
  notes: string;

  createdAt: string;
  updatedAt: string;
  /** Set the first time the test transitions into `Tested`. */
  testedAt?: string;
}

/* -------------------------------------------------------------------------- */
/* Derived views                                                              */
/* -------------------------------------------------------------------------- */

/** A definition joined with its engagement state — the checklist row model. */
export interface ChecklistItem {
  definition: TestDefinition;
  state: TestState;
}
