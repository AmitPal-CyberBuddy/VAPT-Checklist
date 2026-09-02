import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { db, VaptDatabase } from '../persistence/db';
import {
  applyApplicability,
  bulkUpdateTestStates,
  clearAllData,
  createEngagement,
  exportBackup,
  getChecklist,
  updateTestState,
} from '../persistence/repository';
import { TEST_LIBRARY, TEST_BY_ID, LIBRARY_VERSION } from '../data/library';
import { suggestApplicability } from '../domain/applicability';
import { countsAreConsistent, computeMetrics } from '../domain/metrics';
import { planWorkbook } from '../export/excel';
import { CONTEXT_FACTS, type ApplicationContext } from '../domain/context';
import type { TestResult, TestStatus } from '../domain/types';

/**
 * END-TO-END AUDIT — state integrity, applicability, persistence, export parity.
 *
 * Written from the position that nothing is correct until it has been driven
 * through the real write path and read back.
 */

const state = async (engagementId: string, testId: string) =>
  (await getChecklist(engagementId)).find((i) => i.definition.id === testId)!.state;

/* ========================================================== §2 State integrity */

describe('§2 state integrity — every valid transition', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  const PATHS: { name: string; steps: { status?: TestStatus; result?: TestResult }[]; end: [TestStatus, TestResult | null] }[] = [
    {
      name: 'Not Tested → Tested → Vulnerable',
      steps: [{ status: 'Tested', result: 'Vulnerable' }],
      end: ['Tested', 'Vulnerable'],
    },
    {
      name: 'Not Tested → Tested → Not Vulnerable',
      steps: [{ status: 'Tested', result: 'Not Vulnerable' }],
      end: ['Tested', 'Not Vulnerable'],
    },
    { name: 'Not Tested → N/A', steps: [{ status: 'N/A' }], end: ['N/A', null] },
    {
      name: 'N/A → Not Tested',
      steps: [{ status: 'N/A' }, { status: 'Not Tested' }],
      end: ['Not Tested', null],
    },
    {
      name: 'N/A → Tested → Vulnerable',
      steps: [{ status: 'N/A' }, { status: 'Tested', result: 'Vulnerable' }],
      end: ['Tested', 'Vulnerable'],
    },
    {
      name: 'Tested → Not Tested',
      steps: [{ status: 'Tested', result: 'Vulnerable' }, { status: 'Not Tested' }],
      end: ['Not Tested', null],
    },
    {
      name: 'Vulnerable → Not Vulnerable',
      steps: [
        { status: 'Tested', result: 'Vulnerable' },
        { status: 'Tested', result: 'Not Vulnerable' },
      ],
      end: ['Tested', 'Not Vulnerable'],
    },
  ];

  it.each(PATHS)('$name', async ({ steps, end }) => {
    const engagement = await createEngagement({ name: 'Transitions' });
    for (const step of steps) {
      await updateTestState(engagement.id, 'AUTH-001', step);
    }
    const final = await state(engagement.id, 'AUTH-001');
    expect([final.status, final.result]).toEqual(end);
    expect(countsAreConsistent(computeMetrics(await getChecklist(engagement.id)).counts)).toBe(true);
  });

  it('cannot store N/A with a result, by any route', async () => {
    const engagement = await createEngagement({ name: 'Invalid' });

    // Direct request for the contradiction.
    await updateTestState(engagement.id, 'AUTH-001', { status: 'N/A', result: 'Vulnerable' });
    expect(await state(engagement.id, 'AUTH-001')).toMatchObject({ status: 'N/A', result: null });

    // Arriving at N/A while a result already exists.
    await updateTestState(engagement.id, 'AUTH-002', { status: 'Tested', result: 'Not Vulnerable' });
    await updateTestState(engagement.id, 'AUTH-002', { status: 'N/A' });
    expect(await state(engagement.id, 'AUTH-002')).toMatchObject({ status: 'N/A', result: null });

    // Bulk edit.
    await bulkUpdateTestStates(engagement.id, ['AUTH-003'], { status: 'N/A', result: 'Vulnerable' });
    expect(await state(engagement.id, 'AUTH-003')).toMatchObject({ status: 'N/A', result: null });
  });

  it('cannot store Not Tested with a result, by any route', async () => {
    const engagement = await createEngagement({ name: 'Invalid 2' });
    await updateTestState(engagement.id, 'AUTH-001', { status: 'Tested', result: 'Vulnerable' });
    await updateTestState(engagement.id, 'AUTH-001', { status: 'Not Tested' });
    expect(await state(engagement.id, 'AUTH-001')).toMatchObject({
      status: 'Not Tested',
      result: null,
    });

    await updateTestState(engagement.id, 'AUTH-002', { status: 'Not Tested', result: 'Vulnerable' });
    expect(await state(engagement.id, 'AUTH-002')).toMatchObject({
      status: 'Not Tested',
      result: null,
    });
  });

  it('refuses Tested without a result rather than storing a half-record', async () => {
    const engagement = await createEngagement({ name: 'Half' });
    await expect(
      updateTestState(engagement.id, 'AUTH-001', { status: 'Tested' }),
    ).rejects.toThrow(/inconsistent/i);
    expect(await state(engagement.id, 'AUTH-001')).toMatchObject({ status: 'Not Tested' });
  });

  it('clears execution state when a test is marked Not Applicable, and does not resurrect it', async () => {
    const engagement = await createEngagement({ name: 'Applicability reset' });
    await updateTestState(engagement.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
      notes: 'kept',
    });
    await updateTestState(engagement.id, 'AUTH-001', {
      applicable: false,
      applicabilitySource: 'manual',
    });

    let s = await state(engagement.id, 'AUTH-001');
    expect(s).toMatchObject({ applicable: false, status: 'Not Tested', result: null });
    expect(s.notes).toBe('kept'); // notes survive — they explain the decision

    await updateTestState(engagement.id, 'AUTH-001', {
      applicable: true,
      applicabilitySource: 'manual',
    });
    s = await state(engagement.id, 'AUTH-001');
    expect(s).toMatchObject({ applicable: true, status: 'Not Tested', result: null });
  });
});

