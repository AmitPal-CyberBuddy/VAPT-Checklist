// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AppWithBoundary } from '../App';
import { ErrorBoundary } from '../app/ErrorBoundary';
import { installGlobalErrorHandlers } from '../app/globalErrors';
import { db, checkStorage } from '../persistence/db';
import { clearAllData, createEngagement, getChecklist } from '../persistence/repository';
import { planWorkbook } from '../export/excel';
import { getEngagement, updateTestState } from '../persistence/repository';

/**
 * PRODUCTION BEHAVIOUR AUDIT
 *
 * Deployment, export fidelity and what the application does when something
 * goes wrong in front of a tester who has no console open and no operator to
 * call.
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

describe('a crash does not become a white page', () => {
  afterEach(cleanup);

  it('catches a render failure, reassures about the data, and offers a way out', () => {
    const Boom = () => {
      throw new Error('synthetic render failure');
    };
    // React logs the caught error; silence it for this assertion.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary area="screen">
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Something went wrong in the screen/)).toBeTruthy();
    expect(screen.getByText(/Your assessment is safe/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to engagements' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeTruthy();
    // The detail is available but not shoved in the tester's face.
    expect(screen.getByText('Technical detail')).toBeTruthy();
    spy.mockRestore();
  });

  it('recovers when the tester retries', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    const Flaky = () => {
      if (shouldThrow) throw new Error('transient');
      return <p>recovered</p>;
    };

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Something went wrong/)).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('recovered')).toBeTruthy();
    spy.mockRestore();
  });
});

describe('background failures are surfaced', () => {
  afterEach(cleanup);

  it('reports an unhandled rejection once, not repeatedly', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const teardown = installGlobalErrorHandlers();
    render(<AppWithBoundary />);

    const fire = () =>
      window.dispatchEvent(
        Object.assign(new Event('unhandledrejection'), {
          reason: new Error('background write failed'),
        }),
      );
    fire();
    fire();
    fire();

    await waitFor(() => expect(screen.getAllByText(/Something failed in the background/)).toHaveLength(1));
    expect(screen.getByText('background write failed')).toBeTruthy();
    teardown();
    spy.mockRestore();
  });
});

describe('storage failures are explained by cause', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports the specific problem rather than a blanket "unavailable"', async () => {
    expect(await checkStorage()).toMatchObject({ ok: true });

    for (const [name, problem] of [
      ['VersionError', 'version-mismatch'],
      ['SecurityError', 'blocked'],
      ['UpgradeError', 'upgrade-blocked'],
      ['DatabaseClosedError', 'corrupt'],
      ['WeirdError', 'unknown'],
    ] as const) {
      const open = vi
        .spyOn(db, 'open')
        .mockRejectedValue(Object.assign(new Error(`${name} happened`), { name }));
      expect(await checkStorage()).toMatchObject({ ok: false, problem });
      open.mockRestore();
    }
  });
});

describe('export fidelity', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
  });

  it('carries quotes, newlines, tabs, Unicode and emoji through unchanged', async () => {
    const engagement = await createEngagement({
      name: 'Fidelity "quoted" & <tagged>',
      applicationType: 'web-app',
      context: { hasAuthentication: true },
    });
    const samples: [string, string][] = [
      ['AUTH-001', 'Quotes "double" and \'single\' & ampersand <tag>'],
      ['AUTH-002', 'Line one\nline two\r\nthree\ttabbed'],
      ['AUTH-003', 'Unicode: 中文 عربى हिन्दी 🔐 — em-dash … ellipsis'],
      ['AUTH-004', ']]> <![CDATA[ &#x41; &amp;'],
    ];
    for (const [id, notes] of samples) {
      await updateTestState(engagement.id, id, { status: 'Tested', result: 'Vulnerable', notes });
    }

    const stored = (await getEngagement(engagement.id))!;
    const items = await getChecklist(engagement.id);
    const assessment = planWorkbook(stored, items).find((s) => s.name === 'Assessment')!;
    const notesFor = (id: string) => {
      const row = assessment.data.find(
        (r) => String((r[0] as { value?: unknown })?.value) === id,
      )!;
      return String((row[7] as { value?: unknown })?.value ?? '');
    };

    for (const [id, notes] of samples) {
      expect(notesFor(id), `${id} note altered in export`).toBe(notes);
    }
    // The engagement name survives too, formula-escaping aside.
    expect(JSON.stringify(planWorkbook(stored, items))).toContain('Fidelity \\"quoted\\" & <tagged>');
  });

  it('handles a fully recorded engagement without stalling', async () => {
    const engagement = await createEngagement({
      name: 'Large',
      applicationType: 'web-app',
      context: {
        hasAuthentication: true,
        hasFileUpload: true,
        hasMultipleRoles: true,
        additionalSurfaces: ['rest-api', 'graphql-api'],
      },
    });
    const note = 'Tested /api/v2/orders?id=1 — payload \' OR 1=1-- "quoted" <tag>\n'.repeat(25);
    const items = await getChecklist(engagement.id);
    const applicable = items.filter((i) => i.state.applicable);
    expect(applicable.length).toBeGreaterThan(150);

    for (const [index, item] of applicable.entries()) {
      await updateTestState(engagement.id, item.definition.id, {
        status: 'Tested',
        result: index % 3 === 0 ? 'Vulnerable' : 'Not Vulnerable',
        notes: note,
      });
    }

    const stored = (await getEngagement(engagement.id))!;
    const started = performance.now();
    const planned = planWorkbook(stored, await getChecklist(engagement.id));
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(planned.find((s) => s.name === 'Assessment')!.data.length).toBe(applicable.length + 1);
  });

  it('reports an export failure instead of appearing to succeed', async () => {
    setViewport(true);
    const engagement = await createEngagement({
      name: 'Export failure',
      applicationType: 'web-app',
      context: {},
    });
    window.location.hash = `#/e/${engagement.id}/export`;
    render(<AppWithBoundary />);

    const button = await screen.findByRole('button', { name: 'Download Excel' });
    // Break the lazily-loaded writer the way a blocked chunk request would.
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('blob creation refused');
    });
    fireEvent.click(button);

    expect(await screen.findByText(/could not be generated/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    create.mockRestore();
    cleanup();
  });
});

describe('no work is lost moving between tests', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('flushes a half-typed note when the tester moves straight to another test', async () => {
    const engagement = await createEngagement({
      name: 'Note flush',
      applicationType: 'web-app',
      context: { hasAuthentication: true },
    });
    window.location.hash = `#/e/${engagement.id}/workspace?test=AUTH-001`;
    render(<AppWithBoundary />);

    const notes = await screen.findByLabelText(/^Notes for /);
    fireEvent.change(notes, { target: { value: 'Half-typed observation' } });

    // Immediately switch tests — inside the debounce window.
    const list = await screen.findByRole('navigation', { name: 'Tests' });
    fireEvent.click(within(list).getAllByRole('button')[2]);

    await waitFor(async () => {
      const saved = (await getChecklist(engagement.id)).find(
        (i) => i.definition.id === 'AUTH-001',
      )!.state.notes;
      expect(saved).toBe('Half-typed observation');
    });
  });

  it('flushes on page hide, as a reload or tab close would trigger', async () => {
    const engagement = await createEngagement({
      name: 'Unload flush',
      applicationType: 'web-app',
      context: { hasAuthentication: true },
    });
    window.location.hash = `#/e/${engagement.id}/workspace?test=AUTH-001`;
    render(<AppWithBoundary />);

    const notes = await screen.findByLabelText(/^Notes for /);
    fireEvent.change(notes, { target: { value: 'Typed just before reload' } });
    window.dispatchEvent(new Event('pagehide'));

    await waitFor(async () => {
      const saved = (await getChecklist(engagement.id)).find(
        (i) => i.definition.id === 'AUTH-001',
      )!.state.notes;
      expect(saved).toBe('Typed just before reload');
    });
  });
});
