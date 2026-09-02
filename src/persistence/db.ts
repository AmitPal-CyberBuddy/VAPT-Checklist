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
export const DB_VERSION = 1;

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
  }
}

export const db = new VaptDatabase();

/** True when the browser can persist engagements at all. */
export async function storageAvailable(): Promise<boolean> {
  try {
    await db.open();
    return true;
  } catch {
    return false;
  }
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