describe('§11 corrupted local data cannot produce impossible numbers', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  it('normalises an unrecognised status and keeps the identities true', async () => {
    const engagement = await createEngagement({ name: 'Corrupted' });
    const key = `${engagement.id}::AUTH-001`;
    const row = (await db.testStates.get(key))!;
    // Simulate a partial write, a manual IndexedDB edit or a future build.
    await db.testStates.put({ ...row, status: 'Skipped' as never });

    const counts = computeMetrics(await getChecklist(engagement.id)).counts;
    expect(countsAreConsistent(counts)).toBe(true);
    expect(counts.applicable).toBe(counts.notTested + counts.tested + counts.na);

    // …and the repair pass rewrites it to a legal value.
    const { repairIntegrity } = await import('../persistence/repository');
    expect(await repairIntegrity(engagement.id)).toBe(1);
    expect((await db.testStates.get(key))!.status).toBe('Not Tested');
  });

  it('survives a state row with a nonsense result', async () => {
    const engagement = await createEngagement({ name: 'Corrupted 2' });
    const key = `${engagement.id}::AUTH-002`;
    const row = (await db.testStates.get(key))!;
    await db.testStates.put({ ...row, status: 'N/A', result: 'Exploited' as never });

    const counts = computeMetrics(await getChecklist(engagement.id)).counts;
    expect(countsAreConsistent(counts)).toBe(true);
    const { repairIntegrity } = await import('../persistence/repository');
    await repairIntegrity(engagement.id);
    expect((await db.testStates.get(key))!.result).toBeNull();
  });
});

/* ============================================================ §3 Applicability */

