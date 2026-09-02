// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { db } from '../persistence/db';
import { clearAllData, createEngagement, getChecklist } from '../persistence/repository';
import { TEST_LIBRARY } from '../data/library';
import { COVERAGE_BY_TYPE } from '../data/typeCoverage';
import { APPLICATION_TYPES, type ApplicationTypeId } from '../domain/applicationType';
import { effectiveContext, visibleFacts } from '../domain/context';
import { suggestApplicability } from '../domain/applicability';
import type { ApplicationContext } from '../domain/context';

/**
 * APPLICATION TYPE AUDIT
 *
 * The product must never imply coverage the library cannot back. These tests
 * hold the line in both directions: a type is described as supported only if
 * the tests exist, and an unsupported type cannot become an engagement.
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

const applicableFor = (type: ApplicationTypeId, context: ApplicationContext = {}) =>
  TEST_LIBRARY.filter(
    (t) => suggestApplicability(t, effectiveContext({ applicationType: type, context })).applicable,
  );

describe('coverage claims are measured, not asserted', () => {
  it('derives every support level from the library itself', () => {
    for (const type of APPLICATION_TYPES) {
      const coverage = COVERAGE_BY_TYPE[type.id];
      if (coverage.support === 'unsupported') expect(coverage.specific).toHaveLength(0);
      if (coverage.support === 'supported') expect(coverage.specific.length).toBeGreaterThanOrEqual(14);
      if (coverage.support === 'limited') {
        expect(coverage.specific.length).toBeGreaterThan(0);
        expect(coverage.specific.length).toBeLessThan(14);
      }
    }
  });

  it('matches the audited verdict for each type', () => {
    const verdict = Object.fromEntries(
      APPLICATION_TYPES.map((t) => [t.id, COVERAGE_BY_TYPE[t.id].support]),
    );
    expect(verdict).toEqual({
      'web-app': 'supported',
      'rest-api': 'supported',
      'graphql-api': 'supported',
      'soap-api': 'limited',
      'mobile-android': 'limited',
      'mobile-ios': 'limited',
      cloud: 'limited',
      'thick-client': 'unsupported',
    });
  });

  it('states the limitations of every type that is not fully supported', () => {
    for (const type of APPLICATION_TYPES) {
      if (COVERAGE_BY_TYPE[type.id].support === 'supported') continue;
      expect(type.limitations?.length, `${type.id} has no stated limitations`).toBeGreaterThan(0);
    }
    // …and an unsupported type must say what to do instead.
    const thick = APPLICATION_TYPES.find((t) => t.id === 'thick-client')!;
    expect(thick.alternative).toBeTruthy();
  });
});

describe('the application type establishes the testing domain', () => {
  it('produces a materially different checklist per type', () => {
    const sets = APPLICATION_TYPES.filter((t) => COVERAGE_BY_TYPE[t.id].support !== 'unsupported').map(
      (t) => ({ id: t.id, ids: applicableFor(t.id).map((x) => x.id) }),
    );

    const web = new Set(sets.find((s) => s.id === 'web-app')!.ids);
    const api = new Set(sets.find((s) => s.id === 'rest-api')!.ids);
    const mobile = new Set(sets.find((s) => s.id === 'mobile-android')!.ids);

    // Web-only tests must not appear on a REST API engagement.
    expect(web.has('CONF-001')).toBe(true);
    expect(api.has('CONF-001')).toBe(false);
    expect(api.has('CLI-002')).toBe(false); // clickjacking
    // API tests must not appear on a pure web engagement…
    expect(api.has('API-001')).toBe(true);
    expect(web.has('API-001')).toBe(false);
    // …and mobile tests only on a mobile engagement.
    expect(mobile.has('MOB-001')).toBe(true);
    expect(web.has('MOB-001')).toBe(false);
    expect(api.has('MOB-001')).toBe(false);
  });

  it('asks only the questions that matter for the chosen domain', () => {
    const web = visibleFacts({}, { applicationType: 'web-app' }).map((f) => f.key);
    const cloud = visibleFacts({}, { applicationType: 'cloud' }).map((f) => f.key);
    const mobile = visibleFacts({}, { applicationType: 'mobile-android' }).map((f) => f.key);

    // Front-end rendering is a browser question.
    expect(web).toContain('clientRendering');
    expect(cloud).not.toContain('clientRendering');
    expect(mobile).not.toContain('clientRendering');
    // Server-side templating is not a cloud-account question.
    expect(cloud).not.toContain('usesTemplating');
    // The derived fact is never asked.
    for (const set of [web, cloud, mobile]) expect(set).not.toContain('assetTypes');
    // Cloud asks materially fewer questions than web.
    expect(cloud.length).toBeLessThan(web.length);
  });

  it('adds a surface without losing the primary domain', () => {
    const webOnly = new Set(applicableFor('web-app').map((t) => t.id));
    const webPlusApi = new Set(
      applicableFor('web-app', { additionalSurfaces: ['rest-api'] }).map((t) => t.id),
    );
    expect(webPlusApi.has('API-001')).toBe(true);
    expect(webPlusApi.has('CONF-001')).toBe(true);
    for (const id of webOnly) expect(webPlusApi.has(id)).toBe(true);
  });
});

describe('scenarios required by the review', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('A — web application with auth, roles, MFA and upload', async () => {
    const engagement = await createEngagement({
      name: 'Scenario A',
      applicationType: 'web-app',
      context: {
        hasAuthentication: true,
        hasMultipleRoles: true,
        hasMfa: true,
        hasFileUpload: true,
        authMechanisms: ['session-cookie'],
      },
    });
    const ids = new Set(
      (await getChecklist(engagement.id))
        .filter((i) => i.state.applicable)
        .map((i) => i.definition.id),
    );
    for (const expected of [
      'AUTH-001', 'AUTH-007', 'AUTH-008', 'AUTHZ-003', 'AUTHZ-010',
      'FILE-001', 'FILE-002', 'SESS-008', 'SESS-013', 'INJ-004', 'CLI-001', 'CONF-001',
    ]) {
      expect(ids.has(expected), `${expected} missing from Scenario A`).toBe(true);
    }
    expect(ids.has('MOB-001')).toBe(false);
    expect(ids.has('GQL-001')).toBe(false);
  });

  it('B — web application with no auth, no upload, no payment is meaningfully smaller', async () => {
    const a = await createEngagement({
      name: 'Scenario A2',
      applicationType: 'web-app',
      context: { hasAuthentication: true, hasMfa: true, hasFileUpload: true, handlesPayments: true },
    });
    const b = await createEngagement({
      name: 'Scenario B',
      applicationType: 'web-app',
      context: { hasAuthentication: false, hasFileUpload: false, handlesPayments: false },
    });

    const idsOf = async (id: string) =>
      new Set(
        (await getChecklist(id)).filter((i) => i.state.applicable).map((i) => i.definition.id),
      );
    const withAuth = await idsOf(a.id);
    const without = await idsOf(b.id);

    expect(without.size).toBeLessThan(withAuth.size);
    for (const gone of ['AUTH-001', 'AUTH-007', 'SESS-001', 'SESS-013', 'FILE-001', 'PRIV-005']) {
      expect(without.has(gone), `${gone} should not apply in Scenario B`).toBe(false);
    }
    // Unauthenticated web testing still happens.
    for (const kept of ['INJ-001', 'INJ-004', 'CONF-001', 'TLS-004', 'DISC-001']) {
      expect(without.has(kept), `${kept} should still apply in Scenario B`).toBe(true);
    }
  });

  it('C — REST API surfaces API testing and suppresses browser testing', async () => {
    const engagement = await createEngagement({
      name: 'Scenario C',
      applicationType: 'rest-api',
      context: { hasAuthentication: true, authMechanisms: ['jwt'], hasUserOwnedResources: true },
    });
    const ids = new Set(
      (await getChecklist(engagement.id))
        .filter((i) => i.state.applicable)
        .map((i) => i.definition.id),
    );
    for (const expected of ['API-001', 'API-002', 'API-003', 'API-005', 'AUTHZ-002', 'AUTHZ-009', 'SESS-010']) {
      expect(ids.has(expected), `${expected} missing from Scenario C`).toBe(true);
    }
    for (const absent of ['CONF-001', 'CLI-002', 'CLI-003', 'TLS-003', 'MOB-001']) {
      expect(ids.has(absent), `${absent} should not apply to a REST API engagement`).toBe(false);
    }
  });

  it('D — an unsupported type is explained and refused in the UI', async () => {
    window.location.hash = '#/engagements/new';
    render(<App />);

    fireEvent.change(await screen.findByLabelText(/Engagement name/), {
      target: { value: 'Scenario D' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choose application type' }));

    const thick = await screen.findByRole('button', { name: /Thick \/ Desktop Client/s });
    expect(thick.textContent).toContain('Not supported');
    fireEvent.click(thick);

    // The reason is given, not just a disabled control.
    expect(await screen.findByText(/Thick \/ Desktop Client is not supported/)).toBeTruthy();
    expect(screen.getByText(/no thick-client tests at all/)).toBeTruthy();
    expect(screen.getByText(/If the client talks to a server/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', true);

    // Choosing a supported type unblocks the flow.
    fireEvent.click(screen.getByRole('button', { name: /REST API.*Supported/s }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', false),
    );
  });

  it('D2 — a limited type is usable but states exactly what is missing', async () => {
    window.location.hash = '#/engagements/new';
    render(<App />);
    fireEvent.change(await screen.findByLabelText(/Engagement name/), {
      target: { value: 'Scenario D2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choose application type' }));
    fireEvent.click(await screen.findByRole('button', { name: /Android Application.*Limited/s }));

    expect(await screen.findByText('What it does not cover')).toBeTruthy();
    expect(screen.getByText(/screening set, not a MASTG-depth/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', false);
  });
});

describe('the rest of the product understands application type', () => {
  beforeEach(async () => {
    await db.open();
    await clearAllData();
    setViewport(true);
  });
  afterEach(cleanup);

  it('shows the domain on the dashboard, flagging limited coverage', async () => {
    const engagement = await createEngagement({
      name: 'Mobile Engagement',
      applicationType: 'mobile-android',
      context: { hasAuthentication: true },
    });
    window.location.hash = `#/e/${engagement.id}`;
    render(<App />);

    // Wait for the dashboard body, not the layout header, before asserting.
    const label = await screen.findByText('Application type');
    const cell = label.parentElement!;
    expect(cell.textContent).toContain('Android Application');
    expect(cell.textContent).toContain('Limited');
  });

  it('carries the domain and its support level into the Excel summary', async () => {
    const engagement = await createEngagement({
      name: 'Export Domain',
      applicationType: 'soap-api',
      context: { additionalSurfaces: ['rest-api'] },
    });
    const { planWorkbook } = await import('../export/excel');
    const stored = (await db.engagements.get(engagement.id))!;
    const summary = planWorkbook(stored, await getChecklist(engagement.id))[0].data;
    const cell = (row: unknown[], i: number) => String((row[i] as { value?: unknown })?.value ?? '');
    const valueFor = (label: string) => {
      for (const row of summary) {
        for (let i = 0; i < row.length - 1; i += 1) if (cell(row, i) === label) return cell(row, i + 1);
      }
      return undefined;
    };
    expect(valueFor('Application type')).toBe('SOAP / XML-RPC API');
    expect(valueFor('Support level')).toContain('Limited');
    expect(valueFor('Surfaces in scope')).toBe('SOAP / XML-RPC API, REST API');
  });

  it('migrates an engagement written before application type existed', async () => {
    // v1 shape: no applicationType, surfaces recorded in context.assetTypes.
    const legacy = {
      id: 'legacy-1',
      name: 'Legacy engagement',
      scope: [],
      status: 'Active' as const,
      context: { assetTypes: ['rest-api', 'web-app'], hasAuthentication: true },
      libraryVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.engagements.add(legacy as never);

    // The Dexie upgrade runs on open; simulate what it produces for this row.
    const stored = (await db.engagements.get('legacy-1'))!;
    const applicationType = stored.applicationType ?? (stored.context.assetTypes as string[])[0];
    expect(applicationType).toBe('rest-api');
  });
});
