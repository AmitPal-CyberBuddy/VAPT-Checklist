/**
 * VAPT Checklist — Repository layer
 * ---------------------------------------------------------------------------
 * The ONLY module allowed to touch Dexie tables. Every write goes through a
 * domain function (applyTransition / suggestApplicability) so the invariants
 * in src/domain hold for anything that reaches storage.
 */

import { nanoid } from 'nanoid';
import { db } from './db';
import { LIBRARY_VERSION, TEST_LIBRARY, TEST_BY_ID } from '../data/library';
import { suggestApplicability } from '../domain/applicability';
import {
  applyTransition,
  createInitialState,
  stateKey,
  type StateTransition,
} from '../domain/executionState';
import type { ApplicationContext } from '../domain/context';
import type { ChecklistItem, Engagement, EngagementStatus, TestState } from '../domain/types';

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ engagements */

export interface EngagementDraft {
  name: string;
  clientName?: string;
  applicationUrl?: string;
  scope?: string[];
  description?: string;
  testerName?: string;
  startDate?: string;
  endDate?: string;
  context?: ApplicationContext;
}

export async function listEngagements(): Promise<Engagement[]> {
  const all = await db.engagements.toArray();
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getEngagement(id: string): Promise<Engagement | undefined> {
  return db.engagements.get(id);
}

/**
 * Creates the engagement AND materialises one TestState row per library test.
 * Seeding up front (rather than lazily) means the checklist, dashboard and
 * export all read the same complete dataset.
 */
export async function createEngagement(draft: EngagementDraft): Promise<Engagement> {
  const timestamp = now();
  const engagement: Engagement = {
    id: nanoid(12),
    name: draft.name.trim(),
    clientName: draft.clientName?.trim() || undefined,
    applicationUrl: draft.applicationUrl?.trim() || undefined,
    scope: (draft.scope ?? []).map((s) => s.trim()).filter(Boolean),
    description: draft.description?.trim() || undefined,
    testerName: draft.testerName?.trim() || undefined,
    startDate: draft.startDate || undefined,
    endDate: draft.endDate || undefined,
    status: 'Active',
    context: draft.context ?? {},
    libraryVersion: LIBRARY_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const states = TEST_LIBRARY.map((definition) => {
    const suggestion = suggestApplicability(definition, engagement.context);
    return createInitialState(engagement.id, definition.id, suggestion.applicable, timestamp);
  });

  await db.transaction('rw', db.engagements, db.testStates, async () => {
    await db.engagements.add(engagement);
    await db.testStates.bulkAdd(states);
  });

  return engagement;
}

export async function updateEngagement(
  id: string,
  patch: Partial<Omit<Engagement, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.engagements.update(id, { ...patch, updatedAt: now() });
}

export async function setEngagementStatus(id: string, status: EngagementStatus): Promise<void> {
  await updateEngagement(id, { status });
}

export async function deleteEngagement(id: string): Promise<void> {
  await db.transaction('rw', db.engagements, db.testStates, async () => {
    await db.testStates.where('engagementId').equals(id).delete();
    await db.engagements.delete(id);
  });
}

export async function duplicateEngagement(id: string, newName: string): Promise<Engagement | null> {
  const source = await db.engagements.get(id);
  if (!source) return null;
  return createEngagement({
    name: newName,
    clientName: source.clientName,
    applicationUrl: source.applicationUrl,
    scope: source.scope,
    description: source.description,
    testerName: source.testerName,
    context: source.context,
  });
}

/* ------------------------------------------------------------------ test states */

export async function listStates(engagementId: string): Promise<TestState[]> {
  return db.testStates.where('engagementId').equals(engagementId).toArray();
}

export async function getChecklist(engagementId: string): Promise<ChecklistItem[]> {
  const states = await listStates(engagementId);
  const byTestId = new Map(states.map((s) => [s.testId, s]));
  const items: ChecklistItem[] = [];
  for (const definition of TEST_LIBRARY) {
    const state = byTestId.get(definition.id);
    if (state) items.push({ definition, state });
  }
  return items;
}

export async function updateTestState(
  engagementId: string,
  testId: string,
  change: StateTransition,
): Promise<TestState | undefined> {
  const key = stateKey(engagementId, testId);
  let updated: TestState | undefined;
  await db.transaction('rw', db.testStates, db.engagements, async () => {
    const current = await db.testStates.get(key);
    if (!current) return;
    updated = applyTransition(current, change);
    await db.testStates.put(updated);
    await db.engagements.update(engagementId, { updatedAt: updated.updatedAt });
  });
  return updated;
}

export async function bulkUpdateTestStates(
  engagementId: string,
  testIds: string[],
  change: StateTransition,
): Promise<void> {
  if (testIds.length === 0) return;
  await db.transaction('rw', db.testStates, db.engagements, async () => {
    const keys = testIds.map((t) => stateKey(engagementId, t));
    const current = await db.testStates.bulkGet(keys);
    const timestamp = now();
    const updates = current
      .filter((s): s is TestState => !!s)
      .map((s) => applyTransition(s, change, timestamp));
    await db.testStates.bulkPut(updates);
    await db.engagements.update(engagementId, { updatedAt: timestamp });
  });
}

/* -------------------------------------------------- applicability re-evaluation */

export interface ApplicabilityDiff {
  testId: string;
  vulnerabilityName: string;
  from: boolean;
  to: boolean;
  /** Manual overrides are reported but never silently changed. */
  isManualOverride: boolean;
  hasRecordedWork: boolean;
}

/** Dry run: what would change if applicability were recomputed for this context. */
export async function previewApplicability(
  engagementId: string,
  context: ApplicationContext,
): Promise<ApplicabilityDiff[]> {
  const states = await listStates(engagementId);
  const diffs: ApplicabilityDiff[] = [];
  for (const state of states) {
    const definition = TEST_BY_ID.get(state.testId);
    if (!definition) continue;
    const suggestion = suggestApplicability(definition, context);
    if (suggestion.applicable !== state.applicable) {
      diffs.push({
        testId: state.testId,
        vulnerabilityName: definition.vulnerabilityName,
        from: state.applicable,
        to: suggestion.applicable,
        isManualOverride: state.applicabilitySource === 'manual',
        hasRecordedWork: state.status !== 'Not Tested' || state.notes.trim().length > 0,
      });
    }
  }
  return diffs;
}

/**
 * Applies recomputed applicability.
 * - Manual overrides are preserved unless `overrideManual` is set.
 * - Tests with recorded work are never auto-excluded; the tester decides.
 */
export async function applyApplicability(
  engagementId: string,
  context: ApplicationContext,
  options: { overrideManual?: boolean } = {},
): Promise<number> {
  const states = await listStates(engagementId);
  const timestamp = now();
  const updates: TestState[] = [];
  let changed = 0;

  for (const state of states) {
    const definition = TEST_BY_ID.get(state.testId);
    if (!definition) continue;
    const suggestion = suggestApplicability(definition, context);
    const keepManual = state.applicabilitySource === 'manual' && !options.overrideManual;
    const protectWork = state.status !== 'Not Tested' && !suggestion.applicable;

    const next: TestState = {
      ...state,
      suggestedApplicable: suggestion.applicable,
    };

    if (!keepManual && !protectWork && suggestion.applicable !== state.applicable) {
      next.applicable = suggestion.applicable;
      next.applicabilitySource = 'auto';
      next.updatedAt = timestamp;
      changed += 1;
    }
    updates.push(next);
  }

  await db.transaction('rw', db.testStates, db.engagements, async () => {
    await db.testStates.bulkPut(updates);
    await db.engagements.update(engagementId, { context, updatedAt: timestamp });
  });

  return changed;
}

/** Adds states for library tests added after the engagement was created. */
export async function syncLibrary(engagementId: string): Promise<number> {
  const engagement = await db.engagements.get(engagementId);
  if (!engagement) return 0;
  const existing = new Set((await listStates(engagementId)).map((s) => s.testId));
  const timestamp = now();
  const added = TEST_LIBRARY.filter((t) => !existing.has(t.id)).map((definition) =>
    createInitialState(
      engagementId,
      definition.id,
      suggestApplicability(definition, engagement.context).applicable,
      timestamp,
    ),
  );
  if (added.length === 0) return 0;
  await db.transaction('rw', db.testStates, db.engagements, async () => {
    await db.testStates.bulkAdd(added);
    await db.engagements.update(engagementId, {
      libraryVersion: LIBRARY_VERSION,
      updatedAt: timestamp,
    });
  });
  return added.length;
}

/* ------------------------------------------------------------ backup / restore */

export interface BackupFile {
  format: 'vapt-checklist-backup';
  version: 1;
  exportedAt: string;
  libraryVersion: string;
  engagements: Engagement[];
  testStates: TestState[];
}

export async function exportBackup(engagementId?: string): Promise<BackupFile> {
  const engagements = engagementId
    ? ([await db.engagements.get(engagementId)].filter(Boolean) as Engagement[])
    : await db.engagements.toArray();
  const ids = new Set(engagements.map((e) => e.id));
  const testStates = (await db.testStates.toArray()).filter((s) => ids.has(s.engagementId));
  return {
    format: 'vapt-checklist-backup',
    version: 1,
    exportedAt: now(),
    libraryVersion: LIBRARY_VERSION,
    engagements,
    testStates,
  };
}

export async function importBackup(file: BackupFile): Promise<{ engagements: number }> {
  if (file?.format !== 'vapt-checklist-backup') {
    throw new Error('Unrecognised backup file.');
  }
  const idMap = new Map<string, string>();
  const existing = new Set((await db.engagements.toArray()).map((e) => e.id));

  const engagements = file.engagements.map((e) => {
    const id = existing.has(e.id) ? nanoid(12) : e.id;
    idMap.set(e.id, id);
    return { ...e, id, name: existing.has(e.id) ? `${e.name} (imported)` : e.name };
  });

  const testStates = file.testStates
    .filter((s) => idMap.has(s.engagementId))
    .map((s) => {
      const engagementId = idMap.get(s.engagementId)!;
      return { ...s, engagementId, id: stateKey(engagementId, s.testId) };
    });

  await db.transaction('rw', db.engagements, db.testStates, async () => {
    await db.engagements.bulkPut(engagements);
    await db.testStates.bulkPut(testStates);
  });

  return { engagements: engagements.length };
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.engagements, db.testStates, db.appMeta, async () => {
    await db.engagements.clear();
    await db.testStates.clear();
    await db.appMeta.clear();
  });
}
