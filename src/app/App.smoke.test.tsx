// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { db } from '../persistence/db';
import { clearAllData, createEngagement, updateTestState } from '../persistence/repository';

/**
 * Smoke tests: the whole app mounts, routes resolve, live queries render real
 * IndexedDB data — plus the interface guarantees that are easy to regress:
 * canonical vocabulary, accessible names and non-colour status indicators.
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

describe('application shell', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    window.location.hash = '#/engagements';
    setViewport(true);
  });

  // Vitest runs without globals, so Testing Library's auto-cleanup is opt-in.
  afterEach(cleanup);

  it('renders the engagements screen with an empty state', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Engagements', level: 1 })).toBeTruthy();
    expect(await screen.findByText('No engagements yet')).toBeTruthy();
  });

  it('exposes landmarks, a skip link and a primary navigation', async () => {
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Skip to main content' })).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Engagements' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Test Library' })).toBeTruthy();
  });

  it('lists a stored engagement with live progress', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'ACME Portal',
      clientName: 'ACME Ltd',
      applicationUrl: 'https://acme.example.com',
      context: { hasAuthentication: true },
    });
    await updateTestState(engagement.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
    });

    render(<App />);
    expect(await screen.findByText('ACME Portal')).toBeTruthy();
    expect(await screen.findByText('ACME Ltd')).toBeTruthy();
    // Canonical vocabulary — never "findings", "issues" or "failed".
    await waitFor(() => expect(screen.getByText('1 vulnerable')).toBeTruthy());
    expect(screen.getByRole('progressbar', { name: 'ACME Portal progress' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Download Excel for ACME Portal' }),
    ).toBeTruthy();
  });

  it('shows engagement identity, the six statistics and the vulnerable list on the dashboard', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Dashboard Target',
      applicationUrl: 'https://app.example.com',
      context: { hasAuthentication: true, hasFileUpload: false },
    });
    await updateTestState(engagement.id, 'AUTH-001', {
      status: 'Tested',
      result: 'Vulnerable',
      notes: 'Bypass confirmed.',
    });

    window.location.hash = `#/e/${engagement.id}`;
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Dashboard Target' })).toBeTruthy();
    expect(await screen.findByText('Total applicable')).toBeTruthy();
    // Shown in the engagement header and again on the dashboard identity card.
    expect(screen.getAllByText('https://app.example.com').length).toBeGreaterThan(0);

    for (const stat of ['Total applicable', 'Tested', 'Not Tested', 'N/A', 'Vulnerable', 'Not Vulnerable']) {
      expect(screen.getAllByText(stat).length).toBeGreaterThan(0);
    }

    const vulnerable = await screen.findByRole('region', { name: 'Vulnerable tests' });
    expect(within(vulnerable).getByText('Authentication Bypass')).toBeTruthy();
    expect(within(vulnerable).getByText('Bypass confirmed.')).toBeTruthy();

    // High-value section leads with what to do next, and links into the workspace.
    const highValue = await screen.findByRole('region', { name: 'High-value tests' });
    expect(within(highValue).getAllByText('Not Tested').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Open testing workspace/ })).toBeTruthy();
  });

  it('renders the testing workspace with status and result controls', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Workspace Target',
      context: { hasAuthentication: true },
    });
    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);

    expect(await screen.findByLabelText(/Search tests by name/)).toBeTruthy();
    expect(await screen.findByText('SQL Injection')).toBeTruthy();
    expect(await screen.findByText('Testing guidance')).toBeTruthy();

    // Status and result are separate, labelled groups — never one merged control.
    expect(screen.getByRole('radiogroup', { name: 'Testing status' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Testing result' })).toBeTruthy();
    // Glyphs are decorative: the accessible name is the plain canonical label.
    expect(screen.getByRole('radio', { name: 'Not Tested' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Vulnerable' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Not Vulnerable' })).toBeTruthy();
  });

  it('keeps the filter panel collapsed until it is asked for', async () => {
    const engagement = await createEngagement({ applicationType: 'web-app',
      name: 'Filters' });
    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);

    const toggle = await screen.findByRole('button', { name: /Filters/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByLabelText('Subcategory')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByLabelText('Subcategory')).toBeTruthy();
    expect(screen.getByLabelText('Applicability')).toBeTruthy();
  });

  it('offers a specific empty state when a search matches nothing', async () => {
    const engagement = await createEngagement({ applicationType: 'web-app',
      name: 'Search' });
    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);

    const search = await screen.findByLabelText(/Search tests by name/);
    fireEvent.change(search, { target: { value: 'zzzzz-no-such-test' } });

    expect(await screen.findByText(/No tests match/)).toBeTruthy();
    // Same action, same words, wherever it appears.
    expect(screen.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThan(0);
  });

  it('renders the bundled test library browser', async () => {
    window.location.hash = '#/library';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Test library', level: 1 })).toBeTruthy();
    expect(await screen.findByText('Cross-Site Request Forgery (CSRF)')).toBeTruthy();
    expect((await screen.findAllByText('Request Forgery')).length).toBeGreaterThan(0);
  });

  it('finds a vulnerability in the library by one of its aliases', async () => {
    window.location.hash = '#/library';
    render(<App />);
    const search = await screen.findByLabelText('Search the test library');
    fireEvent.change(search, { target: { value: 'bola' } });
    await waitFor(() =>
      expect(screen.getByText('IDOR / Broken Object Level Authorization (BOLA)')).toBeTruthy(),
    );
    expect(screen.getByText(/Matched on synonyms/)).toBeTruthy();
  });

  it('explains why a test is applicable in the workspace', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Explain Target',
      context: {
        additionalSurfaces: ['rest-api'],
        hasAuthentication: true,
        hasUserOwnedResources: true,
        hasMultipleRoles: true,
      },
    });
    window.location.hash = `#/e/${engagement.id}/workspace?test=AUTHZ-002`;
    render(<App />);

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
    const engagement = await createEngagement({ applicationType: 'web-app',
      name: 'Context Impact' });
    window.location.hash = `#/e/${engagement.id}/context`;
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Application context' })).toBeTruthy();
    expect((await screen.findAllByText(/^\d+ tests$/)).length).toBeGreaterThan(5);
    expect((await screen.findAllByText('Report only')).length).toBe(2);
  });
});

describe('landing page', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    window.location.hash = '#/';
    setViewport(true);
  });

  afterEach(cleanup);

  it('opens on the landing page and links into the tool', async () => {
    render(<App />);

    expect(
      await screen.findByRole('heading', {
        name: /Penetration testing methodology/,
        level: 1,
      }),
    ).toBeTruthy();
    // Live library stats, not copy-pasted marketing numbers.
    expect(screen.getByText('Methodology checks')).toBeTruthy();
    expect(screen.getByText('One objective per check')).toBeTruthy();

    const start = screen.getByRole('link', { name: 'Start an assessment' });
    expect(start.getAttribute('href')).toContain('/engagements/new');
    expect(screen.getByRole('link', { name: 'Explore the test library' }).getAttribute('href')).toContain(
      '/library',
    );
    // A visitor can also reach the app itself from the primary navigation.
    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Engagements' })).toBeTruthy();
  });

  it('explains how it works and how to connect with the maintainer', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: /Penetration testing methodology/ });
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeTruthy();
    expect(screen.getByText('Export the report')).toBeTruthy();

    const linkedin = screen.getByRole('link', { name: 'Connect on LinkedIn' });
    expect(linkedin.getAttribute('href')).toBe('https://www.linkedin.com/in/amitpal-wb/');
    expect(linkedin.getAttribute('target')).toBe('_blank');
    expect(linkedin.getAttribute('rel')).toContain('noopener');

    const issues = screen.getByRole('link', { name: /Suggest an upgrade or report a problem/ });
    expect(issues.getAttribute('href')).toContain('VAPT-Checklist/issues');
  });
});

describe('keyboard ergonomics', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('makes the test list a single tab stop (roving tabindex)', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Roving',
      context: { hasAuthentication: true },
    });
    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);

    const list = await screen.findByRole('navigation', { name: 'Tests' });
    const rows = within(list)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('tabindex') !== null);
    expect(rows.length).toBeGreaterThan(50);

    // Exactly one row is reachable with Tab; the rest are arrow-key targets.
    const tabbable = rows.filter((b) => b.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].getAttribute('aria-current')).toBe('true');
  });

  it('announces the active test to screen readers', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Announce',
      context: { hasAuthentication: true },
    });
    window.location.hash = `#/e/${engagement.id}/workspace?test=AUTH-001`;
    render(<App />);

    await screen.findByText('Testing guidance');
    const live = document.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(live?.textContent).toContain('Authentication Bypass');
    expect(live?.textContent).toContain('Status Not Tested');
  });

  it('traps Tab inside a modal and closes it on Escape', async () => {
    const engagement = await createEngagement({ applicationType: 'web-app',
      name: 'Trap me' });
    window.location.hash = '#/engagements';
    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: `Delete ${engagement.name}` }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const focusable = within(dialog).getAllByRole('button');
    const last = focusable[focusable.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(focusable[0]);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('narrow viewports', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(false);
  });
  afterEach(cleanup);

  it('shows the list first and swaps to the test detail, with a way back', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Small screen',
      context: { hasAuthentication: true },
    });
    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);

    // List only — no squeezed two-pane layout.
    const list = await screen.findByRole('navigation', { name: 'Tests' });
    expect(screen.queryByText('Testing guidance')).toBeNull();

    // "NoSQL Injection" also contains the phrase, so anchor the match.
    fireEvent.click(within(list).getByRole('button', { name: /^SQL Injection/ }));

    expect(await screen.findByText('Testing guidance')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Tests' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'All tests' }));
    expect(await screen.findByRole('navigation', { name: 'Tests' })).toBeTruthy();
  });
});

describe('status is never communicated by colour alone', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('pairs every status, result and priority with a text label', async () => {
    const engagement = await createEngagement({
      applicationType: 'web-app',
      name: 'Non-colour',
      context: { hasAuthentication: true },
    });
    await updateTestState(engagement.id, 'AUTH-001', { status: 'Tested', result: 'Vulnerable' });
    await updateTestState(engagement.id, 'AUTH-003', { status: 'N/A' });

    window.location.hash = `#/e/${engagement.id}/workspace`;
    render(<App />);

    const list = await screen.findByRole('navigation', { name: 'Tests' });
    // Each row states its status and result in words, not just a coloured dot.
    expect(within(list).getAllByText('Not Tested').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Tested').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Vulnerable').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('N/A').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Critical').length).toBeGreaterThan(0);
  });
});
