import clsx from 'clsx';
import { PriorityBadge, ResultBadge, StatusBadge } from '../../ui/primitives';
import type { ChecklistItem } from '../../domain/types';

/**
 * One row in the workspace list.
 *
 * Hierarchy, in order of visual weight:
 *   1. Vulnerability name   2. Status   3. Result   4. Priority   5. metadata
 *
 * Dense list rather than cards: a tester scans ~170 of these, so every pixel
 * of card chrome is a pixel not spent on the name.
 */
export function TestListRow({
  item,
  active,
  selected,
  selectionMode,
  onOpen,
  onToggleSelect,
  categoryLabel,
  unconfirmed,
}: {
  item: ChecklistItem;
  active: boolean;
  selected: boolean;
  selectionMode: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  categoryLabel: string;
  unconfirmed: boolean;
}) {
  const { definition: d, state: s } = item;

  return (
    <li
      data-test-id={d.id}
      className={clsx(
        'group flex items-start gap-2 border-l-2 pr-2 pl-1.5 transition-colors',
        active ? 'border-l-brand-500 bg-brand-500/10' : 'border-l-transparent hover:bg-ink-850',
        !s.applicable && 'opacity-60',
      )}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-3 h-3.5 w-3.5 shrink-0 accent-brand-500"
          aria-label={`Select ${d.vulnerabilityName} for bulk edit`}
        />
      )}

      <button
        onClick={onOpen}
        aria-current={active ? 'true' : undefined}
        className="min-w-0 flex-1 py-2 text-left"
      >
        {/* 1 — vulnerability name dominates */}
        <span
          className={clsx(
            'block truncate text-[13px] leading-snug',
            active ? 'font-semibold text-ink-50' : 'font-medium text-ink-100',
          )}
        >
          {d.vulnerabilityName}
        </span>

        {/* 2 + 3 — status and result, always as labelled badges */}
        <span className="mt-1 flex flex-wrap items-center gap-1">
          <StatusBadge status={s.status} />
          <ResultBadge result={s.result} />
          {!s.applicable && (
            <span className="rounded-md border border-ink-600 px-1.5 py-0.5 text-[11px] text-ink-300">
              Not Applicable
            </span>
          )}
        </span>

        {/* 4 + 5 — priority then supporting metadata */}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-ink-400">
          <PriorityBadge priority={d.priority} />
          <span className="font-mono">{d.id}</span>
          <span className="truncate">{categoryLabel}</span>
          {unconfirmed && s.applicable && (
            <span className="text-amber-400" title="In scope only because context facts are unknown">
              Unconfirmed
            </span>
          )}
          {s.notes.trim() && <span title="Has notes">Note</span>}
        </span>
      </button>
    </li>
  );
}
