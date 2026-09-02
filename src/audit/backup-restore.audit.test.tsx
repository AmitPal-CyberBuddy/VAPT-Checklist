// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { db } from '../persistence/db';
import {
  clearAllData,
  createEngagement,
  exportBackup,
  getChecklist,
  updateTestState,
} from '../persistence/repository';
import { TEST_LIBRARY } from '../data/library';

/**
 * BACKUP & RESTORE, driven through the Settings screen it ships in.
 *
 * The repository suites prove the data layer; this file proves the *product*
 * keeps its promise: the file that downloading produces is the file the
 * import accepts, and a wipe in between loses nothing. Nothing here calls
 * importBackup directly — the import goes through the hidden file input and
 * the confirmation dialog, the only hands a tester has.
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

const go = (hash: string) => {
  window.location.hash = hash;
};

/** The object URL plumbing jsdom does not provide, with the blob captured. */
function stubDownloads() {
  const captured: { blob: Blob | null } = { blob: null };
  vi.stubGlobal('__captured', captured);
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
    captured.blob = blob as Blob;
    return 'blob:mock';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return captured;
}

async function seedEngagementWithWork() {
  const engagement = await createEngagement({
    applicationType: 'web-app',
    name: 'Round trip engagement',
    applicationUrl: 'https://roundtrip.example.com',
    context: { hasAuthentication: true, hasFileUpload: true },
  });
  await updateTestState(engagement.id, 'AUTH-001', {
    status: 'Tested',
    result: 'Vulnerable',
    notes: 'Captured pre-wipe — must survive the journey.',
  });
  await updateTestState(engagement.id, 'SESS-008', {
    applicable: false,
    applicabilitySource: 'manual',
  });
  return engagement;
}

describe('Settings → Backup & restore', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('the exported file restores everything after a full wipe', async () => {
    const engagement = await seedEngagementWithWork();
    const captured = stubDownloads();

    /* ---- Download the backup through the Settings UI -------------------- */
    go('#/settings');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Export all engagements (JSON)' }));

    await waitFor(() => expect(captured.blob).not.toBeNull());
    const fileText = await captured.blob!.text();
    const parsed = JSON.parse(fileText);
    expect(parsed.format).toBe('vapt-checklist-backup');
    expect(parsed.engagements).toHaveLength(1);
    expect(parsed.testStates).toHaveLength(TEST_LIBRARY.length);

    /* ---- The browser loses everything ------------------------------------ */
    await clearAllData();
    expect(await db.engagements.count()).toBe(0);

    /* ---- Restore through the file input + confirmation dialog ------------- */
    const backupFile = new File([fileText], 'vapt-checklist-backup.json', {
      type: 'application/json',
    });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [backupFile] },
    });

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Confirm import');
    expect(dialog.textContent).toContain('Round trip engagement');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await screen.findByText('Backup restored');
    expect(await db.engagements.count()).toBe(1);

    /* ---- The restored record is what was recorded, all of it -------------- */
    const items = await getChecklist(engagement.id);
    expect(items).toHaveLength(TEST_LIBRARY.length);
    const auth = items.find((i) => i.definition.id === 'AUTH-001')!.state;
    expect(auth.status).toBe('Tested');
    expect(auth.result).toBe('Vulnerable');
    expect(auth.notes).toContain('must survive the journey');
    expect(items.find((i) => i.definition.id === 'SESS-008')!.state.applicable).toBe(false);
  });

  it('rejects a tampered file in the dialog and imports nothing', async () => {
    const engagement = await seedEngagementWithWork();
    const before = await getChecklist(engagement.id);

    go('#/settings');
    render(<App />);
    const input = () => document.querySelector('input[type="file"]') as HTMLInputElement;

    /* Not a backup at all. */
    fireEvent.change(input(), {
      target: {
        files: [new File([JSON.stringify({ format: 'nope' })], 'nope.json', { type: 'application/json' })],
      },
    });
    let dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('This backup was rejected');
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    /* A real backup, hand-edited to Tested-without-a-result. */
    const valid = JSON.parse(JSON.stringify(await exportBackup(engagement.id)));
    const tampered = {
      ...valid,
      testStates: valid.testStates.map((s: { testId: string }) =>
        s.testId === 'AUTH-001' ? { ...s, status: 'Tested', result: null } : s,
      ),
    };
    fireEvent.change(input(), {
      target: {
        files: [new File([JSON.stringify(tampered)], 'tampered.json', { type: 'application/json' })],
      },
    });
    dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('This backup was rejected');
    expect(dialog.textContent).toMatch(/inconsistent/i);
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    /* Nothing moved. */
    expect(await db.engagements.count()).toBe(1);
    expect(await getChecklist(engagement.id)).toEqual(before);
  });
});
