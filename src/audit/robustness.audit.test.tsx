// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { db } from '../persistence/db';
import {
  clearAllData,
  createEngagement,
  getChecklist,
  getEngagement,
  inspectBackup,
  listEngagements,
  normaliseEngagement,
  repairIntegrity,
  updateTestState,
} from '../persistence/repository';
import { computeMetrics, countsAreConsistent } from '../domain/metrics';
import { effectiveContext } from '../domain/context';
import { coverageFor } from '../data/typeCoverage';
import { toApplicationTypeId, isApplicationTypeId } from '../domain/applicationType';
import { clampText, safeSpreadsheetText, TEXT_LIMITS, EXCEL_CELL_LIMIT } from '../domain/untrusted';
import { stateKey } from '../domain/executionState';
import type { TestState } from '../domain/types';

/**
 * ROBUSTNESS AUDIT
 *
 * Everything here reproduces a defect that was live in the application. The
 * data is deliberately hostile: rows a devtools edit, a partial write, an old
 * schema or a crafted backup could put on disk.
 */

function setViewport(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe('malformed stored data cannot crash a screen', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('survives a test state with null notes', async () => {
    const engagement = await createEngagement({
      name: 'Null notes',
      applicationType: 'web-app',
      context: { hasAuthentication: true },
    });
    const key = stateKey(engagement.id, 'AUTH-001');
    const row = (await db.testStates.get(key))!;
    await db.testStates.put({ ...row, notes: null as never });

    // Previously: notes.toLowerCase() in the workspace filter took the page down.
    const items = await getChecklist(engagement.id);
    expect(items.find((i) => i.definition.id === 'AUTH-001')!.state.notes).toBe('');
    expect(items.filter((i) => i.state.notes.toLowerCase().includes('x'))).toHaveLength(0);
    expect(countsAreConsistent(computeMetrics(items).counts)).toBe(true);

    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);
    expect(await screen.findByRole('navigation', { name: 'Tests' })).toBeTruthy();
  });

  it('coerces an unknown application type on read instead of crashing', async () => {
    const engagement = await createEngagement({
      name: 'Bad type',
      applicationType: 'web-app',
      context: {},
    });
    await db.engagements.update(engagement.id, { applicationType: '../../etc/passwd' as never });

    const read = (await getEngagement(engagement.id))!;
    expect(read.applicationType).toBe('web-app');
    expect(coverageFor('nope' as never).support).toBeTruthy();
    expect(isApplicationTypeId('nope')).toBe(false);
    expect(toApplicationTypeId(undefined)).toBe('web-app');

    window.location.hash = `#/e/${engagement.id}`;
    render(<App />);
    expect(await screen.findByText('Application type')).toBeTruthy();
  });

  it('survives an engagement with a missing context and a malformed scope', async () => {
    const engagement = await createEngagement({
      name: 'No context',
      applicationType: 'rest-api',
      context: {},
    });
    await db.engagements.update(engagement.id, {
      context: undefined as never,
      scope: 'not-an-array' as never,
      status: 'Bogus' as never,
    });

    const read = (await getEngagement(engagement.id))!;
    expect(read.context).toEqual({});
    expect(read.scope).toEqual([]);
    expect(read.status).toBe('Active');
    expect(effectiveContext(read).assetTypes).toEqual(['rest-api']);
    expect(await listEngagements()).toHaveLength(1);
  });

  it('normalises a bad status or result on read, and still repairs it on disk', async () => {
    const engagement = await createEngagement({
      name: 'Corrupt',
      applicationType: 'web-app',
      context: {},
    });
    const key = stateKey(engagement.id, 'AUTH-001');
    const row = (await db.testStates.get(key))!;
    await db.testStates.put({ ...row, status: 'Skipped' as never, result: 'Exploited' as never });

    // Read side is safe…
    const item = (await getChecklist(engagement.id)).find((i) => i.definition.id === 'AUTH-001')!;
    expect(item.state.status).toBe('Not Tested');
    expect(item.state.result).toBeNull();

    // …and the repair pass still sees the raw row, so the corruption is fixed
    // rather than permanently masked.
    expect(await repairIntegrity(engagement.id)).toBe(1);
    const repaired = (await db.testStates.get(key))!;
    expect(repaired.status).toBe('Not Tested');
    expect(repaired.result).toBeNull();
  });

  it('normaliseEngagement is total — it accepts anything', () => {
    const junk = normaliseEngagement({} as never);
    expect(junk.applicationType).toBe('web-app');
    expect(junk.context).toEqual({});
    expect(junk.scope).toEqual([]);
    expect(junk.name).toBe('Untitled engagement');
  });
});

