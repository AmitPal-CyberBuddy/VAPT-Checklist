import { updateTestState, bulkUpdateTestStates } from '../../persistence/repository';
import type { StateTransition } from '../../domain/executionState';
import { toast } from '../../ui/toast';

/**
 * The single place the workspace writes a test result.
 *
 * Every call site used to be `void updateTestState(...)`: a rejected promise
 * disappeared, so a refused state change, a full storage quota or a closed
 * database looked exactly like a successful save. The control would snap back
 * on the next render with no explanation, and a half-typed note would be lost
 * silently — the worst failure mode for a tool whose whole job is recording
 * what you found.
 *
 * These helpers never throw at the caller; they report.
 */

function describe(error: unknown): string {
  if (error instanceof Error) {
    // Dexie surfaces quota problems as a DOMException named QuotaExceededError.
    if (error.name === 'QuotaExceededError' || /quota/i.test(error.message)) {
      return 'This browser is out of storage for the site. Export a JSON backup, then clear old engagements.';
    }
    if (/inconsistent/i.test(error.message)) return error.message;
    return error.message;
  }
  return String(error);
}

/**
 * Records a change and surfaces any failure.
 * Returns true when the write reached IndexedDB.
 */
export async function recordTestState(
  engagementId: string,
  testId: string,
  change: StateTransition,
  context?: string,
): Promise<boolean> {
  try {
    await updateTestState(engagementId, testId, change);
    return true;
  } catch (error) {
    toast.error(context ? `${context} — not saved` : 'Change not saved', describe(error));
    return false;
  }
}

/** Bulk equivalent. The repository already applies the batch atomically. */
export async function recordBulk(
  engagementId: string,
  testIds: string[],
  change: StateTransition,
  successMessage: string,
): Promise<boolean> {
  try {
    await bulkUpdateTestStates(engagementId, testIds, change);
    toast.success(successMessage, `${testIds.length} test${testIds.length === 1 ? '' : 's'} updated.`);
    return true;
  } catch (error) {
    toast.error('Bulk update not saved', describe(error));
    return false;
  }
}
