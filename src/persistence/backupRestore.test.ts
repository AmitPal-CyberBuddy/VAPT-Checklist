import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from './db';
import {
  clearAllData,
  createEngagement,
  exportBackup,
  getChecklist,
  getEngagement,
  importBackup,
  inspectBackup,
  updateTestState,
} from './repository';
import { TEST_LIBRARY } from '../data/library';

/**
 * Backup & restore through the *file* — the flow a tester actually relies on.
 *
 * The other persistence suites hand the in-memory object from exportBackup
 * straight to importBackup. These tests serialise with JSON.stringify and
 * re-parse, exactly what disk and the file input do, and restore into a
 * wiped database: nothing about the export leaves the JS heap, so a restore
 * that only works because it shared that heap would be caught here.
 */
describe('backup & restore — through the file itself', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  it('restores everything faithfully after the browser was wiped', async () => {
    // Two engagements with deliberately awkward data.
    const a = await createEngagement({
      applicationType: 'web-app',
      name: 'Alpha — 日本語名前 "quoted" <tagged>',
      clientName: 'ACME & Sons <b>',
      applicationUrl: 'https://app.example.com/path?q=1&r=2',
      testerName: 'J. Doe',
      scope: ['api.example.com/v2', 'staging.example.com'],
      description: 'Line one\nLine two — ROE notes…',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      context: { hasAuthentication: true, hasFileUpload: true },
    });
    const b = await createEngagement({
      applicationType: 'rest-api',
      name: 'Beta',
      context: { hasFileUpload: false },
    });

    // Recorded work of every shape the app can hold.
    await updateTestState(a.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
      notes: 'Bypass via response manipulation — payload: `{"role":"admin"}`\nSee https://evidence.example/x?a=1&b=2',
    });
    await updateTestState(a.id, 'AUTH-003', {
      status: 'Tested',
      result: 'Not Vulnerable',
      notes: 'Checked 2026-09-02 ✓',
    });
    await updateTestState(a.id, 'SESS-008', {
      applicable: false,
      applicabilitySource: 'manual',
    });
    await updateTestState(a.id, 'AUTH-005', {
      status: 'N/A',
      notes: 'Feature not present in this application',
    });
    await updateTestState(a.id, 'AUTH-007', { notes: 'Half-written note with no status yet' });
    await updateTestState(b.id, 'AUTH-001', { status: 'Tested', result: 'Not Vulnerable' });

    const engagementsBefore = [await getEngagement(a.id), await getEngagement(b.id)];
    const statesBeforeA = await getChecklist(a.id);
    const statesBeforeB = await getChecklist(b.id);

    // Export exactly like Settings → "Export all engagements (JSON)" …
    const fileJson = JSON.stringify(await exportBackup(), null, 2);
    // … the file lives on disk between the two acts of this test …
    const parsed = JSON.parse(fileJson);

    const inspection = inspectBackup(parsed);
    expect(inspection.ok).toBe(true);
    expect(inspection.issues).toEqual([]);
    expect(inspection.engagements).toBe(2);

    // The browser loses everything (site data cleared / different machine)…
    await clearAllData();
    expect(await db.engagements.count()).toBe(0);
    expect(await db.testStates.count()).toBe(0);

    // … and restores from the file alone.
    const result = await importBackup(parsed);
    expect(result.engagements).toBe(2);
    expect(result.tests).toBe(TEST_LIBRARY.length * 2);

    // Nothing collided with an empty database, so ids and contents match
    // the pre-backup rows exactly — unicode, URLs, multi-line notes included.
    for (const [index, before] of engagementsBefore.entries()) {
      expect(await getEngagement(before!.id), `engagement ${index}`).toEqual(before);
    }
    expect(await getChecklist(a.id)).toEqual(statesBeforeA);
    expect(await getChecklist(b.id)).toEqual(statesBeforeB);
  });

  it('single-engagement export (Export page) restores re-keyed and leaves originals alone', async () => {
    const keep = await createEngagement({
      applicationType: 'web-app',
      name: 'Stays in browser',
      context: { hasAuthentication: true },
    });
    const out = await createEngagement({
      applicationType: 'web-app',
      name: 'Goes to a file',
      context: { hasAuthentication: true },
    });
    await updateTestState(out.id, 'AUTH-001', { status: 'Tested', result: 'Vulnerable' });

    const parsed = JSON.parse(JSON.stringify(await exportBackup(out.id)));
    expect(inspectBackup(parsed).ok).toBe(true);

    // Restore into the browser that still holds the original: the id
    // collides, so a copy must be created rather than an overwrite.
    const { engagements, tests } = await importBackup(parsed);
    expect(engagements).toBe(1);
    expect(tests).toBe(TEST_LIBRARY.length);

    const all = await db.engagements.toArray();
    expect(all).toHaveLength(3);
    const rekeyed = all.find((e) => e.name === 'Goes to a file (imported)')!;
    expect(rekeyed.id).not.toBe(out.id);

    const restored = await getChecklist(rekeyed.id);
    expect(restored.find((i) => i.definition.id === 'AUTH-001')!.state.result).toBe('Vulnerable');
    expect(
      (await getChecklist(out.id)).find((i) => i.definition.id === 'AUTH-001')!.state.result,
    ).toBe('Vulnerable');
    expect((await getChecklist(keep.id)).every((i) => i.state.status === 'Not Tested')).toBe(true);
  });

  it('re-importing the same file is idempotent — re-keys again, never overwrites', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Import me twice',
    });
    await updateTestState(engagement.id, 'AUTH-001', { status: 'Tested', result: 'Vulnerable' });
    const firstChecklist = await getChecklist(engagement.id);

    const parsed = JSON.parse(JSON.stringify(await exportBackup()));
    await importBackup(parsed);
    await importBackup(parsed);

    const all = await db.engagements.toArray();
    expect(all).toHaveLength(3);
    expect(all.filter((e) => e.name.endsWith('(imported)'))).toHaveLength(2);
    expect(await getChecklist(engagement.id)).toEqual(firstChecklist);
    for (const copy of all) {
      expect(await getChecklist(copy.id)).toHaveLength(TEST_LIBRARY.length);
    }
  });

  it('a hand-edited file — Tested with the result stripped — is rejected and nothing moves', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Do not touch me',
    });
    await updateTestState(engagement.id, 'AUTH-001', { status: 'Tested', result: 'Vulnerable' });
    const untouchable = await getChecklist(engagement.id);

    const valid = JSON.parse(JSON.stringify(await exportBackup(engagement.id))) as {
      format: string;
      version: number;
      engagements: unknown[];
      testStates: { status?: string; result?: string | null; testId: string }[];
    };

    // The exact combination the state machine forbids: Tested, no result.
    const tampered = {
      ...valid,
      testStates: valid.testStates.map((s) =>
        s.testId === 'AUTH-001' ? { ...s, status: 'Tested', result: null } : s,
      ),
    };
    const inspection = inspectBackup(tampered);
    expect(inspection.ok).toBe(false);
    expect(inspection.issues.join(' ')).toMatch(/inconsistent/i);
    await expect(importBackup(tampered)).rejects.toThrow(/rejected/i);

    expect(await db.engagements.count()).toBe(1);
    expect(await getChecklist(engagement.id)).toEqual(untouchable);
  });
});
