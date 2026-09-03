// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { db } from '../persistence/db';
import { clearAllData, createEngagement } from '../persistence/repository';

/**
 * The command palette is navigation surface: Ctrl/⌘-K opens it from anywhere,
 * results are keyboard-driven, and following one navigates without touching
 * any data. These tests pin that contract.
 */

/** jsdom reports every media query as false; say we are on a wide screen. */
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

async function openPalette() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  return screen.findByRole('dialog', { name: 'Command palette' });
}

describe('command palette', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    window.location.hash = '#/engagements';
    setViewport(true);
  });

  afterEach(cleanup);

  it('opens on Ctrl+K, searches and navigates to a screen', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Engagements', level: 1 });

    const dialog = await openPalette();
    const input = within(dialog).getByLabelText(/Search commands, engagements and tests/);
    fireEvent.change(input, { target: { value: 'library' } });

    // The first result is the Test Library destination; Enter follows it.
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(
      await screen.findByRole('heading', { name: 'Test library', level: 1 }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull(),
    );
  });

  it('jumps straight to an engagement dashboard', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Palette Target',
      context: { hasAuthentication: true },
    });

    render(<App />);
    await screen.findByText('Palette Target');

    const dialog = await openPalette();
    const input = within(dialog).getByLabelText(/Search commands, engagements and tests/);
    fireEvent.change(input, { target: { value: 'Palette Target' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(
      (await screen.findAllByRole('heading', { name: 'Palette Target' })).length,
    ).toBeGreaterThan(0);
    expect(window.location.hash).toBe(`#/e/${engagement.id}`);
  });

  it('finds a library test and deep-links to it expanded', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Engagements', level: 1 });

    const dialog = await openPalette();
    const input = within(dialog).getByLabelText(/Search commands, engagements and tests/);
    fireEvent.change(input, { target: { value: 'SQL Injection' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByRole('heading', { name: 'Test library', level: 1 })).toBeTruthy();
    // The row for INJ-001 is present and expanded by the deep link.
    await waitFor(() => expect(window.location.hash).toContain('test=INJ-001'));
    const row = document.getElementById('library-test-INJ-001');
    expect(row).toBeTruthy();
    expect(
      within(row as HTMLElement).getByRole('button', { name: /SQL Injection/ }).getAttribute(
        'aria-expanded',
      ),
    ).toBe('true');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Engagements', level: 1 });

    await openPalette();
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull(),
    );
    expect(document.activeElement?.id).toBe('command-palette-trigger');
  });

  it('shows an honest empty state when nothing matches', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Engagements', level: 1 });

    const dialog = await openPalette();
    fireEvent.change(
      within(dialog).getByLabelText(/Search commands, engagements and tests/),
      { target: { value: 'zzzz-nothing-matches-this' } },
    );

    expect(await within(dialog).findByText(/No matches for/)).toBeTruthy();
  });
});
