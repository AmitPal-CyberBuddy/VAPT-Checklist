// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AppWithBoundary } from '../App';
import { db } from '../persistence/db';
import { clearAllData, createEngagement, getChecklist } from '../persistence/repository';
import { TEST_LIBRARY, libraryStats } from '../data/library';
import { coverageFor } from '../data/typeCoverage';
import { APPLICATION_TYPES } from '../domain/applicationType';
import { suggestApplicability } from '../domain/applicability';
import { effectiveContext, visibleFacts } from '../domain/context';
import { computeMetrics } from '../domain/metrics';
import { CATEGORIES } from '../data/categories';

/**
 * COUNT INTEGRITY
 *
 * Every number the product shows a tester has to be checkable. These tests
 * hold each displayed figure to its arithmetic — a breakdown must sum to its
 * total, and a denominator must equal what is actually on screen.
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

const digits = (text: string | null) => (text ?? '').match(/\d+/g)?.map(Number) ?? [];

describe('application-type coverage breakdown adds up', () => {
  it('specific + shared + universal + pending equals the starting checklist', () => {
    for (const type of APPLICATION_TYPES) {
      const c = coverageFor(type.id);
      expect(
        c.specific.length + c.shared.length + c.universal + c.pendingContext,
        `${type.id} breakdown does not sum`,
      ).toBe(c.startingChecklist);
    }
  });

  it('the starting checklist equals what the engine actually produces', () => {
    for (const type of APPLICATION_TYPES) {
      const actual = TEST_LIBRARY.filter(
        (t) =>
          suggestApplicability(t, effectiveContext({ applicationType: type.id, context: {} }))
            .applicable,
      ).length;
      expect(coverageFor(type.id).startingChecklist, `${type.id}`).toBe(actual);
    }
  });

  it('domain-specific never exceeds the starting checklist', () => {
    for (const type of APPLICATION_TYPES) {
      const c = coverageFor(type.id);
      expect(c.specific.length).toBeLessThanOrEqual(c.startingChecklist);
    }
  });
});

describe('library statistics are self-consistent', () => {
  it('context-driven plus baseline equals the library size', () => {
    const s = libraryStats();
    expect(s.contextDriven + s.baseline).toBe(s.total);
    expect(s.total).toBe(TEST_LIBRARY.length);
  });

  it('per-category counts sum to the library size', () => {
    const s = libraryStats();
    expect(Object.values(s.byCategory).reduce((a, b) => a + b, 0)).toBe(s.total);
    expect(Object.values(s.byPriority).reduce((a, b) => a + b, 0)).toBe(s.total);
    expect(Object.values(s.bySubcategory).reduce((a, b) => a + b, 0)).toBe(s.total);
  });

  it('the advertised subcategory count matches the taxonomy', () => {
    const declared = CATEGORIES.reduce((n, c) => n + c.subcategories.length, 0);
    const used = new Set(TEST_LIBRARY.map((t) => `${t.category}/${t.subcategory}`)).size;
    expect(used).toBe(declared);
  });
});

describe('the wizard shows counts that match what is on screen', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
    window.location.hash = '#/engagements/new';
  });
  afterEach(cleanup);

  async function reachContextStep() {
    render(<AppWithBoundary />);
    fireEvent.change(await screen.findByLabelText(/Engagement name/), {
      target: { value: 'Counting' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choose application type' }));
    fireEvent.click(await screen.findByRole('button', { name: /Web Application.*Supported/s }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText(/questions answered/);
  }

  it('the question denominator equals the number of questions rendered', async () => {
    await reachContextStep();

    const countRendered = () => screen.getAllByRole('radiogroup', { name: 'Answer' }).length;
    const stated = () => digits(screen.getByText(/questions answered/).textContent)[1];

    // Default view: key questions only.
    const coreExpected = visibleFacts({}, { coreOnly: true, applicationType: 'web-app' }).length;
    expect(stated()).toBe(coreExpected);
    expect(screen.getByText(/key questions answered/)).toBeTruthy();
    // Boolean questions render a tri-state group; the rest are selects or chips.
    expect(countRendered()).toBeLessThanOrEqual(stated());

    // Switching to the full set moves the denominator with it.
    fireEvent.click(screen.getByRole('button', { name: 'Show all questions' }));
    await waitFor(() =>
      expect(stated()).toBe(visibleFacts({}, { applicationType: 'web-app' }).length),
    );
    expect(stated()).toBeGreaterThan(coreExpected);
  });

  it('counts answers as they are given', async () => {
    await reachContextStep();
    const answered = () => digits(screen.getByText(/questions answered/).textContent)[0];
    expect(answered()).toBe(0);

    const row = screen.getByText('Application has authentication').closest('div')!.parentElement!;
    fireEvent.click(within(row).getByRole('radio', { name: 'Yes' }));
    await waitFor(() => expect(answered()).toBe(1));
  });

  it('the review step reconciles applicable, excluded and the library total', async () => {
    await reachContextStep();
    fireEvent.click(screen.getByRole('button', { name: 'Review checklist' }));

    const summary = await screen.findByText(/tests applicable ·/);
    const [applicable, total, excluded, unconfirmed] = digits(summary.textContent);
    expect(applicable + excluded).toBe(total);
    expect(total).toBe(TEST_LIBRARY.length);
    // Unconfirmed is a subset of applicable, never a third disjoint bucket.
    expect(unconfirmed).toBeLessThanOrEqual(applicable);

    // The priority tiles sum to the applicable total shown beside them.
    // ('Critical' also appears as a badge on every row, so scope to the grid.)
    const totalTile = screen.getByText('Total applicable').parentElement!;
    const tiles = [...totalTile.parentElement!.children] as HTMLElement[];
    const tileValue = (label: string) =>
      digits(tiles.find((t) => t.textContent?.startsWith(label))!.textContent)[0] ?? 0;
    const tileTotal = ['Critical', 'High', 'Medium', 'Low']
      .map(tileValue)
      .reduce((a, b) => a + b, 0);
    const shown = digits(totalTile.textContent)[0];
    expect(tileTotal).toBe(shown);
    expect(shown).toBe(applicable);

    // …and the listed rows equal that number.
    const rows = document.querySelectorAll('tbody tr').length;
    expect(rows).toBe(applicable);
  });
});

describe('dashboard counts reconcile with the database', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('the six statistics agree with the stored state and with each other', async () => {
    const engagement = await createEngagement({
      name: 'Dashboard counts',
      applicationType: 'web-app',
      context: { hasAuthentication: true, hasFileUpload: true },
    });
    const items = await getChecklist(engagement.id);
    const applicableIds = items.filter((i) => i.state.applicable).map((i) => i.definition.id);
    const { updateTestState } = await import('../persistence/repository');
    for (const id of applicableIds.slice(0, 5)) {
      await updateTestState(engagement.id, id, { status: 'Tested', result: 'Vulnerable' });
    }
    for (const id of applicableIds.slice(5, 11)) {
      await updateTestState(engagement.id, id, { status: 'Tested', result: 'Not Vulnerable' });
    }
    for (const id of applicableIds.slice(11, 14)) {
      await updateTestState(engagement.id, id, { status: 'N/A' });
    }

    const c = computeMetrics(await getChecklist(engagement.id)).counts;
    window.location.hash = `#/e/${engagement.id}`;
    render(<AppWithBoundary />);
    await screen.findByText('Total applicable');

    const stats = screen.getByRole('region', { name: 'Assessment statistics' });
    // The label <p> sits inside the stat card; one level up is the card itself.
    const stat = (label: string) =>
      digits(within(stats).getByText(label).parentElement!.textContent)[0];

    expect(stat('Total applicable')).toBe(c.applicable);
    expect(stat('Tested')).toBe(c.tested);
    expect(stat('Not Tested')).toBe(c.notTested);
    expect(stat('N/A')).toBe(c.na);
    expect(stat('Vulnerable')).toBe(c.vulnerable);
    expect(stat('Not Vulnerable')).toBe(c.notVulnerable);

    // The two identities the product guarantees, read off the screen.
    expect(stat('Not Tested') + stat('Tested') + stat('N/A')).toBe(stat('Total applicable'));
    expect(stat('Vulnerable') + stat('Not Vulnerable')).toBe(stat('Tested'));

    // Progress states the same completed figure it draws.
    const progress = screen.getByRole('progressbar', { name: 'Overall assessment progress' });
    expect(Number(progress.getAttribute('aria-valuenow'))).toBe(
      Math.round(((c.tested + c.na) / c.applicable) * 100),
    );
    expect(digits(screen.getByText(/completed \(Tested/).textContent)[0]).toBe(c.tested + c.na);
  });
});
