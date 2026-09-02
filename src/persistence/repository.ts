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
  assertPersistable,
  validateState,
  createInitialState,
  isInconsistent,
  stateKey,
  type StateTransition,
} from '../domain/executionState';
import { TEST_STATUSES, TEST_RESULTS } from '../domain/types';
import { effectiveContext, type ApplicationContext } from '../domain/context';
import type { ApplicationTypeId } from '../domain/applicationType';
import type { ChecklistItem, Engagement, EngagementStatus, TestState } from '../domain/types';

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ engagements */

export interface EngagementDraft {
  name: string;
  /** The testing domain — chosen before any context question. */
  applicationType: ApplicationTypeId;
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
    applicationType: draft.applicationType,
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

  // The engine sees the derived asset types, never the raw context.
  const resolved = effectiveContext(engagement);
  const states = TEST_LIBRARY.map((definition) => {
    const suggestion = suggestApplicability(definition, resolved);
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
    applicationType: source.applicationType,
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

/**
 * The single write path for a test result.
 * `assertPersistable` runs before the record touches IndexedDB, so an
 * inconsistent combination (Tested without a result, N/A with a result) throws
 * instead of being stored.
 */
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
    const next = applyTransition(current, change);
    assertPersistable(next);
    updated = next;
    await db.testStates.put(next);
    await db.engagements.update(engagementId, { updatedAt: next.updatedAt });
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
    // Validate the whole batch first — a bulk edit is all-or-nothing.
    updates.forEach(assertPersistable);
    await db.testStates.bulkPut(updates);
    await db.engagements.update(engagementId, { updatedAt: timestamp });
  });
}

/**
 * Repairs rows that cannot have been written by this build — `Tested` with no
 * result from an earlier version, or a status corrupted on disk. Idempotent,
 * cheap, and run when an engagement is opened.
 */
