import { memo, useEffect, useState } from 'react';
import clsx from 'clsx';
import { Badge, PriorityBadge, ResultBadge, StatusBadge } from '../../ui/primitives';
import type { ChecklistItem, TestResult, TestStatus } from '../../domain/types';
import { TEST_STATUSES } from '../../domain/types';

/**
 * One row in the workspace list.
 *
 * Hierarchy, in order of visual weight:
 *   1. Vulnerability name   2. Status   3. Result   4. Priority   5. metadata
 *
 * A dense list rather than cards: a tester scans ~150 of these, so every pixel
 * of card chrome is a pixel not spent on the name.
 *
 * The row carries its own status control. Marking a test N/A — the single most
 * frequent action on a long checklist — should not require opening it, losing
 * your place, and coming back.
 */

const RESULT_OPTIONS: { value: TestResult; label: string; glyph: string; tone: string }[] = [
  { value: 'Vulnerable', label: 'Vulnerable', glyph: '▲', tone: 'bg-vuln-500 text-white border-vuln-400' },
  {
    value: 'Not Vulnerable',
    label: 'Not Vulnerable',
    glyph: '✓',
    tone: 'bg-safe-500 text-ink-950 border-safe-400',
  },
];

function RowStatusControl({
  item,
  onStatus,
  onResult,
}: {
  item: ChecklistItem;
  onStatus: (id: string, status: TestStatus) => void;
  onResult: (id: string, result: TestResult) => void;
}) {
  const { definition: d, state: s } = item;
  /** "Tested" is never written without a result — the store refuses it. */
  const [pendingTested, setPendingTested] = useState(false);
  useEffect(() => setPendingTested(false), [s.id, s.status]);

  const awaitingChoice = pendingTested && s.status !== 'Tested';
  const showResults = awaitingChoice || s.status === 'Tested';

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      <select
        aria-label={`Status for ${d.vulnerabilityName}`}
        value={awaitingChoice ? 'Tested' : s.status}
        disabled={!s.applicable}
        onChange={(e) => {
          const next = e.target.value as TestStatus;
          if (next === 'Tested' && !s.result) setPendingTested(true);
          else {
            setPendingTested(false);
            onStatus(d.id, next);
          }
        }}
        className={clsx(
          'select-chevron h-7 cursor-pointer rounded-(--radius-control) border bg-ink-950/60 py-0 pr-6 pl-2',
          'text-micro transition-[border-color,box-shadow] hover:border-ink-500',
          'focus:border-brand-400 focus:outline-none focus:shadow-(--glow-brand) disabled:cursor-not-allowed disabled:opacity-50',
          awaitingChoice
            ? 'border-warn-400 text-warn-300 ring-2 ring-warn-400/35'
            : s.status === 'Tested'
              ? 'border-brand-500/60 text-brand-300'
              : s.status === 'N/A'
                ? 'border-ink-600 text-ink-400'
                : 'border-ink-600 text-ink-100',
        )}
      >
        {TEST_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>

      {showResults && (
        <div
          role="group"
          aria-label={`Result for ${d.vulnerabilityName}`}
          className={clsx(
            'animate-in flex gap-1 rounded-(--radius-control)',
            awaitingChoice && 'ring-2 ring-warn-400',
          )}
        >
          {RESULT_OPTIONS.map((option) => {
            const active = s.result === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                title={option.label}
                onClick={() => {
                  setPendingTested(false);
                  onResult(d.id, option.value);
                }}
                className={clsx(
                  'h-7 rounded-(--radius-control) border px-2 text-micro font-medium transition-[color,border-color,background-color,box-shadow] duration-100',
                  active
                    ? option.tone
                    : 'border-ink-600 bg-ink-900 text-ink-300 hover:border-ink-500 hover:text-ink-100',
                )}
              >
                <span aria-hidden="true" className="font-mono">
                  {option.glyph}
                </span>
                <span className="sr-only">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TestListRowInner({
  item,
  active,
  selected,
  selectionMode,
  highValue,
  onOpen,
  onToggleSelect,
  onStatus,
  onResult,
  categoryLabel,
  unconfirmed,
  buttonRef,
}: {
  item: ChecklistItem;
  active: boolean;
  selected: boolean;
  selectionMode: boolean;
  /** Ranked among the engagement's highest-value outstanding tests. */
  highValue: boolean;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onStatus: (id: string, status: TestStatus) => void;
  onResult: (id: string, result: TestResult) => void;
  categoryLabel: string;
  unconfirmed: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const { definition: d, state: s } = item;

  return (
    <li
      data-test-id={d.id}
      className={clsx(
        'group relative border-l-2 pr-2 pl-1.5 transition-colors duration-150',
        active
          ? 'glow-active border-l-brand-500 bg-brand-500/10'
          : s.result === 'Vulnerable'
            ? 'border-l-vuln-500/70 hover:bg-ink-850'
            : 'border-l-transparent hover:bg-ink-850',
        !s.applicable && 'opacity-60',
      )}
    >
      {/* The active test: a solid brand rail plus a viewing notch, so the
          selected row is identifiable at a glance even mid-scroll. */}
      {active && (
        <span aria-hidden="true" className="absolute top-0 bottom-0 left-0 w-0.5 bg-brand-400/90" />
      )}
      <div className="flex items-start gap-2">
        {selectionMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(d.id)}
            className="mt-3 h-3.5 w-3.5 shrink-0 accent-brand-500"
            aria-label={`Select ${d.vulnerabilityName} for bulk edit`}
          />
        )}

        <button
          ref={buttonRef}
          onClick={() => onOpen(d.id)}
          aria-current={active ? 'true' : undefined}
          tabIndex={active ? 0 : -1}
          className="min-w-0 flex-1 py-2 text-left"
        >
          {/* 1 — the vulnerability name dominates */}
          <span
            className={clsx(
              'block truncate text-sm leading-snug',
              active ? 'font-semibold text-ink-50' : 'font-medium text-ink-100',
            )}
          >
            {d.vulnerabilityName}
          </span>

          {/* 2 + 3 — status and result, always as labelled badges.
              Keys force a remount when the value changes so the badges
              fade in as feedback for exactly the row that changed. */}
          <span className="mt-1 flex flex-wrap items-center gap-1">
            <span key={`${s.status}-${s.id}`} className="animate-in inline-flex">
              <StatusBadge status={s.status} />
            </span>
            {s.result && (
              <span key={`${s.result}-${s.id}`} className="animate-in inline-flex">
                <ResultBadge result={s.result} />
              </span>
            )}
            {!s.applicable && (
              <span className="rounded-md border border-ink-600 px-1.5 py-0.5 text-micro text-ink-300">
                Not Applicable
              </span>
            )}
          </span>

          {/* 4 + 5 — priority then supporting metadata */}
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-ink-400">
            <PriorityBadge priority={d.priority} />
            {highValue && s.status === 'Not Tested' && (
              <Badge tone="brand" glyph="★" title="Among the highest-value tests still outstanding">
                High value
              </Badge>
            )}
            <span className="font-mono">{d.id}</span>
            <span className="truncate">{categoryLabel}</span>
            {unconfirmed && s.applicable && (
              <span className="text-warn-400" title="Applicable only because context facts are unknown">
                Unconfirmed
              </span>
            )}
            {s.notes.trim() && <span title="Has notes">Note</span>}
          </span>
        </button>

        {/* Record the outcome without leaving the list. */}
        <div className="shrink-0 py-2">
          <RowStatusControl item={item} onStatus={onStatus} onResult={onResult} />
        </div>
      </div>
    </li>
  );
}

/**
 * Memoised on the fields the row actually draws.
 *
 * A default `memo` is not enough: every write re-runs the Dexie live query,
 * which rebuilds every ChecklistItem, so identity comparison fails and all
 * ~150 rows re-render for a single status change (measured). Comparing the
 * rendered fields brings that to one. Handlers take the test id so their
 * identity stays stable across renders.
 */
export const TestListRow = memo(TestListRowInner, (prev, next) => {
  const a = prev.item;
  const b = next.item;
  return (
    a.definition.id === b.definition.id &&
    a.state.status === b.state.status &&
    a.state.result === b.state.result &&
    a.state.applicable === b.state.applicable &&
    // Only the presence of a note is rendered, not its text.
    a.state.notes.trim().length > 0 === (b.state.notes.trim().length > 0) &&
    prev.active === next.active &&
    prev.selected === next.selected &&
    prev.selectionMode === next.selectionMode &&
    prev.highValue === next.highValue &&
    prev.unconfirmed === next.unconfirmed &&
    prev.categoryLabel === next.categoryLabel &&
    prev.buttonRef === next.buttonRef &&
    prev.onOpen === next.onOpen &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.onStatus === next.onStatus &&
    prev.onResult === next.onResult
  );
});
