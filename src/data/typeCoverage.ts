/**
 * Application-type coverage — measured, not asserted.
 *
 * The support level shown in the engagement wizard is computed from the
 * bundled library every time the app loads. A type is only described as
 * supported if the knowledge base actually carries enough tests aimed at that
 * domain, so the UI cannot drift into claiming capability it does not have.
 */

import type { ApplicabilityRule, TestDefinition } from '../domain/types';
import type { ApplicationTypeId, SupportLevel } from '../domain/applicationType';
import { APPLICATION_TYPES, FALLBACK_APPLICATION_TYPE } from '../domain/applicationType';
import { TEST_LIBRARY } from './library';

/** Does this rule name the asset type explicitly? */
function namesAssetType(rule: ApplicabilityRule, type: ApplicationTypeId): boolean {
  switch (rule.kind) {
    case 'includes':
      return rule.fact === 'assetTypes' && rule.anyOf.includes(type);
    case 'fact':
      return rule.fact === 'assetTypes' && rule.equals === type;
    case 'all':
    case 'any':
      return rule.rules.some((r) => namesAssetType(r, type));
    case 'not':
      return namesAssetType(rule.rule, type);
    default:
      return false;
  }
}

export interface TypeCoverage {
  type: ApplicationTypeId;
  /**
   * Tests aimed at this domain specifically. For anything other than a web
   * application, a rule that also names `web-app` is a shared HTTP-layer test
   * rather than domain coverage, so it is counted separately.
   */
  specific: TestDefinition[];
  /** Generic HTTP-layer tests this type inherits. */
  shared: TestDefinition[];
  /** Tests with no asset-type gate — they apply to any engagement. */
  universal: number;
  support: SupportLevel;
  /** Categories the domain-specific tests fall into, largest first. */
  categories: { category: string; count: number }[];
}

/**
 * Thresholds. Deliberately blunt and few:
 *   0 domain-specific tests            → unsupported
 *   fewer than 14                      → limited
 *   otherwise                          → supported
 * 14 is the size of the smallest set we are willing to call an assessment
 * domain (the REST API set), not a number tuned to make the UI look good.
 */
const SUPPORTED_THRESHOLD = 14;

export function applicationTypeCoverage(type: ApplicationTypeId): TypeCoverage {
  const named = TEST_LIBRARY.filter((t) => namesAssetType(t.applicability, type));
  const shared =
    type === 'web-app' ? [] : named.filter((t) => namesAssetType(t.applicability, 'web-app'));
  const specific = named.filter((t) => !shared.includes(t));
  const universal = TEST_LIBRARY.filter(
    (t) => !APPLICATION_TYPES.some((a) => namesAssetType(t.applicability, a.id)),
  ).length;

  const counts = new Map<string, number>();
  for (const t of specific) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);

  const support: SupportLevel =
    specific.length === 0
      ? 'unsupported'
      : specific.length < SUPPORTED_THRESHOLD
        ? 'limited'
        : 'supported';

  return {
    type,
    specific,
    shared,
    universal,
    support,
    categories: [...counts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export const COVERAGE_BY_TYPE = Object.fromEntries(
  APPLICATION_TYPES.map((t) => [t.id, applicationTypeCoverage(t.id)]),
) as Record<ApplicationTypeId, TypeCoverage>;

/** Safe lookup: a stored value outside the known set falls back rather than crashing. */
export const coverageFor = (type: ApplicationTypeId): TypeCoverage =>
  COVERAGE_BY_TYPE[type] ?? COVERAGE_BY_TYPE[FALLBACK_APPLICATION_TYPE];

export const supportLevel = (type: ApplicationTypeId): SupportLevel => coverageFor(type).support;

export const isSupportedForEngagement = (type: ApplicationTypeId): boolean =>
  coverageFor(type).support !== 'unsupported';