describe('input is bounded and validated', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  it('caps stored text rather than letting one paste fill the quota', async () => {
    const engagement = await createEngagement({
      name: 'X'.repeat(5_000),
      applicationType: 'web-app',
      applicationUrl: 'https://example.com/' + 'a'.repeat(9_000),
      description: 'D'.repeat(50_000),
      scope: Array.from({ length: 400 }, (_, i) => `host-${i}.example.com`),
      context: {},
    });
    const stored = (await getEngagement(engagement.id))!;
    expect(stored.name.length).toBe(TEXT_LIMITS.engagementName);
    expect(stored.applicationUrl!.length).toBeLessThanOrEqual(TEXT_LIMITS.applicationUrl);
    expect(stored.description!.length).toBe(TEXT_LIMITS.description);
    expect(stored.scope.length).toBeLessThanOrEqual(50);

    await updateTestState(engagement.id, 'AUTH-001', { status: 'N/A', notes: 'N'.repeat(80_000) });
    const note = (await getChecklist(engagement.id)).find((i) => i.definition.id === 'AUTH-001')!
      .state.notes;
    expect(note.length).toBe(TEXT_LIMITS.notes);
  });

  it('keeps every exported cell inside the limit Excel will open', () => {
    const huge = 'A'.repeat(EXCEL_CELL_LIMIT + 5_000);
    const cell = safeSpreadsheetText(huge);
    expect(cell.length).toBeLessThanOrEqual(EXCEL_CELL_LIMIT);
    expect(cell.endsWith('[…truncated]')).toBe(true);
  });

  it('clampText is total', () => {
    expect(clampText(undefined, 10)).toBe('');
    expect(clampText(null, 10)).toBe('');
    expect(clampText(42 as never, 10)).toBe('');
    expect(clampText('  padded  ', 10)).toBe('padded');
  });

  it('rejects a write to a test that is not in the engagement', async () => {
    const engagement = await createEngagement({
      name: 'Unknown id',
      applicationType: 'web-app',
      context: {},
    });
    // Previously returned undefined: the caller believed the save succeeded.
    await expect(updateTestState(engagement.id, 'NOPE-999', { status: 'N/A' })).rejects.toThrow(
      /No such test/,
    );
  });
});

describe('hostile backups are refused', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  it('rejects an unknown application type', async () => {
    const engagement = await createEngagement({
      name: 'Source',
      applicationType: 'web-app',
      context: {},
    });
    const stored = (await getEngagement(engagement.id))!;
    const inspection = inspectBackup({
      format: 'vapt-checklist-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      libraryVersion: '1.2.0',
      engagements: [{ ...stored, applicationType: 'javascript:alert(1)' }],
      testStates: [],
    });
    expect(inspection.ok).toBe(false);
    expect(inspection.issues.join(' ')).toMatch(/unknown application type/i);
  });

  it('rejects oversized fields', async () => {
    const engagement = await createEngagement({
      name: 'Source 2',
      applicationType: 'web-app',
      context: {},
    });
    const stored = (await getEngagement(engagement.id))!;
    const states = await db.testStates.where('engagementId').equals(engagement.id).toArray();
    const inspection = inspectBackup({
      format: 'vapt-checklist-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      libraryVersion: '1.2.0',
      engagements: [{ ...stored, name: 'N'.repeat(5_000) }],
      testStates: [{ ...(states[0] as TestState), notes: 'x'.repeat(100_000) }],
    });
    expect(inspection.ok).toBe(false);
    expect(inspection.issues.join(' ')).toMatch(/oversized/i);
  });
});

