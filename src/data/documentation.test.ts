import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIBRARY_VERSION, TEST_LIBRARY, libraryStats } from './library';
import { CATEGORIES, SUBCATEGORIES } from './categories';
import { COVERAGE_BY_TYPE } from './typeCoverage';
import { CONTEXT_FACTS, isFactVisible } from '../domain/context';
import { rulefacts } from '../domain/applicability';
import type { ApplicabilityRule } from '../domain/types';

/**
 * Documentation numbers are computed, not remembered.
 *
 * The runtime refuses to claim coverage the library does not have (support
 * levels are derived in `typeCoverage.ts`), but the README and the living
 * docs are prose — they drifted once already (they said 184 tests for months
 * after the library became 177, and the deployment section still described
 * copying workflows that already existed). These tests recompute every
 * number the docs print and fail when prose and library disagree.
 *
 * Point-in-time records (ADRs, dated audits under docs/reports/) are
 * deliberately NOT covered: their numbers were true when written.
 */

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const stats = libraryStats();
const guidanceSteps = TEST_LIBRARY.reduce((n, t) => n + t.testingGuidance.length, 0);
const drivingFacts = new Set(TEST_LIBRARY.flatMap((t) => [...rulefacts(t.applicability)]));
const metadataFacts = CONTEXT_FACTS.filter((f) => f.metadataOnly).length;
const feedingFacts = CONTEXT_FACTS.filter((f) => f.feeds).length;
const priorities = `${stats.byPriority.Critical} Critical · ${stats.byPriority.High} High · ${stats.byPriority.Medium} Medium · ${stats.byPriority.Low} Low`;

/** Asset types a rule names (test-local mirror of typeCoverage's walker). */
function namedTypes(rule: ApplicabilityRule, out = new Set<string>()): Set<string> {
  switch (rule.kind) {
    case 'includes':
      if (rule.fact === 'assetTypes') rule.anyOf.forEach((v) => out.add(v));
      break;
    case 'fact':
      if (rule.fact === 'assetTypes' && typeof rule.equals === 'string') out.add(rule.equals);
      break;
    case 'all':
    case 'any':
      rule.rules.forEach((r) => namedTypes(r, out));
      break;
    case 'not':
      namedTypes(rule.rule, out);
      break;
    default:
      break;
  }
  return out;
}

const exclusiveTo = (type: string) =>
  TEST_LIBRARY.filter((t) => {
    const n = namedTypes(t.applicability);
    return n.size === 1 && n.has(type);
  }).length;

/** Core questions the wizard asks for a type before anything is answered. */
const coreQuestions = (type: Parameters<typeof isFactVisible>[2]) =>
  CONTEXT_FACTS.filter(
    (f) => f.core && isFactVisible(f, { assetTypes: type ? [type] : [] }, type),
  ).length;

const hint = (doc: string, expected: string) =>
  `${doc} should state "${expected}" (library ${LIBRARY_VERSION}: ${stats.total} tests). ` +
  'Recompute the docs from the library instead of editing the number by hand.';

describe('the README claims match the bundled library', () => {
  const readme = read('README.md');

  it('library totals and priority split', () => {
    expect(readme, hint('README.md', `**${stats.total}** (${priorities})`)).toContain(
      `**${stats.total}** (${priorities})`,
    );
    expect(readme).toContain(`(${stats.total} tests)`);
    expect(readme).toContain(`${CATEGORIES.length} categories → ${SUBCATEGORIES.length} subcategories`);
    expect(readme).toContain(`| Searchable aliases | ${stats.aliases} |`);
    expect(readme).toContain(`| Testing guidance steps | ${guidanceSteps} |`);
    expect(readme).toContain(
      `| Context-driven tests | ${stats.contextDriven} (${stats.baseline} baseline tests always apply) |`,
    );
    expect(readme).toContain(
      `| Application context facts | ${CONTEXT_FACTS.length} (${drivingFacts.size} drive applicability rules) |`,
    );
  });

  it('application-type coverage', () => {
    const web = COVERAGE_BY_TYPE['web-app'];
    const rest = COVERAGE_BY_TYPE['rest-api'];
    const gql = COVERAGE_BY_TYPE['graphql-api'];
    const soap = COVERAGE_BY_TYPE['soap-api'];
    expect(readme).toContain(`| Web Application | ✅ Supported | ${web.specific.length} |`);
    expect(readme).toContain(
      `| REST API | ✅ Supported | ${rest.specific.length} (+${rest.shared.length} shared HTTP) |`,
    );
    expect(readme).toContain(
      `| GraphQL API | ✅ Supported | ${gql.specific.length} (+${gql.shared.length} shared HTTP) |`,
    );
    expect(readme).toContain(
      `| SOAP / XML-RPC API | ⚠️ Limited | ${soap.specific.length} (+${soap.shared.length} shared HTTP) — only ${exclusiveTo('soap-api')} rules name SOAP alone |`,
    );
    expect(readme).toContain(`| Android / iOS | ⚠️ Limited | ${COVERAGE_BY_TYPE['mobile-android'].specific.length} —`);
    expect(readme).toContain(`| Cloud Environment | ⚠️ Limited | ${COVERAGE_BY_TYPE.cloud.specific.length} —`);
  });

  it('fact accounting adds up', () => {
    expect(drivingFacts.size + metadataFacts + feedingFacts).toBe(CONTEXT_FACTS.length);
  });
});

