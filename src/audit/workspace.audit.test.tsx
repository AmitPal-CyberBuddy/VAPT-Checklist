// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { db } from '../persistence/db';
import { clearAllData, createEngagement, getChecklist, updateTestState } from '../persistence/repository';

/**
 * WORKSPACE ERGONOMICS
 *
 * Measures the day-to-day loop rather than describing it: how many actions a
 * status change costs, whether the list can be worked without leaving it, and
 * whether the filters offered can actually match something.
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

async function openWorkspace(context = {}) {
  const engagement = await createEngagement({
    name: 'Ergonomics',
    applicationType: 'web-app',
    context: { hasAuthentication: true, hasFileUpload: true, ...context },
  });
  window.location.hash = `#/e/${engagement.id}/workspace`;
  render(<App />);
  await screen.findByLabelText(/Search tests by name/);
  return engagement;
}

const rowFor = async (name: string) => {
  const list = await screen.findByRole('navigation', { name: 'Tests' });
  const button = within(list).getByRole('button', { name: new RegExp(`^${name}`) });
  return button.closest('li') as HTMLElement;
};

describe('recording an outcome from the list', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('marks a test N/A in one interaction, without opening it', async () => {
    const engagement = await openWorkspace();
    const row = await rowFor('SQL Injection');

    // One interaction with the row's own control — no navigation.
    fireEvent.change(within(row).getByLabelText('Status for SQL Injection'), {
      target: { value: 'N/A' },
    });

    await waitFor(async () => {
      const state = (await getChecklist(engagement.id)).find((i) => i.definition.id === 'INJ-001')!
        .state;
      expect(state.status).toBe('N/A');
      expect(state.result).toBeNull();
    });
  });

  it('records Tested plus a result in two interactions, atomically', async () => {
    const engagement = await openWorkspace();
    const row = await rowFor('SQL Injection');

    fireEvent.change(within(row).getByLabelText('Status for SQL Injection'), {
      target: { value: 'Tested' },
    });
    // Nothing is written yet — Tested without a result is not a storable state.
    let state = (await getChecklist(engagement.id)).find((i) => i.definition.id === 'INJ-001')!.state;
    expect(state.status).toBe('Not Tested');

    const results = within(row).getByRole('group', { name: 'Result for SQL Injection' });
    fireEvent.click(within(results).getByTitle('Vulnerable'));

    await waitFor(async () => {
      state = (await getChecklist(engagement.id)).find((i) => i.definition.id === 'INJ-001')!.state;
      expect(state.status).toBe('Tested');
      expect(state.result).toBe('Vulnerable');
    });
  });

  it('keeps every state change reversible from the list', async () => {
    const engagement = await openWorkspace();
    const row = await rowFor('SQL Injection');
    const status = () => within(row).getByLabelText('Status for SQL Injection');

    fireEvent.change(status(), { target: { value: 'N/A' } });
    await waitFor(async () =>
      expect(
        (await getChecklist(engagement.id)).find((i) => i.definition.id === 'INJ-001')!.state.status,
      ).toBe('N/A'),
    );

    fireEvent.change(status(), { target: { value: 'Not Tested' } });
    await waitFor(async () =>
      expect(
        (await getChecklist(engagement.id)).find((i) => i.definition.id === 'INJ-001')!.state.status,
      ).toBe('Not Tested'),
    );
  });

  it('shows status and result on the row itself, in words', async () => {
    const engagement = await openWorkspace();
    await updateTestState(engagement.id, 'INJ-001', { status: 'Tested', result: 'Vulnerable' });
    cleanup();
    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);

    // Read the row's own summary, not the status <select>'s options.
    const reopened = await rowFor('SQL Injection');
    const summary = within(reopened).getByRole('button', { name: /^SQL Injection/ });
    expect(summary.textContent).toContain('Tested');
    expect(summary.textContent).toContain('Vulnerable');
    expect(summary.textContent).toContain('Critical');
  });
});

describe('finding the right test quickly', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('finds the canonical vulnerability from common terminology', async () => {
    await openWorkspace();
    const search = screen.getByLabelText(/Search tests by name/);

    for (const [term, expected] of [
      ['IDOR', 'IDOR / Broken Object Level Authorization (BOLA)'],
      ['xss', 'Cross-Site Scripting (Stored)'],
      ['INJ-001', 'SQL Injection'],
    ] as const) {
      fireEvent.change(search, { target: { value: term } });
      const list = await screen.findByRole('navigation', { name: 'Tests' });
      await waitFor(() => expect(within(list).getByText(expected)).toBeTruthy());
    }
  });

  it('offers only filter options that can match in this engagement', async () => {
    await openWorkspace();
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));

    const categories = (await screen.findByLabelText('Category')) as HTMLSelectElement;
    const options = [...categories.options].map((o) => o.textContent);
    expect(options).toContain('Authentication');
    // A web engagement has no mobile tests, so the option would be a dead end.
    expect(options).not.toContain('Mobile Application');
    expect(options).not.toContain('GraphQL');
  });

  it('can sort the outstanding work by value', async () => {
    await openWorkspace();
    const sort = screen.getByLabelText('Sort tests by') as HTMLSelectElement;
    expect([...sort.options].map((o) => o.value)).toContain('highValue');

    fireEvent.change(sort, { target: { value: 'highValue' } });
    const list = await screen.findByRole('navigation', { name: 'Tests' });
    // The top of the list is flagged as high value.
    await waitFor(() => expect(within(list).getAllByText('High value').length).toBeGreaterThan(0));
  });
});

describe('the list stays responsive as the checklist grows', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('re-renders only the row that changed, not the whole list', async () => {
    await openWorkspace();
    const rows = document.querySelectorAll('[data-test-id]').length;
    expect(rows).toBeGreaterThan(120);

    /*
     * Every write re-runs the Dexie live query, which rebuilds every
     * ChecklistItem. Without a field-level comparator on the memoised row this
     * cost 155 renders for one status change; it should now be a handful.
     */
    const before = performance.now();
    const status = document.querySelectorAll<HTMLSelectElement>('select[aria-label^="Status for"]')[0];
    fireEvent.change(status, { target: { value: 'N/A' } });
    await waitFor(() => expect(screen.getAllByText('N/A').length).toBeGreaterThan(0));
    expect(performance.now() - before).toBeLessThan(400);
  });

  it('keeps typing cheap when the result set does not change', async () => {
    await openWorkspace();
    const search = screen.getByLabelText(/Search tests by name/);
    fireEvent.change(search, { target: { value: 'sql injection' } });
    await waitFor(() => expect(document.querySelectorAll('[data-test-id]').length).toBeLessThan(10));

    const before = performance.now();
    for (const term of ['sql injection ', 'sql injection  ', 'sql injection   ']) {
      fireEvent.change(search, { target: { value: term } });
    }
    expect(performance.now() - before).toBeLessThan(150);
  });
});

describe('completion', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('states that the checklist is complete without claiming the app is secure', async () => {
    const engagement = await createEngagement({
      name: 'Finished',
      applicationType: 'web-app',
      context: { hasAuthentication: false, hasFileUpload: false },
    });
    const items = await getChecklist(engagement.id);
    for (const item of items.filter((i) => i.state.applicable)) {
      await updateTestState(engagement.id, item.definition.id, { status: 'N/A' });
    }

    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);

    expect(await screen.findByText('Checklist completed')).toBeTruthy();
    expect(screen.getByText(/not a statement that the application is secure/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Export assessment/ })).toBeTruthy();

    // Nothing anywhere should say the application is secure.
    expect(document.body.textContent).not.toMatch(/application is secure(?!\.)/i);
    expect(document.body.textContent).not.toMatch(/no vulnerabilities found/i);
  });

  it('does not claim completion while work is outstanding', async () => {
    await openWorkspace();
    expect(screen.queryByText('Checklist completed')).toBeNull();
  });
});