describe('a failed save is never shown as a successful one', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('reports a rejected write instead of swallowing it', async () => {
    const engagement = await createEngagement({
      name: 'Failing writes',
      applicationType: 'web-app',
      context: { hasAuthentication: true },
    });
    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);
    await screen.findByRole('navigation', { name: 'Tests' });

    // Simulate the store refusing the write — a full quota looks like this.
    const put = vi
      .spyOn(db.testStates, 'put')
      .mockRejectedValue(Object.assign(new Error('The quota has been exceeded.'), {
        name: 'QuotaExceededError',
      }));

    const status = document.querySelectorAll<HTMLSelectElement>(
      'select[aria-label^="Status for"]',
    )[0];
    fireEvent.change(status, { target: { value: 'N/A' } });

    // The tester is told, with something they can act on.
    expect(await screen.findByText(/not saved/i)).toBeTruthy();
    expect(await screen.findByText(/out of storage/i)).toBeTruthy();
    put.mockRestore();
  });

  it('tells the tester when a note did not save, and keeps the text', async () => {
    const engagement = await createEngagement({
      name: 'Failing note',
      applicationType: 'web-app',
      context: { hasAuthentication: true },
    });
    window.location.hash = `#/e/${engagement.id}/workspace?test=AUTH-001`;
    render(<App />);
    const notes = await screen.findByLabelText(/^Notes for /);

    vi.spyOn(db.testStates, 'put').mockRejectedValue(new Error('database closed'));
    fireEvent.change(notes, { target: { value: 'Reproduced on /api/orders?id=2' } });

    // The budget must cover the 350 ms debounce plus a slow CI event loop —
    // the assertion is about the error surfacing, not about wall-clock speed.
    await waitFor(
      () => expect(screen.getByText(/Not saved — this note is only in the editor/)).toBeTruthy(),
      { timeout: 6_000 },
    );
    // The text is still on screen so it can be copied out.
    expect((notes as HTMLTextAreaElement).value).toContain('/api/orders?id=2');
  });
});

describe('search and filtering accept arbitrary input', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('handles regex metacharacters and control input without throwing', async () => {
    const engagement = await createEngagement({
      name: 'Search safety',
      applicationType: 'web-app',
      context: { hasAuthentication: true },
    });
    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);
    const search = await screen.findByLabelText(/Search tests by name/);

    for (const hostile of [
      '(', '[', '\\', '*+?', '(a+)+$', '.*', '<script>alert(1)</script>',
      "'; DROP TABLE --", '𝓊𝓃𝒾𝒸𝑜𝒹𝑒', ' '.repeat(50), 'a'.repeat(5_000),
    ]) {
      fireEvent.change(search, { target: { value: hostile } });
      // A render happened and the app is still alive.
      expect(screen.getByLabelText(/Search tests by name/)).toBeTruthy();
    }

    fireEvent.change(search, { target: { value: 'sql' } });
    const list = await screen.findByRole('navigation', { name: 'Tests' });
    await waitFor(() => expect(within(list).getByText('SQL Injection')).toBeTruthy());
  });

  it('renders script-like note content as text, never as markup', async () => {
    const engagement = await createEngagement({
      name: 'XSS attempt',
      applicationType: 'web-app',
      context: { hasAuthentication: true },
    });
    const payload = '<img src=x onerror="globalThis.__pwned = true">';
    await updateTestState(engagement.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
      notes: payload,
    });

    window.location.hash = `#/e/${engagement.id}`;
    render(<App />);
    expect(await screen.findByText(payload)).toBeTruthy();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();
  });
});
