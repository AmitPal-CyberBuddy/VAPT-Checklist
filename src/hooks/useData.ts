/**
 * Reactive data hooks.
 * dexie-react-hooks re-runs these queries whenever IndexedDB changes, so the
 * dashboard, checklist and export always observe the same live state.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../persistence/db';
import { getChecklist, listEngagements, normaliseEngagement } from '../persistence/repository';
import { computeMetrics } from '../domain/metrics';
import type { ChecklistItem, Engagement } from '../domain/types';

export function useEngagements(): Engagement[] | undefined {
  return useLiveQuery(() => listEngagements(), []);
}

export function useEngagement(id: string | undefined): Engagement | undefined | null {
  return useLiveQuery(async () => {
    if (!id) return null;
    const engagement = await db.engagements.get(id);
    return engagement ? normaliseEngagement(engagement) : null;
  }, [id]);
}

export function useChecklist(engagementId: string | undefined): ChecklistItem[] | undefined {
  return useLiveQuery(async () => (engagementId ? getChecklist(engagementId) : []), [engagementId]);
}

export function useMetrics(items: ChecklistItem[] | undefined) {
  return useMemo(() => computeMetrics(items ?? []), [items]);
}

export function useEngagementSummaries() {
  return useLiveQuery(async () => {
    const engagements = await listEngagements();
    const summaries = await Promise.all(
      engagements.map(async (engagement) => {
        const states = await db.testStates.where('engagementId').equals(engagement.id).toArray();
        let applicable = 0;
        let resolved = 0;
        let vulnerable = 0;
        for (const s of states) {
          if (!s.applicable) continue;
          applicable += 1;
          // Completed = Tested + N/A (same rule as domain/metrics.ts).
          if (s.status === 'N/A' || s.status === 'Tested') resolved += 1;
          if (s.status === 'Tested' && s.result === 'Vulnerable') vulnerable += 1;
        }
        return {
          engagement,
          applicable,
          resolved,
          vulnerable,
          completion: applicable === 0 ? 0 : resolved / applicable,
        };
      }),
    );
    return summaries;
  }, []);
}