describe('§3 applicability across real engagement profiles', () => {
  const BASE: ApplicationContext = {
    assetTypes: ['web-app'],
    internetFacing: true,
    hasAuthentication: true,
  };

  const PROFILES: {
    name: string;
    context: ApplicationContext;
    expectApplicable: string[];
    expectNotApplicable: string[];
  }[] = [
    {
      name: 'Basic web application',
      context: {
        ...BASE,
        hasFileUpload: false,
        usesWebsockets: false,
        handlesPayments: false,
        hasMfa: false,
      },
      expectApplicable: ['INJ-001', 'INJ-004', 'SESS-008', 'AUTHZ-001', 'CONF-001'],
      expectNotApplicable: ['FILE-001', 'CLI-010', 'AUTH-007', 'GQL-001', 'MOB-001'],
    },
    {
      name: 'API-heavy application',
      context: { ...BASE, assetTypes: ['rest-api', 'graphql-api'], hasUserOwnedResources: true },
      expectApplicable: ['API-001', 'API-002', 'API-003', 'AUTHZ-009', 'GQL-001', 'GQL-004'],
      expectNotApplicable: ['MOB-001'],
    },
    {
      name: 'Multiple roles',
      context: { ...BASE, hasMultipleRoles: true, hasAdminInterface: true },
      expectApplicable: ['AUTHZ-003', 'AUTHZ-010', 'LOGIC-010'],
      expectNotApplicable: [],
    },
    {
      name: 'File upload',
      context: { ...BASE, hasFileUpload: true },
      expectApplicable: ['FILE-001', 'FILE-002', 'FILE-004', 'FILE-007', 'LOGIC-009'],
      expectNotApplicable: [],
    },
    {
      name: 'MFA',
      context: { ...BASE, hasMfa: true },
      expectApplicable: ['AUTH-007', 'AUTH-008'],
      expectNotApplicable: [],
    },
    {
      name: 'Payments',
      context: { ...BASE, handlesPayments: true, hasWorkflowOrTransactions: true },
      expectApplicable: ['LOGIC-002', 'LOGIC-008', 'PRIV-005', 'LOGIC-004'],
      expectNotApplicable: [],
    },
    {
      name: 'OAuth / SSO',
      context: { ...BASE, authMechanisms: ['oauth2'], hasSso: true },
      expectApplicable: ['AUTH-013'],
      expectNotApplicable: ['AUTH-014'], // SAML not in use
    },
    {
      name: 'WebSockets',
      context: { ...BASE, usesWebsockets: true },
      expectApplicable: ['CLI-010'],
      expectNotApplicable: [],
    },
  ];

  it.each(PROFILES)('$name surfaces the right tests', ({ context, expectApplicable, expectNotApplicable }) => {
    const applicable = new Set(
      TEST_LIBRARY.filter((t) => suggestApplicability(t, context).applicable).map((t) => t.id),
    );
    for (const id of expectApplicable) {
      expect(applicable.has(id), `${id} (${TEST_BY_ID.get(id)?.vulnerabilityName}) should apply`).toBe(true);
    }
    for (const id of expectNotApplicable) {
      expect(applicable.has(id), `${id} (${TEST_BY_ID.get(id)?.vulnerabilityName}) should not apply`).toBe(false);
    }
  });

  it('discriminates between profiles on confirmed applicability', () => {
    /*
     * Two partially-described profiles can share an identical *applicable* set,
     * because an unrecorded fact resolves to "applicable, unconfirmed" — a
     * deliberate choice (a missed test is worse than an extra one). What must
     * differ is the set the context positively confirms; that is the part the
     * tester is told about and the part that shrinks as they answer questions.
     */
    const confirmed = PROFILES.map((p) =>
      TEST_LIBRARY.filter((t) => {
        const s = suggestApplicability(t, p.context);
        return s.applicable && !s.uncertain;
      })
        .map((t) => t.id)
        .join(),
    );
    expect(new Set(confirmed).size).toBe(PROFILES.length);
  });

  it('resolves the checklist once the default wizard questions are answered', () => {
    // The wizard asks the "core" questions. Answering only those must leave few
    // unconfirmed tests, otherwise the narrowing promise is not delivered.
    const context: ApplicationContext = {};
    for (const fact of CONTEXT_FACTS.filter((f) => f.core && !f.metadataOnly)) {
      if (fact.type === 'boolean') context[fact.key] = true;
      else if (fact.type === 'multi') context[fact.key] = [fact.options![0].value];
      else context[fact.key] = fact.options![0].value;
    }
    const applicable = TEST_LIBRARY.filter((t) => suggestApplicability(t, context).applicable);
    const unconfirmed = applicable.filter((t) => suggestApplicability(t, context).uncertain);

    expect(unconfirmed.length).toBeLessThan(applicable.length * 0.15);
    // …and the wizard must stay short enough to fill in during scoping.
    expect(CONTEXT_FACTS.filter((f) => f.core && !f.metadataOnly).length).toBeLessThanOrEqual(24);
  });

  it('never hides a Critical test that the context has not explicitly ruled out', () => {
    for (const profile of PROFILES) {
      const hidden = TEST_LIBRARY.filter(
        (t) => t.priority === 'Critical' && !suggestApplicability(t, profile.context).applicable,
      );
      for (const test of hidden) {
        // Every hidden Critical must be justified by an explicitly recorded fact.
        const reasons = suggestApplicability(test, profile.context).conditions;
        expect(
          reasons.some((c) => c.outcome === 'unmet'),
          `${profile.name}: ${test.id} hidden without an explicit reason`,
        ).toBe(true);
      }
    }
  });

  it('keeps every category represented for a fully described target', () => {
    const context = PROFILES[1].context;
    const applicable = TEST_LIBRARY.filter((t) => suggestApplicability(t, context).applicable);
    const categories = new Set(applicable.map((t) => t.category));
    for (const core of ['authentication', 'authorization', 'input-validation', 'session', 'api']) {
      expect(categories.has(core as never)).toBe(true);
    }
  });
});

