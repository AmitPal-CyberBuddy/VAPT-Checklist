/**
 * VAPT Checklist — Local persistence (IndexedDB via Dexie)
 * ---------------------------------------------------------------------------
 * All engagement data lives in the browser. There is no server, so this module
 * is the entire storage tier.
 *
 * Schema v1
 *   engagements : id (pk), name, status, updatedAt
 *   testStates  : id (pk = `${engagementId}::${testId}`), engagementId,
 *                 [engagementId+testId] compound, status, applicable
 *   appMeta     : key (pk)  — schema/library bookkeeping and preferences
 *
 * Migration policy: bump DB_VERSION and add a new `.version()` block. Never
 * mutate an existing block. Engagement records keep the libraryVersion they
 * were seeded with so a library upgrade can be reconciled explicitly.
 */

import Dexie, { type Table } from 'dexie';
import type { Engagement, TestState } from '../domain/types';

export interface AppMeta {
  key: string;
  value: unknown;
}

export const DB_NAME = 'vapt-checklist';
export const DB_VERSION = 2;

export class VaptDatabase extends Dexie {
  engagements!: Table<Engagement, string>;
  testStates!: Table<TestState, string>;
  appMeta!: Table<AppMeta, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      engagements: 'id, name, status, updatedAt, createdAt',
      testStates: 'id, engagementId, testId, [engagementId+testId], status, applicable',
      appMeta: 'key',
    });

    /*
     * v2 — application type became a first-class engagement field.
     * Engagements created before it derive their type from the first asset
     * type they recorded; the remainder become additional surfaces, so the
     * derived asset list matches what the engagement had before.
     */
    this.version(2)
      .stores({
        engagements: 'id, name, status, updatedAt, createdAt, applicationType',
        testStates: 'id, engagementId, testId, [engagementId+testId], status, applicable',
        appMeta: 'key',
      })
      .upgrade((tx) =>
        tx
          .table('engagements')
          .toCollection()
          .modify((engagement: Engagement) => {
            if (engagement.applicationType) return;
            const recorded = (engagement.context?.assetTypes as string[] | undefined) ?? [];
            engagement.applicationType = (recorded[0] as Engagement['applicationType']) ?? 'web-app';
            const extra = recorded.slice(1);
            if (extra.length > 0) engagement.context.additionalSurfaces = extra;
          }),
      );
  }
}

export const db = new VaptDatabase();

export type StorageProblem =
  | 'blocked'
  | 'version-mismatch'
  | 'corrupt'
  | 'upgrade-blocked'
  | 'unknown';

export interface StorageStatus {
  ok: boolean;
  problem?: StorageProblem;
  detail?: string;
}

/**
 * Whether this browser can persist engagements, and if not, *why*.
 *
 * "Storage unavailable" is not an actionable message. A blocked origin, a
 * database left in a newer schema by another tab, and genuine corruption need
 * different responses from the tester, so the cause is classified here and the
 * banner says what to do about it.
 */
export async function checkStorage(): Promise<StorageStatus> {
  try {
    await db.open();
    return { ok: true };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    const detail = error instanceof Error ? error.message : String(error);
    if (name === 'VersionError') return { ok: false, problem: 'version-mismatch', detail };
    if (name === 'SecurityError' || name === 'InvalidStateError')
      return { ok: false, problem: 'blocked', detail };
    if (name === 'UpgradeError' || name === 'BlockedError')
      return { ok: false, problem: 'upgrade-blocked', detail };
    if (name === 'DatabaseClosedError' || /corrupt/i.test(detail))
      return { ok: false, problem: 'corrupt', detail };
    return { ok: false, problem: 'unknown', detail };
  }
}

/** True when the browser can persist engagements at all. */
export async function storageAvailable(): Promise<boolean> {
  return (await checkStorage()).ok;
}

/** Ask the browser not to evict the database under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}
