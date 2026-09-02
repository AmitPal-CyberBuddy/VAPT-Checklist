// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { db } from '../persistence/db';
import {
  bulkUpdateTestStates,
  clearAllData,
  createEngagement,
  listStates,
} from '../persistence/repository';

/**
 * ENGAGEMENT-LEVEL VALIDATION
 *
 * The per-test rule "Tested requires a result" has an engagement-level
 * sibling: "Completed" while applicable tests are still Not Tested claims the
 * checklist is resolved when it is not. The status dropdown must say so
 * loudly instead of silently taking the contradictory label — while keeping
 * the decision revisable, exactly like every other state in the product.
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

async function storedStatus(id: string) {
  return (await db.engagements.get(id))!.status;
}

async function openEngagement(id: string) {
  window.location.hash = `#/e/${id}`;
  render(<App />);
  const select = await screen.findByLabelText('Engagement status');
  // Wait until the checklist itself has loaded: the status guard reads the
  // checklist, and the counts only become authoritative at that point.
  await waitFor(() =>
    expect(screen.getAllByText(/[1-9]\d* Not Applicable/).length).toBeGreaterThan(0),
  );
  return select;
}

describe('marking an engagement Completed', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
    window.location.hash = '#/';
  });
  afterEach(cleanup);

  it('asks for confirmation while tests are outstanding — and Cancel writes nothing', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Still working on it',
      context: { hasAuthentication: true },
    });
    const select = await openEngagement(engagement.id);

    fireEvent.change(select, { target: { value: 'Completed' } });

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Mark engagement as Completed?');
    expect(dialog.textContent).toMatch(/still Not Tested/);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await storedStatus(engagement.id)).toBe('Active');
    // The dropdown snaps back to the stored value instead of lying.
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe('Active'));
  });

  it('records Completed only after the explicit confirmation, and stays revisable', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Confirm me',
      context: { hasAuthentication: true },
    });
    const select = await openEngagement(engagement.id);

    fireEvent.change(select, { target: { value: 'Completed' } });
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Mark Completed anyway' }));
    await waitFor(async () => expect(await storedStatus(engagement.id)).toBe('Completed'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe('Completed'));

    // Back to Active is never questioned — only the contradictory direction is.
    fireEvent.change(select, { target: { value: 'Active' } });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(async () => expect(await storedStatus(engagement.id)).toBe('Active'));
  });

  it('does not interrupt when there is genuinely nothing outstanding', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Fully resolved',
      context: { hasAuthentication: true },
    });
    // Resolve every outstanding applicable test in one bulk edit.
    const outstanding = (await listStates(engagement.id))
      .filter((s) => s.applicable && s.status === 'Not Tested')
      .map((s) => s.testId);
    await bulkUpdateTestStates(engagement.id, outstanding, { status: 'N/A' });

    const select = await openEngagement(engagement.id);
    fireEvent.change(select, { target: { value: 'Completed' } });

    // No dialog, straight through.
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(async () => expect(await storedStatus(engagement.id)).toBe('Completed'));
  });
});