export async function repairIntegrity(engagementId: string): Promise<number> {
  const broken = (await listStates(engagementId)).filter(isInconsistent);
  if (broken.length === 0) return 0;
  const timestamp = now();
  const repaired = broken.map((state) => ({
    ...state,
    status: 'Not Tested' as const,
    result: null,
    updatedAt: timestamp,
  }));
  repaired.forEach(assertPersistable);
  await db.testStates.bulkPut(repaired);
  return repaired.length;
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
  const engagement = await db.engagements.get(engagementId);
  if (!engagement) return [];
  const resolved = effectiveContext({ applicationType: engagement.applicationType, context });
  const states = await listStates(engagementId);
  const diffs: ApplicabilityDiff[] = [];
  for (const state of states) {
    const definition = TEST_BY_ID.get(state.testId);
    if (!definition) continue;
    const suggestion = suggestApplicability(definition, resolved);
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
  const engagement = await db.engagements.get(engagementId);
  if (!engagement) return 0;
  const resolved = effectiveContext({ applicationType: engagement.applicationType, context });
  const states = await listStates(engagementId);
  const timestamp = now();
  const updates: TestState[] = [];
  let changed = 0;

  for (const state of states) {
    const definition = TEST_BY_ID.get(state.testId);
    if (!definition) continue;
    const suggestion = suggestApplicability(definition, resolved);
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

export interface LibrarySyncResult {
  /** New tests seeded into the engagement. */
  added: number;
  /**
   * States for tests that no longer exist in the library (merged or removed).
   * They are reported, never deleted: the row is the tester's record, and the
   * checklist simply stops showing it.
   */
  retired: number;
}

/** Reconciles an engagement with the bundled library after a content change. */
export async function syncLibrary(engagementId: string): Promise<LibrarySyncResult> {
  const engagement = await db.engagements.get(engagementId);
  if (!engagement) return { added: 0, retired: 0 };

  const states = await listStates(engagementId);
  const existing = new Set(states.map((s) => s.testId));
  const retired = states.filter((s) => !TEST_BY_ID.has(s.testId)).length;
  const timestamp = now();

  const added = TEST_LIBRARY.filter((t) => !existing.has(t.id)).map((definition) =>
    createInitialState(
      engagementId,
      definition.id,
      suggestApplicability(definition, effectiveContext(engagement)).applicable,
      timestamp,
    ),
  );

  await db.transaction('rw', db.testStates, db.engagements, async () => {
    if (added.length > 0) await db.testStates.bulkAdd(added);
    // Always record the version, even when nothing was added — otherwise the
    // engagement is reported as outdated forever.
    await db.engagements.update(engagementId, {
      libraryVersion: LIBRARY_VERSION,
      updatedAt: added.length > 0 ? timestamp : engagement.updatedAt,
    });
  });

  return { added: added.length, retired };
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

/* ------------------------------------------------------- backup validation */

export class BackupValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Backup file rejected: ${issues[0]}`);
    this.name = 'BackupValidationError';
    this.issues = issues;
  }
}

export interface BackupInspection {
  ok: boolean;
  /** Fatal problems — the file is rejected. */
  issues: string[];
  /** Non-fatal notes; the import proceeds and drops the affected rows. */
  warnings: string[];
  engagements: number;
  testStates: number;
  /** States dropped because the test no longer exists in the bundled library. */
  droppedStates: number;
  libraryVersion?: string;
  exportedAt?: string;
  names: string[];
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isIsoish = (v: unknown): v is string => isString(v) && /^\d{4}-\d{2}-\d{2}/.test(v);

/**
 * Validates an untrusted file before a single byte reaches IndexedDB.
 *
 * Everything about a backup is attacker/accident-controlled: it is a JSON file
 * a tester picked off disk. So the shape, the enums and the state-machine
 * invariants are all re-checked here — an import can never introduce a record
 * the app itself refuses to create.
 */
export function inspectBackup(data: unknown): BackupInspection {
  const issues: string[] = [];
  const warnings: string[] = [];
  const empty: BackupInspection = {
    ok: false,
    issues,
    warnings,
    engagements: 0,
    testStates: 0,
    droppedStates: 0,
    names: [],
  };

  if (typeof data !== 'object' || data === null) {
    issues.push('The file does not contain a JSON object.');
    return empty;
  }
  const file = data as Partial<BackupFile>;

  if (file.format !== 'vapt-checklist-backup') {
    issues.push('Not a VAPT Checklist backup (missing or wrong "format" marker).');
    return empty;
  }
  if (file.version !== 1) {
    issues.push(`Unsupported backup version: ${String(file.version)}. This build reads version 1.`);
    return empty;
  }
  if (!Array.isArray(file.engagements) || !Array.isArray(file.testStates)) {
    issues.push('The backup is missing its "engagements" or "testStates" array.');
    return empty;
  }
  if (file.engagements.length === 0) {
    issues.push('The backup contains no engagements.');
    return empty;
  }

  const engagementIds = new Set<string>();
  file.engagements.forEach((engagement, index) => {
    const where = `Engagement #${index + 1}`;
    if (!engagement || typeof engagement !== 'object') {
      issues.push(`${where} is not an object.`);
      return;
    }
    if (!isString(engagement.id) || engagement.id.trim() === '') {
      issues.push(`${where} has no id.`);
      return;
    }
    if (engagementIds.has(engagement.id)) issues.push(`${where} duplicates id ${engagement.id}.`);
    engagementIds.add(engagement.id);

    if (!isString(engagement.name) || engagement.name.trim() === '') {
      issues.push(`${where} has no name.`);
    }
    if (!['Active', 'Completed', 'Archived'].includes(engagement.status as string)) {
      issues.push(`${where} has an unknown status "${String(engagement.status)}".`);
    }
    if (typeof engagement.context !== 'object' || engagement.context === null) {
      issues.push(`${where} has a malformed application context.`);
    }
    if (!Array.isArray(engagement.scope)) issues.push(`${where} has a malformed scope list.`);
    if (!isIsoish(engagement.createdAt) || !isIsoish(engagement.updatedAt)) {
      issues.push(`${where} has malformed timestamps.`);
    }
  });

  let droppedStates = 0;
  const seenStateKeys = new Set<string>();
  file.testStates.forEach((state, index) => {
    const where = `Test state #${index + 1}`;
    if (!state || typeof state !== 'object') {
      issues.push(`${where} is not an object.`);
      return;
    }
    if (!isString(state.engagementId) || !engagementIds.has(state.engagementId)) {
      issues.push(`${where} references an engagement that is not in the file.`);
      return;
    }
    if (!isString(state.testId)) {
      issues.push(`${where} has no test id.`);
      return;
    }
    if (!TEST_BY_ID.has(state.testId)) {
      droppedStates += 1;
      return;
    }
    const key = stateKey(state.engagementId, state.testId);
    if (seenStateKeys.has(key)) issues.push(`${where} duplicates ${state.testId}.`);
    seenStateKeys.add(key);

    if (!TEST_STATUSES.includes(state.status)) {
      issues.push(`${where} (${state.testId}) has an unknown status "${String(state.status)}".`);
    }
    if (state.result !== null && !TEST_RESULTS.includes(state.result as never)) {
      issues.push(`${where} (${state.testId}) has an unknown result "${String(state.result)}".`);
    }
    if (typeof state.applicable !== 'boolean') {
      issues.push(`${where} (${state.testId}) has a malformed applicability flag.`);
    }
    if (typeof state.notes !== 'string') {
      issues.push(`${where} (${state.testId}) has malformed notes.`);
    }
    // The imported record must satisfy the same state machine as a local one.
    if (validateState(state as TestState).length > 0) {
      issues.push(
        `${where} (${state.testId}) is inconsistent: status "${String(state.status)}" with result "${String(state.result)}".`,
      );
    }
  });

  if (droppedStates > 0) {
    warnings.push(
      `${droppedStates} test state(s) reference tests that are not in library v${LIBRARY_VERSION} and will be skipped.`,
    );
  }
  if (file.libraryVersion && file.libraryVersion !== LIBRARY_VERSION) {
    warnings.push(
      `Backup was taken on library v${file.libraryVersion}; this build ships v${LIBRARY_VERSION}. Missing tests will be seeded as Not Tested.`,
    );
  }

  return {
    ok: issues.length === 0,
    issues: issues.slice(0, 12),
    warnings,
    engagements: file.engagements.length,
    testStates: file.testStates.length - droppedStates,
    droppedStates,
    libraryVersion: file.libraryVersion,
    exportedAt: file.exportedAt,
    names: file.engagements.map((e) => (isString(e?.name) ? e.name : '(unnamed)')).slice(0, 8),
  };
}

/**
 * Imports a validated backup in one transaction. Colliding engagement IDs are
 * re-keyed rather than overwritten, so an import can add to this browser but
 * never damage what is already there.
 */
export async function importBackup(data: unknown): Promise<{ engagements: number; tests: number }> {
  const inspection = inspectBackup(data);
  if (!inspection.ok) throw new BackupValidationError(inspection.issues);

  const file = data as BackupFile;
  const idMap = new Map<string, string>();
  const existing = new Set((await db.engagements.toArray()).map((e) => e.id));

  const engagements: Engagement[] = file.engagements.map((e) => {
    const collides = existing.has(e.id);
    const id = collides ? nanoid(12) : e.id;
    idMap.set(e.id, id);
    return {
      ...e,
      id,
      name: collides ? `${e.name} (imported)` : e.name,
      scope: Array.isArray(e.scope) ? e.scope : [],
      libraryVersion: e.libraryVersion ?? LIBRARY_VERSION,
    };
  });

  const testStates: TestState[] = file.testStates
    .filter((s) => idMap.has(s.engagementId) && TEST_BY_ID.has(s.testId))
    .map((s) => {
      const engagementId = idMap.get(s.engagementId)!;
      return { ...s, engagementId, id: stateKey(engagementId, s.testId) };
    });
  testStates.forEach(assertPersistable);

  await db.transaction('rw', db.engagements, db.testStates, async () => {
    await db.engagements.bulkPut(engagements);
    await db.testStates.bulkPut(testStates);
  });

  // Seed any tests the backup predates, so the engagement is complete.
  for (const engagement of engagements) await syncLibrary(engagement.id);

  return { engagements: engagements.length, tests: testStates.length };
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.engagements, db.testStates, db.appMeta, async () => {
    await db.engagements.clear();
    await db.testStates.clear();
    await db.appMeta.clear();
  });
}
