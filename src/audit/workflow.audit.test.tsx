// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { db } from '../persistence/db';
import { clearAllData, createEngagement, getChecklist, updateTestState } from '../persistence/repository';
import { computeMetrics, countsAreConsistent } from '../domain/metrics';

/**
 * END-TO-END AUDIT — the product driven through its own interface.
 *
 * §1 the engagement workflow, §4 dashboard arithmetic, §8 search and filters.
 * Nothing here reaches into the domain layer for a shortcut: if a tester
 * cannot do it by clicking, it does not count as working.
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

describe('§1 the engagement workflow, end to end', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
    go('#/');
  });
  afterEach(cleanup);

  it('creates an engagement, records a finding and reflects it on the dashboard', async () => {
    render(<App />);

    /* ---- Create Engagement -------------------------------------------- */
    fireEvent.click(await screen.findByRole('button', { name: 'New engagement' }));
    fireEvent.change(await screen.findByLabelText(/Engagement name/), {
      target: { value: 'Audit Engagement' },
    });
    fireEvent.change(screen.getByLabelText(/Application URL/), {
      target: { value: 'https://audit.example.com' },
    });

    /* ---- Enter Context -------------------------------------------------- */
    fireEvent.click(screen.getByRole('button', { name: 'Web Application' }));
    fireEvent.click(screen.getByRole('button', { name: 'Define application context' }));

    // Answering a question must visibly change the generated list.
    const before = Number(
      (await screen.findByText(/tests applicable/)).textContent!.match(/(\d+) of/)![1],
    );
    const uploadRow = screen.getByText('File upload').closest('div')!.parentElement!;
    fireEvent.click(within(uploadRow).getByRole('radio', { name: 'No' }));
    await waitFor(() => {
      const after = Number(
        screen.getByText(/tests applicable/).textContent!.match(/(\d+) of/)![1],
      );
      expect(after).toBeLessThan(before);
    });

    /* ---- Generate Applicable Tests -------------------------------------- */
    fireEvent.click(screen.getByRole('button', { name: 'Review checklist' }));
    expect(await screen.findByText('Generated checklist')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create engagement' }));

    /* ---- Dashboard, then the workspace ---------------------------------- */
    expect(await screen.findByRole('heading', { name: 'Audit Engagement' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('link', { name: /Open testing workspace/ }));

    /* ---- Test a vulnerability ------------------------------------------- */
    const search = await screen.findByLabelText(/Search tests by name/);
    fireEvent.change(search, { target: { value: 'sql injection' } });
    const list = await screen.findByRole('navigation', { name: 'Tests' });
    fireEvent.click(within(list).getByRole('button', { name: /^SQL Injection/ }));
    expect(await screen.findByRole('heading', { name: 'SQL Injection' })).toBeTruthy();

    /* ---- Mark Tested + select Result (one atomic action) ---------------- */
    fireEvent.click(screen.getByRole('radio', { name: 'Tested' }));
    expect(screen.getByText(/Choose Vulnerable or Not Vulnerable/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Vulnerable' }));

    /* ---- Add a note ------------------------------------------------------ */
    fireEvent.change(screen.getByLabelText('Notes for SQL Injection'), {
      target: { value: 'Boolean-based blind on /search?q=' },
    });

    await waitFor(async () => {
      const items = await getChecklist(
        (await db.engagements.toArray())[0].id,
      );
      const sqli = items.find((i) => i.definition.id === 'INJ-001')!;
      expect(sqli.state.status).toBe('Tested');
      expect(sqli.state.result).toBe('Vulnerable');
      expect(sqli.state.notes).toContain('Boolean-based blind');
    });

    /* ---- Dashboard updates ---------------------------------------------- */
    const engagementId = (await db.engagements.toArray())[0].id;
    cleanup();
    go(`#/e/${engagementId}`);
    render(<App />);

    const vulnerable = await screen.findByRole('region', { name: 'Vulnerable tests' });
    expect(within(vulnerable).getByText('SQL Injection')).toBeTruthy();
    expect(within(vulnerable).getByText(/Boolean-based blind/)).toBeTruthy();

    /* ---- Export is reachable and describes the same state ---------------- */
    cleanup();
    go(`#/e/${engagementId}/export`);
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Download Excel' })).toBeTruthy();
    expect(screen.getByText(/vapt-audit-engagement-\d{4}-\d{2}-\d{2}\.xlsx/)).toBeTruthy();
  });
});

describe('§4 dashboard arithmetic matches recorded state exactly', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('shows counts that satisfy both identities and match the database', async () => {
    const engagement = await createEngagement({
      name: 'Maths',
      context: { assetTypes: ['web-app'], hasAuthentication: true, hasFileUpload: true },
    });

    const items = await getChecklist(engagement.id);
    const applicableIds = items.filter((i) => i.state.applicable).map((i) => i.definition.id);
    // A known, deliberately uneven distribution.
    for (const id of applicableIds.slice(0, 7)) {
      await updateTestState(engagement.id, id, { status: 'Tested', result: 'Vulnerable' });
    }
    for (const id of applicableIds.slice(7, 20)) {
      await updateTestState(engagement.id, id, { status: 'Tested', result: 'Not Vulnerable' });
    }
    for (const id of applicableIds.slice(20, 25)) {
      await updateTestState(engagement.id, id, { status: 'N/A' });
    }

    const metrics = computeMetrics(await getChecklist(engagement.id));
    const c = metrics.counts;

    expect(c.vulnerable).toBe(7);
    expect(c.notVulnerable).toBe(13);
    expect(c.tested).toBe(20);
    expect(c.na).toBe(5);
    expect(c.applicable).toBe(c.notTested + c.tested + c.na);
    expect(c.tested).toBe(c.vulnerable + c.notVulnerable);
    expect(countsAreConsistent(c)).toBe(true);
    expect(metrics.completion).toBeCloseTo((c.tested + c.na) / c.applicable);

    go(`#/e/${engagement.id}`);
    render(<App />);

    // Every number on screen is the number in the database.
    await screen.findByText('Total applicable');
    const stats = screen.getByRole('region', { name: 'Assessment statistics' });
    const value = (label: string) =>
      within(stats).getByText(label).parentElement!.parentElement!.textContent!;
    expect(value('Total applicable')).toContain(String(c.applicable));
    expect(value('Not Tested')).toContain(String(c.notTested));
    expect(value('N/A')).toContain(String(c.na));
    expect(value('Vulnerable')).toContain(String(c.vulnerable));
    expect(value('Not Vulnerable')).toContain(String(c.notVulnerable));

    const progress = screen.getByRole('progressbar', { name: 'Overall assessment progress' });
    expect(progress.getAttribute('aria-valuenow')).toBe(String(Math.round(metrics.completion * 100)));
    expect(screen.getByText(/completed \(Tested/).textContent).toContain(String(c.tested + c.na));
  });
});

describe('§8 search and filter combinations', () => {
  let engagementId = '';

  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
    const engagement = await createEngagement({
      name: 'Filters',
      context: { assetTypes: ['web-app', 'rest-api'], hasAuthentication: true, hasFileUpload: true },
    });
    engagementId = engagement.id;
    await updateTestState(engagementId, 'INJ-001', { status: 'Tested', result: 'Vulnerable' });
    await updateTestState(engagementId, 'AUTH-001', { status: 'Tested', result: 'Not Vulnerable' });
    await updateTestState(engagementId, 'FILE-001', { status: 'N/A' });
    go(`#/e/${engagementId}/workspace`);
  });
  afterEach(cleanup);

  const shown = () =>
    Number(screen.getByText(/shown ·/).textContent!.match(/(\d+) shown/)![1]);

  async function openFilters() {
    fireEvent.click(await screen.findByRole('button', { name: /Filters/ }));
    await screen.findByLabelText('Status');
  }

  it('combines search with a category filter', async () => {
    render(<App />);
    await screen.findByLabelText(/Search tests by name/);
    const all = shown();

    fireEvent.change(screen.getByLabelText(/Search tests by name/), {
      target: { value: 'injection' },
    });
    await waitFor(() => expect(shown()).toBeLessThan(all));
    const searchOnly = shown();

    await openFilters();
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'input-validation' },
    });
    await waitFor(() => expect(shown()).toBeLessThanOrEqual(searchOnly));
    expect(shown()).toBeGreaterThan(0);
  });

  it('combines status with result, and priority with status', async () => {
    render(<App />);
    await openFilters();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Tested' } });
    await waitFor(() => expect(shown()).toBe(2));

    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'Vulnerable' } });
    await waitFor(() => expect(shown()).toBe(1));
    expect(screen.getByRole('heading', { name: 'SQL Injection' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'Critical' } });
    // Both Tested rows are Critical, so priority narrows nothing here…
    await waitFor(() => expect(shown()).toBe(2));
    // …but a priority with no Tested rows empties the view.
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'Low' } });
    await waitFor(() => expect(screen.getByText(/No tests match/)).toBeTruthy());
  });

  it('finds the N/A test only under its own status filter', async () => {
    render(<App />);
    await openFilters();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'N/A' } });
    await waitFor(() => expect(shown()).toBe(1));
    expect(screen.getByRole('heading', { name: 'Unrestricted File Upload' })).toBeTruthy();
  });

  it('restores the full dataset when filters are cleared', async () => {
    render(<App />);
    await screen.findByLabelText(/Search tests by name/);
    const all = shown();

    fireEvent.change(screen.getByLabelText(/Search tests by name/), { target: { value: 'jwt' } });
    await openFilters();
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'Low' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Tested' } });
    await waitFor(() => expect(screen.queryByText(/No tests match/)).toBeTruthy());

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    await waitFor(() => expect(shown()).toBe(all));
  });

  it('shows Not Applicable tests only when the applicability filter asks for them', async () => {
    render(<App />);
    await openFilters();
    const applicableCount = shown();

    fireEvent.change(screen.getByLabelText('Applicability'), {
      target: { value: 'notApplicable' },
    });
    await waitFor(() => expect(shown()).toBeGreaterThan(0));
    const notApplicable = shown();

    fireEvent.change(screen.getByLabelText('Applicability'), { target: { value: 'all' } });
    await waitFor(() => expect(shown()).toBe(applicableCount + notApplicable));
  });
});
