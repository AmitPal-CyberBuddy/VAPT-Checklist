// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import App from '../App';
import { db } from '../persistence/db';
import { TEST_LIBRARY } from '../data/library';
import {
  applyApplicability,
  clearAllData,
  createEngagement,
  getChecklist,
  getEngagement,
  previewApplicability,
  updateTestState,
} from '../persistence/repository';
import { computeMetrics, countsAreConsistent } from '../domain/metrics';
import { effectiveContext } from '../domain/context';
import { suggestApplicability } from '../domain/applicability';
import { planWorkbook } from '../export/excel';
import { vi } from 'vitest';


/**
 * After "Create engagement" the wizard writes ~150 checklist rows through
 * Dexie before navigating. RTL's act-wrapped find-by polling can starve
 * fake-indexeddb's task queue while that write is in flight (a knife-edge
 * that shifts with machine speed — observed on unchanged code), so the write
 * is allowed to settle inside act before the first post-create query. The
 * assertions themselves are unchanged.
 */
async function settleWizardWrite() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
}

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


/** Answer a boolean fact on the context screen, scoped to its row. */
function answerTri(label: string, tri: 'Yes' | 'No') {
  const text = screen.getByText(label, { exact: false });
const row = text.closest('div')!.parentElement!;
fireEvent.click(within(row).getByRole('radio', { name: tri }));
}
/** Pick one value from a single-select fact. */
function pickSingle(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
}
/** Pick a multi-select fact option, scoped to its row. */
function pickMulti(label: string, option: string) {
  const group = screen.getByRole('group', { name: label });
  fireEvent.click(within(group).getByRole('button', { name: option }));
}
/** Open a test in the workspace by searching its exact test ID. */
async function openTestById(id: string) {
  const search = await screen.findByLabelText(/Search tests by name/);
  fireEvent.change(search, { target: { value: id } });
  const list = await screen.findByRole('navigation', { name: 'Tests' });
const row = within(list).getAllByRole('button').find((b) => b.textContent?.includes(id));
expect(row).toBeTruthy();
fireEvent.click(row!);
}
describe('FINAL QA - complete user journey', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
    go('#/engagements');
  });
  afterEach(cleanup);

  // jsdom + fake-indexeddb under parallel CI load can exceed the 5s default
  // test budget without anything being wrong (observed on unchanged code).
  // The assertions are unchanged — only the patience.
  it('walks the whole journey and keeps every screen consistent', { timeout: 20000 }, async () => {
    render(<App />);

    /* ---- Create Engagement ------------------------------------------------ */
    fireEvent.click(await screen.findByRole('button', { name: 'New engagement' }));
    fireEvent.change(await screen.findByLabelText(/Engagement name/), {
      target: { value: 'QA Journey Engagement' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choose application type' }));

    /* ---- Application type --------------------------------------------------- */
    fireEvent.click(await screen.findByRole('button', { name: /Web Application.*Supported/s }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    /* ---- Context ------------------------------------------------------------ */
    answerTri('Internet facing', 'Yes');
    answerTri('Application has authentication', 'Yes');
    pickMulti('Authentication / session mechanisms', 'Server-side session cookie');
    pickMulti('Authentication / session mechanisms', 'JWT / bearer token');
    answerTri('Multiple roles or privilege levels', 'Yes');
    pickSingle('Primary datastore', 'sql');
    answerTri('Handles personal data', 'Yes');
    answerTri('Multi-tenant', 'Yes');
    answerTri('Users own individual records or objects', 'Yes');
    answerTri('File upload', 'Yes');
    answerTri('File download', 'Yes');
    answerTri('Data export', 'No');
    answerTri('Multi-step workflows or transactions', 'Yes');
    answerTri('Makes server-side calls to other services', 'Yes');
    pickSingle('Hosting model', 'cloud');
    answerTri('Behind a CDN', 'Yes');
    pickSingle('Testing approach', 'grey-box');

    /* ---- Review: applicable tests ------------------------------------------ */
    const applicablePill = await screen.findByText(/tests applicable/);
    const expectedApplicable = Number(applicablePill.textContent!.match(/(\d+) of/)![1]);
    fireEvent.click(screen.getByRole('button', { name: 'Review checklist' }));
    expect(await screen.findByText('Generated checklist')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create engagement' }));
    await settleWizardWrite();

    /* ---- Dashboard after create ----------------------------------------------- */
    expect(
      await screen.findByRole('heading', { name: 'QA Journey Engagement' }, { timeout: 5000 }),
    ).toBeTruthy();
    const engagementId = (await db.engagements.toArray())[0].id;

    // Seeding matches what the wizard promised, one row per library test.

    const items = await getChecklist(engagementId);
    expect(items.length).toBe(TEST_LIBRARY.length);
    expect(items.filter((i) => i.state.applicable).length).toBe(expectedApplicable);
    expect(countsAreConsistent(computeMetrics(items).counts)).toBe(true);
    const metrics = computeMetrics(items);

    /* ---- Testing & Results: workspace ----------------------------------- */
    fireEvent.click(
      await screen.findByRole('link', { name: /Open testing workspace/ }, { timeout: 5000 }),
    );
    const applicable = items.filter((i) => i.state.applicable);
    const t1 = applicable.find((i) => i.definition.id.startsWith('INJ')) ?? applicable[0];
    const t2 = applicable.find((i) => i.definition.id !== t1.definition.id) ?? applicable[1];
    const t3 = applicable.find((i) => i.definition.id !== t1.definition.id && i.definition.id !== t2.definition.id) ?? applicable[2];

    // T1 - Tested → Vulnerable + note (one atomic record; note auto-saves).
    await openTestById(t1.definition.id);
    await screen.findByRole('heading', { name: t1.definition.vulnerabilityName }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('radio', { name: 'Tested' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Vulnerable' }));
    fireEvent.change(screen.getByLabelText(`Notes for ${t1.definition.vulnerabilityName}`), {
      target: { value: 'Reproduced: payload reflected in the error page.' },
    });

    // T2 - N/A in one interaction.

    await openTestById(t2.definition.id);
    await screen.findByRole('heading', { name: t2.definition.vulnerabilityName });
    fireEvent.click(screen.getByRole('radio', { name: 'N/A' }));

    // T3 - Tested → Not Vulnerable.
    await openTestById(t3.definition.id);
    await screen.findByRole('heading', { name: t3.definition.vulnerabilityName });
    fireEvent.click(screen.getByRole('radio', { name: 'Tested' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Not Vulnerable' }));

    // Wait for the debounced note write.
    await waitFor(async () => {
      const s = (await getChecklist(engagementId)).find((i) => i.definition.id === t1.definition.id)!.state;
      expect(s.notes).toContain('Reproduced: payload');
    });

    /* ---- Dashboard: reflects the recorded work -------------------------------- */
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    const vulnRegion = await screen.findByRole('region', { name: 'Vulnerable tests' });
    expect(within(vulnRegion).getByText(t1.definition.vulnerabilityName)).toBeTruthy();

    /* ---- Excel export: sheet composition and row selection ------------------ */
    const stored = (await getEngagement(engagementId))!;
    const storedItems = await getChecklist(engagementId);
    const storedMetrics = computeMetrics(storedItems);
    const [summary, assessment, vuln, notApplicable, coverage] = planWorkbook(stored, storedItems);

    expect(summary.name).toBe('Engagement Summary');
    expect(assessment.name).toBe('Assessment');
    expect(vuln.name).toBe('Vulnerable Tests');
    expect(notApplicable.name).toBe('Not Applicable');
    expect(coverage.name).toBe('Coverage');

    const assessmentRows = assessment.data.slice(1);
    expect(assessmentRows.length).toBe(storedMetrics.counts.applicable);
    expect(assessmentRows.length).toBe(metrics.counts.applicable);
    const t1row = assessmentRows.find((r) => String((r[0] as { value: unknown }).value) === t1.definition.id)!;
    expect(String((t1row[5] as { value: unknown }).value)).toBe('Tested');
    expect(String((t1row[6] as { value: unknown }).value)).toBe('Vulnerable');
    expect(String((t1row[7] as { value: unknown }).value)).toContain('Reproduced: payload');

    const vulnRows = vuln.data.slice(1);
    expect(vulnRows.length).toBe(storedMetrics.counts.vulnerable);
    expect(vulnRows.some((r) => String((r[0] as { value: unknown }).value) === t1.definition.id)).toBe(true);

    const naRows = notApplicable.data.slice(1);
    expect(naRows.length).toBe(storedMetrics.counts.excluded);
    const totalRow = coverage.data[coverage.data.length - 1];
    expect(Number((totalRow[1] as { value: unknown }).value)).toBe(storedMetrics.counts.applicable);
    expect(countsAreConsistent(storedMetrics.counts)).toBe(true);
  });

  it('exports the same applicability explanation the UI uses (derived context)', async () => {
    const engagement = await createEngagement({
      name: 'Excel applicability check',
      applicationType: 'rest-api',
      context: { hasAuthentication: true },
    });
    const items = await getChecklist(engagement.id);
    const [, assessment] = planWorkbook(engagement, items);
    const rows = assessment.data.slice(1);
    expect(rows.length).toBeGreaterThan(0);
    const effective = effectiveContext(engagement);
    for (const row of rows) {
      const testId = String((row[0] as { value: unknown }).value);
      const definition = TEST_LIBRARY.find((t) => t.id === testId)!;
      const expected = suggestApplicability(definition, effective).summary;
      expect(String((row[11] as { value: unknown }).value)).toBe(expected);
    }
  });
  it('keeps a Not Tested test carrying only notes applicable when context would exclude it', async () => {
    const engagement = await createEngagement({
      name: 'Notes protected',
      applicationType: 'web-app',
      context: { hasFileUpload: true },
    });
    const def = TEST_LIBRARY.find(
      (d) => d.applicability.kind === 'fact' && d.applicability.fact === 'hasFileUpload' && d.applicability.equals === true,
    );
    expect(def).toBeTruthy();
    await updateTestState(engagement.id, def!.id, { notes: 'Upload endpoint investigated, results pending.' });
    const diffs = await previewApplicability(engagement.id, { hasFileUpload: false });
    const change = diffs.find((d) => d.testId === def!.id);
    expect(change?.hasRecordedWork).toBe(true);
    await applyApplicability(engagement.id, { hasFileUpload: false });
    const item = (await getChecklist(engagement.id)).find((i) => i.definition.id === def!.id)!;
    expect(item.state.applicable).toBe(true);
    expect(item.state.notes).toContain('Upload endpoint investigated');
  });

  it('never lets a malformed stored engagement crash a screen', async () => {
    const engagement = await createEngagement({
      name: 'Hostile row',
      applicationType: 'rest-api',
      context: {},
    });
    await db.engagements.update(engagement.id, { scope: 'not-an-array' as never });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      go(`#/e/${engagement.id}`);
      render(<App />);
      expect(await screen.findByText('Application URL')).toBeTruthy();
      expect(screen.queryByText(/Something went wrong/)).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
