import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The XLSX writer needs a browser (Blob + anchor download), so it is mocked.
 * What we verify here is the *export model*: sheet composition, header/row
 * shape and that every cell the builder emits is serialisable.
 */
const calls: { sheets: unknown[]; fileName: string }[] = [];

vi.mock('write-excel-file/browser', () => ({
  default: (sheets: unknown[]) => ({
    toFile: async (fileName: string) => {
      calls.push({ sheets, fileName });
    },
    toBlob: async () => new Blob(),
  }),
}));

import { exportEngagementToExcel } from './excel';
import { buildFileName } from './fileName';
import { TEST_LIBRARY, LIBRARY_VERSION } from '../data/library';
import { suggestApplicability } from '../domain/applicability';
import { applyTransition, createInitialState } from '../domain/executionState';
import type { ChecklistItem, Engagement } from '../domain/types';

const engagement: Engagement = {
  id: 'eng-1',
  name: 'ABC Web Application',
  clientName: 'ABC Ltd',
  testerName: 'A. Tester',
  scope: ['https://app.example.com'],
  status: 'Active',
  context: { assetTypes: ['web-app'], hasAuthentication: true, hasFileUpload: false },
  libraryVersion: LIBRARY_VERSION,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function buildItems(): ChecklistItem[] {
  return TEST_LIBRARY.map((definition, index) => {
    const applicable = suggestApplicability(definition, engagement.context).applicable;
    let state = createInitialState(engagement.id, definition.id, applicable);
    if (applicable && index % 3 === 0) {
      state = applyTransition(state, { status: 'Tested', result: 'Not Vulnerable' });
    } else if (applicable && index % 7 === 0) {
      state = applyTransition(state, {
        status: 'Tested',
        result: 'Vulnerable',
        notes: 'Reproduced on the staging host.',
      });
    } else if (applicable && index % 11 === 0) {
      state = applyTransition(state, { status: 'N/A', notes: 'Feature not present.' });
    }
    return { definition, state };
  });
}

type SheetLike = { sheet: string; data: unknown[][]; columns: { width: number }[] };

describe('excel export model', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('produces all six sheets with matching column definitions', async () => {
    const items = buildItems();
    const fileName = await exportEngagementToExcel(engagement, items);

    expect(calls).toHaveLength(1);
    const sheets = calls[0].sheets as SheetLike[];
    expect(sheets.map((s) => s.sheet)).toEqual([
      'Summary',
      'Checklist',
      'Findings',
      'Not Applicable',
      'Application Context',
      'Coverage',
    ]);
    expect(calls[0].fileName).toBe(fileName);
    expect(fileName).toMatch(/^vapt-abc-web-application-\d{4}-\d{2}-\d{2}\.xlsx$/);

    for (const sheet of sheets) {
      expect(sheet.data.length).toBeGreaterThan(0);
      const widest = Math.max(...sheet.data.map((row) => row.length));
      expect(sheet.columns.length).toBeGreaterThanOrEqual(widest);
    }
  });

  it('exports one checklist row per applicable test', async () => {
    const items = buildItems();
    await exportEngagementToExcel(engagement, items);
    const sheets = calls[0].sheets as SheetLike[];
    const checklist = sheets.find((s) => s.sheet === 'Checklist')!;
    const applicable = items.filter((i) => i.state.applicable).length;
    expect(checklist.data.length).toBe(applicable + 1); // + header row
  });

  it('lists only vulnerable tests on the findings sheet', async () => {
    const items = buildItems();
    await exportEngagementToExcel(engagement, items);
    const sheets = calls[0].sheets as SheetLike[];
    const findings = sheets.find((s) => s.sheet === 'Findings')!;
    const vulnerable = items.filter((i) => i.state.result === 'Vulnerable').length;
    expect(vulnerable).toBeGreaterThan(0);
    expect(findings.data.length).toBe(vulnerable + 1);
  });

  it('honours sheet toggles', async () => {
    await exportEngagementToExcel(engagement, buildItems(), {
      includeFindings: false,
      includeNotApplicable: false,
      includeContext: false,
      includeCoverage: false,
    });
    const sheets = calls[0].sheets as SheetLike[];
    expect(sheets.map((s) => s.sheet)).toEqual(['Summary', 'Checklist']);
  });

  it('never emits an undefined cell value', async () => {
    await exportEngagementToExcel(engagement, buildItems());
    const sheets = calls[0].sheets as SheetLike[];
    for (const sheet of sheets) {
      for (const row of sheet.data) {
        for (const cell of row) {
          if (cell === null || cell === undefined) continue;
          expect(typeof cell).toBe('object');
          expect((cell as { value: unknown }).value).not.toBeUndefined();
        }
      }
    }
  });

  it('builds a safe file name for awkward engagement names', () => {
    expect(
      buildFileName({ ...engagement, name: '  Client / Ünïcödé — App!!  ' }, 'json'),
    ).toMatch(/^vapt-client-n-c-d-app-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
