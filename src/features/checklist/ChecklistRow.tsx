import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Badge,
  Button,
  SegmentedControl,
  Textarea,
  priorityTone,
} from '../../ui/primitives';
import { IconChevron, IconExternal } from '../../ui/icons';
import { categoryName } from '../../data/categories';
import { resolveReferences } from '../../data/references';
import { describeRule, suggestApplicability } from '../../domain/applicability';
import { ApplicabilityExplanation } from './ApplicabilityExplanation';
import type { ApplicationContext } from '../../domain/context';
import type { ChecklistItem, TestResult, TestStatus } from '../../domain/types';
import { updateTestState } from '../../persistence/repository';

const STATUS_OPTIONS = [
  { value: 'Not Tested' as TestStatus, label: 'Not Tested', tone: 'default' as const },
  { value: 'Tested' as TestStatus, label: 'Tested', tone: 'default' as const },
  { value: 'N/A' as TestStatus, label: 'N/A', tone: 'na' as const, title: 'Not applicable in practice — no result required' },
];

const RESULT_OPTIONS = [
  { value: 'Vulnerable' as TestResult, label: 'Vulnerable', tone: 'vulnerable' as const },
  { value: 'Not Vulnerable' as TestResult, label: 'Not Vulnerable', tone: 'safe' as const },
];

export function ChecklistRow({
  item,
  engagementId,
  context,
  expanded,
  onToggleExpand,
  selected,
  onToggleSelect,
  highlighted,
}: {
  item: ChecklistItem;
  engagementId: string;
  context: ApplicationContext;
  expanded: boolean;
  onToggleExpand: () => void;
  selected: boolean;
  onToggleSelect: () => void;
  highlighted?: boolean;
}) {
  const { definition: d, state: s } = item;
  const [notes, setNotes] = useState(s.notes);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => setNotes(s.notes), [s.notes]);

  useEffect(() => {
    // Guarded: scrollIntoView is unavailable in some embedded/test environments.
    if (highlighted && typeof rowRef.current?.scrollIntoView === 'function') {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  function saveNotes(value: string) {
    setNotes(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void updateTestState(engagementId, d.id, { notes: value });
    }, 400);
  }

  const suggestion = suggestApplicability(d, context);
  const needsResult = s.status === 'Tested' && !s.result;
  const overridden = s.applicabilitySource === 'manual';

  return (
    <div
      ref={rowRef}
      className={clsx(
        'border-t border-ink-850 transition-colors first:border-t-0',
        !s.applicable && 'opacity-55',
        highlighted && 'bg-brand-500/5',
        needsResult && 'bg-amber-500/5',
      )}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1.5 h-3.5 w-3.5 shrink-0 accent-sky-500"
          aria-label={`Select ${d.vulnerabilityName}`}
        />

        <button
          onClick={onToggleExpand}
          className="mt-0.5 shrink-0 text-ink-500 transition-transform hover:text-ink-200"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <IconChevron size={14} className={clsx('transition-transform', expanded && 'rotate-90')} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onToggleExpand}
              className="text-left text-sm font-medium text-ink-100 hover:text-brand-400"
            >
              {d.vulnerabilityName}
            </button>
            <Badge tone={priorityTone(d.priority)}>{d.priority}</Badge>
            <span className="font-mono text-[11px] text-ink-600">{d.id}</span>
            <span className="hidden text-[11px] text-ink-500 lg:inline">{d.subcategory}</span>
            {!s.applicable && <Badge tone="na">Excluded</Badge>}
            {overridden && s.applicable && <Badge tone="brand" title="Applicability set manually">Manual</Badge>}
            {suggestion.uncertain && s.applicable && (
              <Badge tone="warn" title={suggestion.reasons.join(' · ')}>
                Unconfirmed
              </Badge>
            )}
            {needsResult && <Badge tone="warn">Result required</Badge>}
            {s.notes.trim() && !expanded && <Badge tone="neutral">Notes</Badge>}
          </div>
          {!expanded && (
            <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{d.description}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
          <SegmentedControl
            size="sm"
            value={s.status}
            options={STATUS_OPTIONS}
            disabled={!s.applicable}
            onChange={(status) => void updateTestState(engagementId, d.id, { status })}
          />
          <SegmentedControl
            size="sm"
            value={s.result}
            options={RESULT_OPTIONS}
            disabled={s.status !== 'Tested'}
            className={clsx(s.status !== 'Tested' && 'invisible hidden sm:inline-flex')}
            onChange={(result) => void updateTestState(engagementId, d.id, { result })}
          />
        </div>
      </div>

      {expanded && (
        <div className="animate-in space-y-4 border-t border-ink-850 bg-ink-950/40 px-3 py-4 pl-12">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] font-medium tracking-wider text-ink-400 uppercase">
                  What this vulnerability is
                </p>
                <p className="text-sm leading-relaxed text-ink-200">{d.description}</p>
                {d.aliases && d.aliases.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-ink-500">
                    Also known as: <span className="text-ink-400">{d.aliases.join(' · ')}</span>
                  </p>
                )}
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium tracking-wider text-ink-400 uppercase">
                  How to test
                </p>
                <ol className="space-y-1.5 text-sm text-ink-300">
                  {d.testingGuidance.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-ink-800 text-[10px] text-ink-400">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] font-medium tracking-wider text-ink-400 uppercase">
                  Notes / observations
                </p>
                <Textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => saveNotes(e.target.value)}
                  placeholder="Payloads used, endpoints tested, evidence references, why this was marked N/A…"
                  className="text-xs"
                />
                <p className="mt-1 text-[11px] text-ink-600">Saved automatically.</p>
              </div>

              <div className="panel-muted space-y-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-200">
                      Applicable to this engagement
                    </p>
                    <ApplicabilityExplanation suggestion={suggestion} className="mt-1.5" />
                    <p className="mt-1.5 text-[11px] text-ink-600">
                      Rule: {describeRule(d.applicability)}
                    </p>
                  </div>
                  <SegmentedControl
                    size="sm"
                    value={s.applicable ? 'yes' : 'no'}
                    options={[
                      { value: 'yes', label: 'In scope' },
                      { value: 'no', label: 'Excluded', tone: 'na' },
                    ]}
                    onChange={(v) =>
                      void updateTestState(engagementId, d.id, {
                        applicable: v === 'yes',
                        applicabilitySource: 'manual',
                      })
                    }
                  />
                </div>
                {overridden && (
                  <div className="flex items-center justify-between border-t border-ink-800 pt-2">
                    <span className="text-[11px] text-amber-400">
                      Manually overridden (suggestion: {s.suggestedApplicable ? 'in scope' : 'excluded'})
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void updateTestState(engagementId, d.id, {
                          applicable: s.suggestedApplicable,
                          applicabilitySource: 'auto',
                        })
                      }
                    >
                      Reset to suggestion
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                <span className="text-ink-400">
                  {categoryName(d.category)} · {d.subcategory}
                </span>
                {resolveReferences(d).map((reference) => (
                  <a
                    key={reference.label}
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 rounded-md border border-ink-600 px-1.5 py-0.5 hover:border-brand-500/50 hover:text-brand-400"
                  >
                    {reference.label}
                    <IconExternal size={10} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { STATUS_OPTIONS, RESULT_OPTIONS };
