import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { db, VaptDatabase } from './db';
import {
  BackupValidationError,
  clearAllData,
  createEngagement,
  exportBackup,
  getChecklist,
  importBackup,
  inspectBackup,
  repairIntegrity,
  updateTestState,
  bulkUpdateTestStates,
} from './repository';
import { TEST_LIBRARY } from '../data/library';
import { countsAreConsistent, computeMetrics } from '../domain/metrics';

/**
 * Persistence guarantees the product makes:
 *   - a refresh never loses recorded work,
 *   - engagements are fully independent,
 *   - the counting identities always hold on disk,
 *   - a malformed backup can never damage what is already stored.
 */
describe('local persistence', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  it('survives a page refresh', async () => {
    const engagement = await createEngagement({
      name: 'Refresh me',
      applicationUrl: 'https://app.example.com',
      context: { assetTypes: ['web-app'], hasAuthentication: true },
    });
    await updateTestState(engagement.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
      notes: 'Bypass via response manipulation.',
    });
    await updateTestState(engagement.id, 'SESS-008', {
      applicable: false,
      applicabilitySource: 'manual',
    });

    // Simulate a reload: drop every in-memory handle and reopen the database.
    db.close();
    const reopened = new VaptDatabase();
    await reopened.open();

    const stored = await reopened.engagements.get(engagement.id);
    expect(stored?.applicationUrl).toBe('https://app.example.com');
    expect(stored?.context.hasAuthentication).toBe(true);

    const states = await reopened.testStates.where('engagementId').equals(engagement.id).toArray();
    expect(states).toHaveLength(TEST_LIBRARY.length);

    const auth = states.find((s) => s.testId === 'AUTH-001')!;
    expect(auth.status).toBe('Tested');
    expect(auth.result).toBe('Vulnerable');
    expect(auth.notes).toContain('response manipulation');

    const session = states.find((s) => s.testId === 'SESS-008')!;
    expect(session.applicable).toBe(false);
    expect(session.applicabilitySource).toBe('manual');

    reopened.close();
    await db.open();
  });

  it('keeps engagements completely independent', async () => {
    const a = await createEngagement({
      name: 'Alpha',
      context: { hasFileUpload: true, hasAuthentication: true },
    });
    const b = await createEngagement({
      name: 'Bravo',
      context: { hasFileUpload: false, hasAuthentication: true },
    });

    await updateTestState(a.id, 'AUTH-001', { status: 'Tested', result: 'Vulnerable' });
    await updateTestState(a.id, 'AUTH-003', { notes: 'Alpha only note' });

    const alpha = await getChecklist(a.id);
    const bravo = await getChecklist(b.id);

    expect(alpha.find((i) => i.definition.id === 'AUTH-001')!.state.result).toBe('Vulnerable');
    expect(bravo.find((i) => i.definition.id === 'AUTH-001')!.state.status).toBe('Not Tested');
    expect(bravo.find((i) => i.definition.id === 'AUTH-003')!.state.notes).toBe('');

    // Independent applicability too.
    expect(alpha.find((i) => i.definition.id === 'FILE-001')!.state.applicable).toBe(true);
    expect(bravo.find((i) => i.definition.id === 'FILE-001')!.state.applicable).toBe(false);

    // …and independent metrics.
    expect(computeMetrics(alpha).counts.vulnerable).toBe(1);
    expect(computeMetrics(bravo).counts.vulnerable).toBe(0);
  });

  it('deleting one engagement leaves the other intact', async () => {
    const a = await createEngagement({ name: 'Keep' });
    const b = await createEngagement({ name: 'Remove' });
    await updateTestState(a.id, 'AUTH-001', { status: 'N/A' });

    await db.transaction('rw', db.engagements, db.testStates, async () => {
      await db.testStates.where('engagementId').equals(b.id).delete();
      await db.engagements.delete(b.id);
    });

    expect(await getChecklist(a.id)).toHaveLength(TEST_LIBRARY.length);
    expect(await getChecklist(b.id)).toHaveLength(0);
  });
});

describe('data integrity', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  it('holds both counting identities after arbitrary edits', async () => {
    const engagement = await createEngagement({
      name: 'Identities',
      context: { assetTypes: ['web-app'], hasAuthentication: true },
    });

    const ids = TEST_LIBRARY.slice(0, 30).map((t) => t.id);
    for (const [index, id] of ids.entries()) {
      const change =
        index % 4 === 0
          ? { status: 'Tested' as const, result: 'Vulnerable' as const }
          : index % 4 === 1
            ? { status: 'Tested' as const, result: 'Not Vulnerable' as const }
            : index % 4 === 2
              ? { status: 'N/A' as const }
              : { applicable: false };
      await updateTestState(engagement.id, id, change);
    }

    const counts = computeMetrics(await getChecklist(engagement.id)).counts;
    expect(countsAreConsistent(counts)).toBe(true);
    expect(counts.applicable).toBe(counts.notTested + counts.tested + counts.na);
    expect(counts.tested).toBe(counts.vulnerable + counts.notVulnerable);
  });

  it('makes "N/A with a result" unrepresentable', async () => {
    const engagement = await createEngagement({ name: 'Impossible' });
    await updateTestState(engagement.id, 'AUTH-001', { status: 'Tested', result: 'Vulnerable' });
    await updateTestState(engagement.id, 'AUTH-001', { status: 'N/A' });

    const state = (await getChecklist(engagement.id)).find((i) => i.definition.id === 'AUTH-001')!
      .state;
    expect(state.status).toBe('N/A');
    expect(state.result).toBeNull();

    // Even asking for it directly cannot store it.
    await expect(
      updateTestState(engagement.id, 'AUTH-001', { status: 'N/A', result: 'Vulnerable' }),
    ).resolves.toMatchObject({ status: 'N/A', result: null });
  });

  it('rejects a whole bulk edit if any row would become inconsistent', async () => {
    const engagement = await createEngagement({ name: 'Bulk guard' });
    const ids = TEST_LIBRARY.slice(0, 4).map((t) => t.id);

    await expect(
      bulkUpdateTestStates(engagement.id, ids, { status: 'Tested' }),
    ).rejects.toThrow(/inconsistent/i);

    const items = await getChecklist(engagement.id);
    expect(items.filter((i) => i.state.status !== 'Not Tested')).toHaveLength(0);
  });

  it('repairs legacy Tested-without-result rows on open', async () => {
    const engagement = await createEngagement({ name: 'Legacy' });
    // Write past the repository, the way an older build did.
    const key = `${engagement.id}::AUTH-001`;
    const state = (await db.testStates.get(key))!;
    await db.testStates.put({ ...state, status: 'Tested', result: null });

    expect(await repairIntegrity(engagement.id)).toBe(1);
    const repaired = (await db.testStates.get(key))!;
    expect(repaired.status).toBe('Not Tested');
    expect(repaired.result).toBeNull();

    // Idempotent.
    expect(await repairIntegrity(engagement.id)).toBe(0);
  });
});

