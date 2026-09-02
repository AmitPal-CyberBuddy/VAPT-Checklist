// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The XLSX writer needs a browser (Blob + anchor download), so it is mocked.
 * What we verify here is the *export model*: sheet composition, the columns the
 * product promises, row selection and that every emitted cell is serialisable.
 */
const calls: { sheets: unknown[] }[] = [];
const downloads: string[] = [];

vi.mock('write-excel-file/browser', () => ({
  default: (sheets: unknown[]) => ({
    toBlob: async () => {
      calls.push({ sheets });
      return new Blob(['xlsx']);
    },
    toFile: async () => {
      calls.push({ sheets });
    },
  }),
}));

vi.mock('./xlsxPostProcess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./xlsxPostProcess')>();
  return { ...actual, withAutoFilters: async (blob: Blob) => blob };
});

import { exportEngagementToExcel, planWorkbook } from './excel';
import { buildFileName } from './fileName';
import { columnLetter, filterRef, injectAutoFilters } from './xlsxPostProcess';
import { TEST_LIBRARY, LIBRARY_VERSION } from '../data/library';
import { suggestApplicability } from '../domain/applicability';
import { applyTransition, createInitialState } from '../domain/executionState';
import type { ChecklistItem, Engagement } from '../domain/types';

const engagement: Engagement = {
  id: 'eng-1',
  name: 'ABC Web Application',
  applicationType: 'web-app',
  applicationUrl: 'https://app.example.com',
  clientName: 'ABC Ltd',
  testerName: 'A. Tester',
  scope: ['api.example.com'],
  status: 'Active',
  context: {
    assetTypes: ['web-app', 'rest-api'],
    additionalSurfaces: ['rest-api'],
    hasAuthentication: true,
    hasFileUpload: false,
  },
  libraryVersion: LIBRARY_VERSION,
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-02T17:30:00.000Z',
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

type SheetLike = {
  sheet: string;
  data: unknown[][];
  columns: { width: number }[];
  stickyRowsCount: number;
};

const cellText = (cell: unknown) =>
  cell && typeof cell === 'object' ? String((cell as { value: unknown }).value ?? '') : '';

describe('workbook plan', () => {
  it('produces the three required sheets plus the optional ones', () => {
    const planned = planWorkbook(engagement, buildItems());
    expect(planned.map((s) => s.name)).toEqual([
      'Engagement Summary',
      'Assessment',
      'Vulnerable Tests',
      'Not Applicable',
      'Coverage',
    ]);
  });

  it('honours sheet toggles', () => {
    const planned = planWorkbook(engagement, buildItems(), {
      includeNotApplicable: false,
      includeCoverage: false,
    });
    expect(planned.map((s) => s.name)).toEqual([
      'Engagement Summary',
      'Assessment',
      'Vulnerable Tests',
    ]);
  });

  it('puts engagement identity, dates and statistics on sheet 1', () => {
    const [summary] = planWorkbook(engagement, buildItems());
    // The statistics block is a two-column grid: [label, value, label, value].
    const labels = summary.data.flatMap((row) => [cellText(row[0]), cellText(row[2])]);
    for (const required of [
      'Engagement name',
      'Application URL',
      'Application type',
      'Created date',
      'Export date',
      'Total applicable tests',
      'Tested',
      'N/A',
      'Vulnerable',
      'Not vulnerable',
      'Overall progress',
    ]) {
      expect(labels, `missing "${required}"`).toContain(required);
    }
    // Application context is part of the summary sheet.
    expect(labels).toContain('Application has authentication');
    const urlRow = summary.data.find((row) => cellText(row[0]) === 'Application URL')!;
    expect(cellText(urlRow[1])).toBe('https://app.example.com');
  });

  it('leads sheet 2 with the eight required columns', () => {
    const assessment = planWorkbook(engagement, buildItems())[1];
    const headers = assessment.data[0].map(cellText);
    expect(headers.slice(0, 8)).toEqual([
      'Test ID',
      'Vulnerability Name',
      'Category',
      'Subcategory',
      'Priority',
      'Status',
      'Result',
      'Notes',
    ]);
  });

  it('exports one assessment row per applicable test', () => {
    const items = buildItems();
    const assessment = planWorkbook(engagement, items)[1];
    const applicable = items.filter((i) => i.state.applicable).length;
    expect(assessment.data.length).toBe(applicable + 1);
  });

  it('includes only Tested + Vulnerable rows on sheet 3', () => {
    const items = buildItems();
    const vulnerable = planWorkbook(engagement, items)[2];
    const expected = items.filter(
      (i) => i.state.status === 'Tested' && i.state.result === 'Vulnerable',
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(vulnerable.data.length).toBe(expected.length + 1);
    for (const row of vulnerable.data.slice(1)) {
      expect(cellText(row[5])).toBe('Tested');
      expect(cellText(row[6])).toBe('Vulnerable');
    }
  });

  it('freezes the header row and sizes every column on data sheets', () => {
    for (const sheet of planWorkbook(engagement, buildItems())) {
      const widest = Math.max(...sheet.data.map((row) => row.length));
      expect(sheet.columns.length).toBeGreaterThanOrEqual(widest);
      expect(sheet.columns.every((c) => c.width > 0)).toBe(true);
      if (sheet.tabular) expect(sheet.data[0].length).toBe(sheet.columns.length);
    }
  });

  it('never emits an undefined cell value', () => {
    for (const sheet of planWorkbook(engagement, buildItems())) {
      for (const row of sheet.data) {
        for (const cell of row) {
          if (cell === null || cell === undefined) continue;
          expect(typeof cell).toBe('object');
          expect((cell as { value: unknown }).value).not.toBeUndefined();
        }
      }
    }
  });
});

describe('workbook generation', () => {
  beforeEach(() => {
    calls.length = 0;
    downloads.length = 0;
    const anchor = document.createElement('a');
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag !== 'a') return Object.getPrototypeOf(document).createElement.call(document, tag);
      anchor.click = () => downloads.push(anchor.download);
      return anchor;
    });
    globalThis.URL.createObjectURL = () => 'blob:mock';
    globalThis.URL.revokeObjectURL = () => {};
  });

  it('writes the planned sheets and downloads a named file', async () => {
    const fileName = await exportEngagementToExcel(engagement, buildItems());
    expect(calls).toHaveLength(1);
    expect((calls[0].sheets as SheetLike[]).map((s) => s.sheet)).toContain('Assessment');
    expect((calls[0].sheets as SheetLike[])[1].stickyRowsCount).toBe(1);
    expect(fileName).toMatch(/^vapt-abc-web-application-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(downloads).toEqual([fileName]);
    vi.restoreAllMocks();
  });

  it('builds a safe file name for awkward engagement names', () => {
    expect(
      buildFileName({ ...engagement, name: '  Client / Ünïcödé — App!!  ' }, 'json'),
    ).toMatch(/^vapt-client-n-c-d-app-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe('autofilter injection', () => {
  it('maps column indexes to spreadsheet letters', () => {
    expect(columnLetter(1)).toBe('A');
    expect(columnLetter(8)).toBe('H');
    expect(columnLetter(26)).toBe('Z');
    expect(columnLetter(27)).toBe('AA');
  });

  it('builds a filter range covering the header and data', () => {
    expect(filterRef(8, 120)).toBe('A1:H120');
    expect(filterRef(15, 2)).toBe('A1:O2');
  });

  it('inserts autoFilter after sheetData in the right worksheet', () => {
    const encoder = new TextEncoder();
    const files: Record<string, Uint8Array> = {
      'xl/workbook.xml': encoder.encode(
        // Attribute order matches what write-excel-file actually emits.
        '<workbook><sheets><sheet r:id="rId1" sheetId="1" name="Engagement Summary"/>' +
          '<sheet r:id="rId2" sheetId="2" name="Assessment"/></sheets></workbook>',
      ),
      'xl/_rels/workbook.xml.rels': encoder.encode(
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
      ),
      'xl/worksheets/sheet1.xml': encoder.encode('<worksheet><sheetData/></worksheet>'),
      'xl/worksheets/sheet2.xml': encoder.encode('<worksheet><sheetData/></worksheet>'),
    };

    const out = injectAutoFilters(files, [{ sheet: 'Assessment', columns: 15, rows: 100 }]);
    const decoder = new TextDecoder();
    expect(decoder.decode(out['xl/worksheets/sheet2.xml'])).toBe(
      '<worksheet><sheetData/><autoFilter ref="A1:O100"/></worksheet>',
    );
    // The summary sheet is left alone.
    expect(decoder.decode(out['xl/worksheets/sheet1.xml'])).not.toContain('autoFilter');
  });

  it('leaves the archive untouched when the sheet is missing', () => {
    const files = { 'xl/workbook.xml': new TextEncoder().encode('<workbook/>') };
    expect(injectAutoFilters(files, [{ sheet: 'Nope', columns: 3, rows: 3 }])).toEqual(files);
  });
});