describe('§3b applicability corrections found by the content audit', () => {
  const WEB: ApplicationContext = {
    assetTypes: ['web-app'],
    internetFacing: true,
    hosting: 'cloud',
    usesCdnOrProxy: true,
    datastore: 'sql',
  };
  const AUTHED: ApplicationContext = {
    ...WEB,
    hasAuthentication: true,
    authMechanisms: ['session-cookie'],
    hasPasswordReset: true,
    hasUserOwnedResources: true,
  };
  const applies = (id: string, context: ApplicationContext) =>
    suggestApplicability(TEST_BY_ID.get(id)!, context).applicable;

  it('does not hide NoSQL injection when the datastore is honestly "unknown"', () => {
    // SQL injection allowed for 'unknown'; NoSQL did not, so answering the
    // question truthfully removed a Critical test.
    expect(applies('INJ-001', { datastore: 'unknown' })).toBe(true);
    expect(applies('INJ-002', { datastore: 'unknown' })).toBe(true);
    expect(applies('INJ-002', { datastore: 'sql' })).toBe(false);
  });

  it('keeps OTP testing for password reset, not only for MFA', () => {
    expect(applies('AUTH-008', { hasAuthentication: true, hasMfa: false, hasPasswordReset: true })).toBe(true);
    expect(applies('AUTH-008', { hasAuthentication: true, hasMfa: true, hasPasswordReset: false })).toBe(true);
    expect(applies('AUTH-008', { hasAuthentication: true, hasMfa: false, hasPasswordReset: false })).toBe(false);
  });

  it('applies CSRF to a cookie-authenticated API, but not to a bearer-token one', () => {
    expect(applies('SESS-008', { ...AUTHED, assetTypes: ['rest-api'] })).toBe(true);
    // No ambient credential, so there is nothing for a foreign origin to ride.
    expect(
      applies('SESS-008', { ...AUTHED, assetTypes: ['rest-api'], authMechanisms: ['jwt'] }),
    ).toBe(false);
  });

  it('scans uploads for malware even when files are never served back', () => {
    expect(applies('FILE-003', { hasFileUpload: true, hasFileDownload: false })).toBe(true);
  });

  it('drops mechanism-specific tests when the application has no authentication', () => {
    const noAuth: ApplicationContext = { ...WEB, hasAuthentication: false };
    for (const id of ['SESS-010', 'SESS-013', 'AUTH-013', 'AUTH-014', 'API-006', 'INJ-008']) {
      expect(applies(id, noAuth), `${id} should not apply without authentication`).toBe(false);
    }
    // …but an unrecorded mechanism list still keeps them, conservatively.
    expect(applies('SESS-010', { ...WEB, hasAuthentication: true })).toBe(true);
  });

  it('surfaces the tests added by the content audit in the right contexts', () => {
    expect(applies('INJ-022', { usesCdnOrProxy: true })).toBe(true);
    expect(applies('INJ-022', { usesCdnOrProxy: false })).toBe(false);
    expect(applies('CLI-012', AUTHED)).toBe(true);
    expect(applies('CLI-012', { ...WEB, hasAuthentication: false })).toBe(false);
    expect(applies('SESS-013', AUTHED)).toBe(true);
  });

  it('reports retired states and records the version when syncing', async () => {
    const { createEngagement: create, syncLibrary } = await import('../persistence/repository');
    const { db: database } = await import('../persistence/db');
    const { stateKey } = await import('../domain/executionState');
    await database.open();
    const engagement = await create({ name: 'Pre-merge', context: { hasFileUpload: true } });
    // A finding recorded against a test that the audit merged away.
    await database.testStates.add({
      id: stateKey(engagement.id, 'FILE-006'),
      engagementId: engagement.id,
      testId: 'FILE-006',
      applicable: true,
      suggestedApplicable: true,
      applicabilitySource: 'auto',
      status: 'Tested',
      result: 'Vulnerable',
      notes: 'recorded before the merge',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);
    await database.engagements.update(engagement.id, { libraryVersion: '1.1.0' });

    const result = await syncLibrary(engagement.id);
    expect(result.retired).toBe(1);
    // The row is reported, never deleted — it is the tester's record.
    expect(await database.testStates.get(stateKey(engagement.id, 'FILE-006'))).toBeTruthy();
    // …and the engagement stops reporting itself as outdated.
    expect((await database.engagements.get(engagement.id))!.libraryVersion).toBe(LIBRARY_VERSION);
  });

  it('no longer carries the tests merged away by the audit', () => {
    for (const id of ['TLS-006', 'CONF-006', 'FILE-006']) {
      expect(TEST_BY_ID.has(id), `${id} was merged and should be gone`).toBe(false);
    }
    // Their coverage lives on in the tests that absorbed them.
    expect(TEST_BY_ID.get('INJ-011')!.aliases).toContain('Arbitrary File Download');
    expect(TEST_BY_ID.get('CONF-011')!.aliases).toContain('Insecure crossdomain.xml');
  });

  it('rates a live default administrative credential as Critical', () => {
    expect(TEST_BY_ID.get('AUTH-002')!.priority).toBe('Critical');
  });
});

/* ============================================================== §6 Persistence */

describe('§6 persistence across a simulated browser restart', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  it('retains every kind of edit after the database is closed and reopened', async () => {
    const a = await createEngagement({
      name: 'Engagement A',
      applicationUrl: 'https://a.example.com',
      context: { assetTypes: ['web-app'], hasAuthentication: true, hasFileUpload: true },
    });
    await createEngagement({ name: 'Engagement B', context: { hasFileUpload: false } });

    await updateTestState(a.id, 'AUTH-001', { status: 'Tested', result: 'Vulnerable', notes: 'A1' });
    await updateTestState(a.id, 'FILE-001', { status: 'N/A', notes: 'no upload in this tier' });
    await updateTestState(a.id, 'SESS-008', { applicable: false, applicabilitySource: 'manual' });
    await applyApplicability(a.id, {
      assetTypes: ['web-app'],
      hasAuthentication: true,
      hasFileUpload: false,
    });

    db.close();
    const reopened = new VaptDatabase();
    await reopened.open();

    const engagements = await reopened.engagements.toArray();
    expect(engagements.map((e) => e.name).sort()).toEqual(['Engagement A', 'Engagement B']);

    const states = await reopened.testStates.where('engagementId').equals(a.id).toArray();
    expect(states).toHaveLength(TEST_LIBRARY.length);
    expect(states.find((s) => s.testId === 'AUTH-001')).toMatchObject({
      status: 'Tested',
      result: 'Vulnerable',
      notes: 'A1',
    });
    // Recorded work protected from an applicability sweep.
    expect(states.find((s) => s.testId === 'FILE-001')).toMatchObject({
      status: 'N/A',
      applicable: true,
    });
    expect(states.find((s) => s.testId === 'SESS-008')).toMatchObject({
      applicable: false,
      applicabilitySource: 'manual',
    });
    // Context change persisted on the engagement record.
    expect((await reopened.engagements.get(a.id))!.context.hasFileUpload).toBe(false);

    reopened.close();
    await db.open();
  });
});