describe('the living docs claim the same library', () => {
  it('docs/TEST-LIBRARY.md', () => {
    const doc = read('docs/TEST-LIBRARY.md');
    expect(doc, hint('TEST-LIBRARY.md', `**${stats.total} vulnerability test definitions**`)).toContain(
      `**${stats.total} vulnerability test definitions**`,
    );
    expect(doc).toContain(`${SUBCATEGORIES.length} subcategories and ${stats.aliases} searchable aliases`);
    expect(doc).toContain(`**${priorities}**`);
    expect(doc).toContain(
      `${CONTEXT_FACTS.length} context facts, ${drivingFacts.size} of which drive rules (${metadataFacts} are marked`,
    );
    expect(doc).toContain(`and ${feedingFacts} more \`feeds\` a derived fact instead`);
    expect(doc).toContain(
      `**${stats.contextDriven} of ${stats.total} tests are context-driven**; the remaining ${stats.baseline}`,
    );
  });

  it('docs/DATA-MODEL.md', () => {
    const doc = read('docs/DATA-MODEL.md');
    expect(doc).toContain(
      `${stats.contextDriven} of the ${stats.total} tests are context-driven; ${stats.baseline} are baseline`,
    );
  });

  it('docs/ARCHITECTURE.md', () => {
    const doc = read('docs/ARCHITECTURE.md');
    expect(doc).toContain(`${stats.total} test defs`);
    expect(doc).toContain(`(${SUBCATEGORIES.length} total)`);
    expect(doc).toContain(`${stats.total} definitions grouped by area`);
  });

  it('docs/APPLICATION-TYPES.md', () => {
    const doc = read('docs/APPLICATION-TYPES.md');
    const universal = COVERAGE_BY_TYPE['web-app'].universal;
    expect(doc).toContain(`*universal* is the ${universal} tests with no asset-type gate at all`);
    expect(doc).toContain(`**${universal} tests remain ungated by asset type.**`);

    const row = (
      label: string,
      type: keyof typeof COVERAGE_BY_TYPE,
      shared: string,
    ) =>
      `| **${label}** | ${COVERAGE_BY_TYPE[type].specific.length} | ${shared} | ${COVERAGE_BY_TYPE[type].startingChecklist} | ${coreQuestions(type)} |`;
    expect(doc, hint('APPLICATION-TYPES.md', row('Web Application', 'web-app', '—'))).toContain(
      row('Web Application', 'web-app', '—'),
    );
    expect(doc).toContain(row('REST API', 'rest-api', String(COVERAGE_BY_TYPE['rest-api'].shared.length)));
    expect(doc).toContain(row('GraphQL API', 'graphql-api', String(COVERAGE_BY_TYPE['graphql-api'].shared.length)));
    expect(doc).toContain(row('SOAP / XML-RPC', 'soap-api', String(COVERAGE_BY_TYPE['soap-api'].shared.length)));
    expect(doc).toContain(row('Android Application', 'mobile-android', '0'));
    expect(doc).toContain(row('iOS Application', 'mobile-ios', '0'));
    expect(doc).toContain(row('Cloud Environment', 'cloud', '0'));

    // The support threshold is the smallest domain set called "supported".
    const supported = Object.values(COVERAGE_BY_TYPE).filter((c) => c.support === 'supported');
    const threshold = Math.min(...supported.map((c) => c.specific.length));
    expect(doc).toContain(`fewer than ${threshold} → limited`);
  });
});
