import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from './db';
import {
  applyApplicability,
  bulkUpdateTestStates,
  createEngagement,
  clearAllData,
  duplicateEngagement,
  exportBackup,
  getChecklist,
  importBackup,
  previewApplicability,
  updateTestState,
} from './repository';
import { TEST_LIBRARY } from '../data/library';


/**
 * Full write-path integration test against an in-memory IndexedDB.
 * Covers the guarantees the UI depends on but cannot assert for itself.
 */
describe('repository', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  it('seeds one state per library test on creation', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Test engagement',
      context: { hasAuthentication: true, hasFileUpload: false },
    });
    const items = await getChecklist(engagement.id);
    expect(items).toHaveLength(TEST_LIBRARY.length);
    expect(items.every((i) => i.state.status === 'Not Tested')).toBe(true);
    expect(items.every((i) => i.state.result === null)).toBe(true);
  });

  it('applies context rules when seeding', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'No uploads',
      context: { hasFileUpload: false },
    });
    const items = await getChecklist(engagement.id);
    const upload = items.find((i) => i.definition.id === 'FILE-001')!;
    expect(upload.state.applicable).toBe(false);
    expect(upload.state.applicabilitySource).toBe('auto');
  });

  it('refuses to store Tested without a result', async () => {
    const engagement = await createEngagement({ applicationType: 'web-app',
      name: 'State machine' });

    await expect(
      updateTestState(engagement.id, 'AUTH-001', { status: 'Tested' }),
    ).rejects.toThrow(/inconsistent/i);

    const items = await getChecklist(engagement.id);
    const auth = items.find((i) => i.definition.id === 'AUTH-001')!;
    expect(auth.state.status).toBe('Not Tested');
    expect(auth.state.result).toBeNull();
  });

  it('records status and result atomically, and allows revision', async () => {
    const engagement = await createEngagement({ applicationType: 'web-app',
      name: 'Atomic' });

    await updateTestState(engagement.id, 'AUTH-001', { status: 'Tested', result: 'Vulnerable' });
    let auth = (await getChecklist(engagement.id)).find((i) => i.definition.id === 'AUTH-001')!;
    expect(auth.state.status).toBe('Tested');
    expect(auth.state.result).toBe('Vulnerable');
    expect(auth.state.testedAt).toBeTruthy();

    await updateTestState(engagement.id, 'AUTH-001', { status: 'N/A' });
    auth = (await getChecklist(engagement.id)).find((i) => i.definition.id === 'AUTH-001')!;
    expect(auth.state.status).toBe('N/A');
    expect(auth.state.result).toBeNull();
  });

  it('bulk updates a selection', async () => {
    const engagement = await createEngagement({ applicationType: 'web-app',
      name: 'Bulk' });
    const ids = TEST_LIBRARY.slice(0, 5).map((t) => t.id);
    await bulkUpdateTestStates(engagement.id, ids, {
      status: 'Tested',
      result: 'Not Vulnerable',
    });
    const items = await getChecklist(engagement.id);
    const updated = items.filter((i) => ids.includes(i.definition.id));
    expect(updated.every((i) => i.state.result === 'Not Vulnerable')).toBe(true);
  });

  it('preserves manual overrides and recorded work when context changes', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Context change',
      context: { hasFileUpload: true, hasAuthentication: true },
    });

    // Manual override on one upload test, recorded work on another.
    await updateTestState(engagement.id, 'FILE-001', {
      applicable: true,
      applicabilitySource: 'manual',
    });
    await updateTestState(engagement.id, 'FILE-002', {
      status: 'Tested',
      result: 'Not Vulnerable',
    });

    const newContext = { hasFileUpload: false, hasAuthentication: true };
    const diffs = await previewApplicability(engagement.id, newContext);
    expect(diffs.some((d) => d.testId === 'FILE-001' && d.isManualOverride)).toBe(true);
    expect(diffs.some((d) => d.testId === 'FILE-002' && d.hasRecordedWork)).toBe(true);

    await applyApplicability(engagement.id, newContext);
    const items = await getChecklist(engagement.id);
    const byId = new Map(items.map((i) => [i.definition.id, i.state]));

    expect(byId.get('FILE-001')!.applicable).toBe(true); // manual override kept
    expect(byId.get('FILE-002')!.applicable).toBe(true); // recorded work protected
    expect(byId.get('FILE-004')!.applicable).toBe(false); // untouched test excluded
    expect(byId.get('FILE-004')!.suggestedApplicable).toBe(false);
  });

  it('can force manual overrides back to the suggestion', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Force',
      context: { hasFileUpload: true },
    });
    await updateTestState(engagement.id, 'FILE-001', {
      applicable: true,
      applicabilitySource: 'manual',
    });
    await applyApplicability(engagement.id, { hasFileUpload: false }, { overrideManual: true });
    const items = await getChecklist(engagement.id);
    expect(items.find((i) => i.definition.id === 'FILE-001')!.state.applicable).toBe(false);
  });

  it('duplicates context without carrying results', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Original',
      context: { hasAuthentication: true },
    });
    await updateTestState(engagement.id, 'AUTH-001', { status: 'Tested', result: 'Vulnerable' });

    const copy = await duplicateEngagement(engagement.id, 'Retest')!;
    const items = await getChecklist(copy!.id);
    expect(copy!.context).toEqual(engagement.context);
    expect(items.every((i) => i.state.status === 'Not Tested')).toBe(true);
  });

  it('round-trips a JSON backup', async () => {
    const engagement = await createEngagement({ applicationType: 'web-app',
      name: 'Backup me' });
    await updateTestState(engagement.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
      notes: 'Bypass via response manipulation.',
    });

    const backup = await exportBackup(engagement.id);
    expect(backup.engagements).toHaveLength(1);

    await clearAllData();
    expect(await db.engagements.count()).toBe(0);

    await importBackup(backup);
    const restored = await db.engagements.toArray();
    expect(restored).toHaveLength(1);
    const items = await getChecklist(restored[0].id);
    const auth = items.find((i) => i.definition.id === 'AUTH-001')!;
    expect(auth.state.result).toBe('Vulnerable');
    expect(auth.state.notes).toContain('response manipulation');
  });

  it('re-keys an imported engagement that collides with an existing one', async () => {
    const engagement = await createEngagement({ applicationType: 'web-app',
      name: 'Collide' });
    const backup = await exportBackup(engagement.id);
    await importBackup(backup);
    const all = await db.engagements.toArray();
    expect(all).toHaveLength(2);
    expect(all.filter((e) => e.name.includes('imported'))).toHaveLength(1);
    const importedId = all.find((e) => e.name.includes('imported'))!.id;
    expect(await getChecklist(importedId)).toHaveLength(TEST_LIBRARY.length);
  });
});
