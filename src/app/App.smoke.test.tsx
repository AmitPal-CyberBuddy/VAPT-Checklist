// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { db } from '../persistence/db';
import { clearAllData, createEngagement, updateTestState } from '../persistence/repository';

/**
 * Smoke tests: the whole app mounts, routes resolve and live queries render
 * real IndexedDB data. Guards against runtime crashes that typechecking and
 * pure-domain tests cannot catch.
 */
describe('application shell', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    window.location.hash = '#/';
  });

  // Vitest runs without globals, so Testing Library's auto-cleanup is opt-in.
  afterEach(cleanup);

  it('renders the engagements screen with an empty state', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Engagements' })).toBeTruthy();
    expect(await screen.findByText('No engagements yet')).toBeTruthy();
    expect(screen.getByText(/184 tests/)).toBeTruthy();
  });

  it('lists a stored engagement with live progress', async () => {
    const engagement = await createEngagement({
      name: 'ACME Portal',
      clientName: 'ACME Ltd',
      context: { assetTypes: ['web-app'], hasAuthentication: true },
    });
    await updateTestState(engagement.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
    });

    render(<App />);
    expect(await screen.findByText('ACME Portal')).toBeTruthy();
    expect(await screen.findByText('ACME Ltd')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('1 finding')).toBeTruthy());
  });

  it('opens the engagement dashboard and shows derived metrics', async () => {
    const engagement = await createEngagement({
      name: 'Dashboard Target',
      context: { assetTypes: ['web-app'], hasAuthentication: true, hasFileUpload: false },
    });
    await updateTestState(engagement.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
      notes: 'Bypass confirmed.',
    });

    window.location.hash = `#/e/${engagement.id}`;
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Dashboard Target' })).toBeTruthy();
    const findings = await screen.findByText('Findings');
    const panel = findings.closest('div.panel') as HTMLElement;
    expect(within(panel).getByText('Authentication Bypass')).toBeTruthy();
    expect(within(panel).getByText('Bypass confirmed.')).toBeTruthy();
  });

  it('renders the testing workspace with status controls', async () => {
    const engagement = await createEngagement({
      name: 'Workspace Target',
      context: { assetTypes: ['web-app'], hasAuthentication: true },
    });
    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);

    expect(await screen.findByPlaceholderText(/Search name, alias, ID/)).toBeTruthy();
    expect(await screen.findByText('SQL Injection')).toBeTruthy();
    expect((await screen.findAllByText('Not Tested')).length).toBeGreaterThan(0);
    // Two-pane layout: the first test opens automatically in the detail pane.
    expect(await screen.findByText('Testing guidance')).toBeTruthy();
    expect(await screen.findByPlaceholderText(/Endpoints and parameters tested/)).toBeTruthy();
  });

  it('renders the bundled test library browser', async () => {
    window.location.hash = '#/library';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Test library' })).toBeTruthy();
    expect(await screen.findByText('Cross-Site Request Forgery (CSRF)')).toBeTruthy();
    // Subcategory is part of the row, not just the detail panel.
    expect((await screen.findAllByText('Request Forgery')).length).toBeGreaterThan(0);
  });

  it('finds a vulnerability in the library by one of its aliases', async () => {
    window.location.hash = '#/library';
    render(<App />);
    const search = await screen.findByPlaceholderText(/Search name, alias/);
    fireEvent.change(search, { target: { value: 'bola' } });
    await waitFor(() =>
      expect(
        screen.getByText('IDOR / Broken Object Level Authorization (BOLA)'),
      ).toBeTruthy(),
    );
    expect(screen.getByText(/Matched on synonyms/)).toBeTruthy();
  });

  it('explains why a test is in scope in the workspace', async () => {
    const engagement = await createEngagement({
      name: 'Explain Target',
      context: {
        assetTypes: ['web-app', 'rest-api'],
        hasAuthentication: true,
        hasUserOwnedResources: true,
        hasMultipleRoles: true,
      },
    });
    window.location.hash = `#/e/${engagement.id}/workspace?test=AUTHZ-002`;
    render(<App />);

    // Appears twice by design: in the list row and as the detail-pane heading.
    expect(
      await screen.findByRole('heading', {
        name: 'IDOR / Broken Object Level Authorization (BOLA)',
      }),
    ).toBeTruthy();
    expect(await screen.findByText('Applicable because:')).toBeTruthy();
    expect(await screen.findByText('Users own individual records or objects')).toBeTruthy();
    expect(await screen.findByText(/Also known as:/)).toBeTruthy();
  });

  it('shows how many tests a context question drives', async () => {
    const engagement = await createEngagement({ name: 'Context Impact' });
    window.location.hash = `#/e/${engagement.id}/context`;
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Application context' })).toBeTruthy();
    expect((await screen.findAllByText(/^\d+ tests$/)).length).toBeGreaterThan(5);
    expect((await screen.findAllByText('Report only')).length).toBe(2);
  });
});
