import clsx from 'clsx';
import { Badge, priorityTone } from '../../ui/primitives';
import type { ChecklistItem } from '../../domain/types';

/**
 * One row in the workspace list. Shows exactly what the tester needs to triage
 * at a glance: vulnerability name, test ID, category, priority, status, result.
 */

const STATUS_DOT: Record<string, string> = {
  'Not Tested': 'bg-ink-600',
  Tested: 'bg-brand-500',
  'N/A': 'bg-ink-500',
};

export function TestListRow({
  item,
  active,
  selected,
  selectionMode,
  onOpen,
  onToggleSelect,
  categoryLabel,
  uncertain,
}: {
  item: ChecklistItem;
  active: boolean;
  selected: boolean;
  selectionMode: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  categoryLabel: string;
  uncertain: boolean;
}) {
  const { definition: d, state: s } = item;
  const needsResult = s.status === 'Tested' && !s.result;

  return (
    <div
      className={clsx(
        'group flex items-start gap-2 border-l-2 px-2.5 py-2 transition-colors',
        active
          ? 'border-l-brand-500 bg-brand-500/10'
          : 'border-l-transparent hover:bg-ink-800/50',
        !s.applicable && 'opacity-55',
      )}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-3.5 w-3.5 shrink-0 accent-sky-500"
          aria-label={`Select ${d.vulnerabilityName}`}
        />
      )}

      <button onClick={onOpen} className="min-w-0 flex-1 text-left" aria-current={active}>
        <span className="flex items-start gap-2">
          <span
            className={clsx(
              'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
              s.result === 'Vulnerable'
                ? 'bg-rose-500'
                : s.result === 'Not Vulnerable'
                  ? 'bg-emerald-500'
                  : STATUS_DOT[s.status],
            )}
            title={s.result ? `${s.status} · ${s.result}` : s.status}
          />
          <span className="min-w-0 flex-1">
            <span
              className={clsx(
                'block truncate text-[13px] leading-snug',
                active ? 'font-medium text-ink-50' : 'text-ink-200',
              )}
            >
              {d.vulnerabilityName}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-500">
              <span className="font-mono">{d.id}</span>
              <span className="truncate">{categoryLabel}</span>
              <Badge tone={priorityTone(d.priority)} className="px-1 py-0 text-[10px]">
                {d.priority}
              </Badge>
              {needsResult && <span className="text-amber-400">result required</span>}
              {uncertain && s.applicable && <span className="text-amber-500/80">unconfirmed</span>}
              {!s.applicable && <span className="text-ink-600">excluded</span>}
              {s.notes.trim() && <span className="text-ink-600">note</span>}
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