/* ============================================== §5 + §7 Isolation and export parity */

describe('§5/§7 export reflects exactly one engagement, and matches the UI state', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  it('exports only the target engagement and mirrors every recorded value', async () => {
    const target = await createEngagement({
      name: 'Target Engagement',
      applicationUrl: 'https://target.example.com',
      context: { assetTypes: ['web-app', 'rest-api'], hasAuthentication: true, hasFileUpload: true },
    });
    const other = await createEngagement({
      name: 'Other Engagement',
      context: { assetTypes: ['web-app'] },
    });

    await updateTestState(target.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
      notes: 'TARGET-NOTE-AUTH',
    });
    await updateTestState(target.id, 'INJ-001', {
      status: 'Tested',
      result: 'Not Vulnerable',
      notes: 'TARGET-NOTE-SQLI',
    });
    await updateTestState(target.id, 'FILE-001', { status: 'N/A', notes: 'TARGET-NOTE-NA' });
    await updateTestState(other.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
      notes: 'OTHER-SECRET-NOTE',
    });

    const items = await getChecklist(target.id);
    const metrics = computeMetrics(items);
    const engagement = (await db.engagements.get(target.id))!;
    const sheets = planWorkbook(engagement, items);

    const cell = (row: unknown[], i: number) =>
      String((row[i] as { value?: unknown })?.value ?? '');
    const sheet = (name: string) => sheets.find((s) => s.name === name)!;

    // No cross-engagement leakage anywhere in the workbook.
    const everything = JSON.stringify(sheets);
    expect(everything).toContain('TARGET-NOTE-AUTH');
    expect(everything).not.toContain('OTHER-SECRET-NOTE');
    expect(everything).not.toContain('Other Engagement');

    // Summary numbers equal the dashboard numbers.
    const summary = sheet('Engagement Summary').data;
    const labelled = (label: string) => {
      for (const row of summary) {
        for (let i = 0; i < row.length - 1; i += 1) {
          if (cell(row, i) === label) return cell(row, i + 1);
        }
      }
      return undefined;
    };
    expect(labelled('Engagement name')).toBe('Target Engagement');
    expect(labelled('Application URL')).toBe('https://target.example.com');
    expect(labelled('Total applicable tests')).toBe(String(metrics.counts.applicable));
    expect(labelled('Tested')).toBe(String(metrics.counts.tested));
    expect(labelled('Not tested')).toBe(String(metrics.counts.notTested));
    expect(labelled('N/A')).toBe(String(metrics.counts.na));
    expect(labelled('Vulnerable')).toBe(String(metrics.counts.vulnerable));
    expect(labelled('Not vulnerable')).toBe(String(metrics.counts.notVulnerable));
    expect(Number(labelled('Overall progress'))).toBeCloseTo(
      Math.round(metrics.completion * 1000) / 1000,
    );

    // Assessment sheet: one row per applicable test, values equal to state.
    const assessment = sheet('Assessment').data;
    const byId = new Map(items.map((i) => [i.definition.id, i]));
    expect(assessment.length - 1).toBe(items.filter((i) => i.state.applicable).length);
    for (const row of assessment.slice(1)) {
      const item = byId.get(cell(row, 0))!;
      expect(item).toBeTruthy();
      expect(cell(row, 1)).toBe(item.definition.vulnerabilityName);
      expect(cell(row, 3)).toBe(item.definition.subcategory);
      expect(cell(row, 4)).toBe(item.definition.priority);
      expect(cell(row, 5)).toBe(item.state.status);
      expect(cell(row, 6)).toBe(item.state.result ?? '');
      expect(cell(row, 7)).toBe(item.state.notes);
    }

    // Vulnerable sheet: exactly the vulnerable tests.
    const vulnerable = sheet('Vulnerable Tests').data;
    const expected = items.filter(
      (i) => i.state.status === 'Tested' && i.state.result === 'Vulnerable',
    );
    expect(vulnerable.length - 1).toBe(expected.length);
    expect(vulnerable.slice(1).map((row) => cell(row, 0)).sort()).toEqual(
      expected.map((i) => i.definition.id).sort(),
    );

    // A backup of one engagement carries nothing from the other.
    const backup = await exportBackup(target.id);
    expect(backup.engagements).toHaveLength(1);
    expect(JSON.stringify(backup)).not.toContain('OTHER-SECRET-NOTE');
    expect(backup.testStates.every((s) => s.engagementId === target.id)).toBe(true);
  });

  it('leaves other engagements untouched after heavy editing', async () => {
    const heavy = await createEngagement({ name: 'Heavy', context: { hasAuthentication: true } });
    const quiet = await createEngagement({ name: 'Quiet', context: { hasAuthentication: true } });
    const before = await getChecklist(quiet.id);

    const ids = TEST_LIBRARY.slice(0, 60).map((t) => t.id);
    for (const [i, id] of ids.entries()) {
      await updateTestState(heavy.id, id, {
        status: 'Tested',
        result: i % 2 ? 'Vulnerable' : 'Not Vulnerable',
        notes: `edited ${i}`,
      });
    }
    await bulkUpdateTestStates(heavy.id, ids.slice(0, 10), { status: 'N/A' });
    await applyApplicability(heavy.id, { hasAuthentication: false });

    const after = await getChecklist(quiet.id);
    expect(after).toEqual(before);
    expect(computeMetrics(after).counts.tested).toBe(0);
    expect(countsAreConsistent(computeMetrics(await getChecklist(heavy.id)).counts)).toBe(true);
  });
});