describe('backup validation', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  async function validBackup() {
    const engagement = await createEngagement({
      name: 'Backup source',
      applicationUrl: 'https://app.example.com',
      context: { hasAuthentication: true },
    });
    await updateTestState(engagement.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
      notes: 'Confirmed.',
    });
    return exportBackup(engagement.id);
  }

  it('accepts a backup this app produced', async () => {
    const backup = await validBackup();
    const inspection = inspectBackup(backup);
    expect(inspection.ok).toBe(true);
    expect(inspection.issues).toEqual([]);
    expect(inspection.engagements).toBe(1);
    expect(inspection.names).toEqual(['Backup source']);
  });

  it.each([
    ['not an object', 42],
    ['missing format marker', { version: 1, engagements: [], testStates: [] }],
    ['wrong format', { format: 'something-else', version: 1, engagements: [], testStates: [] }],
    [
      'unsupported version',
      { format: 'vapt-checklist-backup', version: 99, engagements: [], testStates: [] },
    ],
    [
      'missing arrays',
      { format: 'vapt-checklist-backup', version: 1 },
    ],
    [
      'no engagements',
      { format: 'vapt-checklist-backup', version: 1, engagements: [], testStates: [] },
    ],
  ])('rejects a backup that is %s', (_label, payload) => {
    const inspection = inspectBackup(payload);
    expect(inspection.ok).toBe(false);
    expect(inspection.issues.length).toBeGreaterThan(0);
  });

  it('rejects an engagement with a bad status or missing name', async () => {
    const backup = await validBackup();
    const broken = {
      ...backup,
      engagements: [{ ...backup.engagements[0], status: 'Pwned', name: '' }],
    };
    const inspection = inspectBackup(broken);
    expect(inspection.ok).toBe(false);
    expect(inspection.issues.join(' ')).toMatch(/unknown status/i);
    expect(inspection.issues.join(' ')).toMatch(/no name/i);
  });

  it('rejects a test state that breaks the state machine', async () => {
    const backup = await validBackup();
    const broken = {
      ...backup,
      testStates: backup.testStates.map((s) =>
        s.testId === 'AUTH-003' ? { ...s, status: 'N/A' as const, result: 'Vulnerable' } : s,
      ),
    };
    const inspection = inspectBackup(broken);
    expect(inspection.ok).toBe(false);
    expect(inspection.issues.join(' ')).toMatch(/inconsistent/i);
  });

  it('rejects a state that points at an engagement not in the file', async () => {
    const backup = await validBackup();
    const broken = {
      ...backup,
      testStates: [{ ...backup.testStates[0], engagementId: 'ghost' }],
    };
    expect(inspectBackup(broken).ok).toBe(false);
  });

  it('warns about — and skips — tests missing from this library', async () => {
    const backup = await validBackup();
    const withUnknown = {
      ...backup,
      testStates: [...backup.testStates, { ...backup.testStates[0], testId: 'FUTURE-999' }],
    };
    const inspection = inspectBackup(withUnknown);
    expect(inspection.ok).toBe(true);
    expect(inspection.droppedStates).toBe(1);
    expect(inspection.warnings.join(' ')).toMatch(/not in library/i);
  });

  it('never touches existing data when an import is rejected', async () => {
    const existing = await createEngagement({ name: 'Untouched' });
    await updateTestState(existing.id, 'AUTH-001', { status: 'Tested', result: 'Not Vulnerable' });
    const before = await getChecklist(existing.id);

    await expect(importBackup({ format: 'nope' })).rejects.toBeInstanceOf(BackupValidationError);
    await expect(importBackup(null)).rejects.toBeInstanceOf(BackupValidationError);

    expect(await db.engagements.count()).toBe(1);
    expect(await getChecklist(existing.id)).toEqual(before);
  });

  it('round-trips an engagement and re-keys a colliding id', async () => {
    const backup = await validBackup();
    const { engagements, tests } = await importBackup(backup);
    expect(engagements).toBe(1);
    expect(tests).toBeGreaterThan(0);

    const all = await db.engagements.toArray();
    expect(all).toHaveLength(2);
    const imported = all.find((e) => e.name.includes('imported'))!;
    expect(imported.applicationUrl).toBe('https://app.example.com');

    const items = await getChecklist(imported.id);
    expect(items).toHaveLength(TEST_LIBRARY.length);
    expect(items.find((i) => i.definition.id === 'AUTH-001')!.state.result).toBe('Vulnerable');
    expect(countsAreConsistent(computeMetrics(items).counts)).toBe(true);
  });
});
