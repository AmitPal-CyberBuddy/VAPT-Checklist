import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Badge, Button, SegmentedControl, Textarea, priorityTone } from '../../ui/primitives';
import { IconAlert, IconChevron, IconExternal } from '../../ui/icons';
import { categoryName } from '../../data/categories';
import { resolveReferences } from '../../data/references';
import { describeRule, suggestApplicability } from '../../domain/applicability';
import type { ApplicationContext } from '../../domain/context';
import type { ChecklistItem, TestResult, TestStatus } from '../../domain/types';
import { updateTestState } from '../../persistence/repository';
import { ApplicabilityExplanation } from './ApplicabilityExplanation';

/**
 * The detail pane — where a tester actually works.
 *
 * Layout is ordered for the real loop: the status/result controls sit in a
 * sticky bar at the top (reachable without scrolling past the guidance), then
 * Description → Testing Guidance → Applicability → References → Notes.
 */

const STATUS_OPTIONS = [
  { value: 'Not Tested' as TestStatus, label: 'Not Tested', title: 'Not performed yet (1)' },
  { value: 'Tested' as TestStatus, label: 'Tested', title: 'Performed — a result is required (2)' },
  {
    value: 'N/A' as TestStatus,
    label: 'N/A',
    tone: 'na' as const,
    title: 'Not applicable in practice — no result required (3)',
  },
];

const RESULT_OPTIONS = [
  { value: 'Vulnerable' as TestResult, label: 'Vulnerable', tone: 'vulnerable' as const, title: 'v' },
  {
    value: 'Not Vulnerable' as TestResult,
    label: 'Not Vulnerable',
    tone: 'safe' as const,
    title: 'n',
  },
];

const NA_REASONS = [
  'Feature not present in this application',
  'Out of agreed scope',
  'Covered by another test',
  'Not reachable in the test environment',
];

export function TestDetailPanel({
  item,
  engagementId,
  context,
  position,
  total,
  onPrevious,
  onNext,
  onNextUntested,
  notesRef,
}: {
  item: ChecklistItem;
  engagementId: string;
  context: ApplicationContext;
  position: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onNextUntested: () => void;
  notesRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { definition: d, state: s } = item;
  const [notes, setNotes] = useState(s.notes);
  /**
   * "Tested" is never written on its own — the store refuses a Tested row with
   * no result. Choosing Tested therefore parks the intent here until the
   * tester picks Vulnerable / Not Vulnerable, which is written as one atomic
   * transition. That keeps `Tested = Vulnerable + Not Vulnerable` true at all
   * times, on screen and on disk.
   */
  const [pendingTested, setPendingTested] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    setNotes(s.notes);
  }, [s.id, s.notes]);

  useEffect(() => {
    setPendingTested(false);
  }, [s.id, s.status]);

  const flushNotes = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const value = pending.current;
    pending.current = null;
    if (value !== null) void updateTestState(engagementId, d.id, { notes: value });
  }, [engagementId, d.id]);

  // Never lose a half-typed note: flush on unmount, tab hide and page unload.
  useEffect(() => {
    const onHide = () => flushNotes();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      flushNotes();
    };
  }, [flushNotes]);

  function saveNotes(value: string) {
    setNotes(value);
    pending.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flushNotes, 350);
  }

  function chooseStatus(status: TestStatus) {
    if (status === 'Tested' && !s.result) {
      setPendingTested(true);
      return;
    }
    setPendingTested(false);
    void updateTestState(engagementId, d.id, { status });
  }

  function chooseResult(result: TestResult) {
    setPendingTested(false);
    void updateTestState(engagementId, d.id, { status: 'Tested', result });
  }

  const suggestion = suggestApplicability(d, context);
  const awaitingChoice = pendingTested && s.status !== 'Tested';
  const naWithoutReason = s.status === 'N/A' && !notes.trim();

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header + actions (sticky) --------------------------------------- */}
      <div className="sticky top-0 z-10 space-y-3 border-b border-ink-800 bg-ink-900/95 px-5 py-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg leading-tight font-semibold text-ink-50">
              {d.vulnerabilityName}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
              <span className="font-mono">{d.id}</span>
              <span>·</span>
              <span>{categoryName(d.category)}</span>
              <span>·</span>
              <span>{d.subcategory}</span>
              <Badge tone={priorityTone(d.priority)}>{d.priority}</Badge>
              {!s.applicable && <Badge tone="na">Excluded from scope</Badge>}
              {s.applicabilitySource === 'manual' && <Badge tone="brand">Manual</Badge>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="mr-1 text-[11px] tabular-nums text-ink-600">
              {position} / {total}
            </span>
            <Button size="sm" variant="ghost" onClick={onPrevious} title="Previous test (k / ↑)">
              <IconChevron size={14} className="rotate-180" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onNext} title="Next test (j / ↓)">
              <IconChevron size={14} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] tracking-wider text-ink-500 uppercase">Status</span>
            <SegmentedControl
              value={awaitingChoice ? 'Tested' : s.status}
              options={STATUS_OPTIONS}
              disabled={!s.applicable}
              onChange={chooseStatus}
            />
          </div>

          <div
            className={clsx(
              'flex items-center gap-2 rounded-lg transition-all',
              awaitingChoice && 'ring-2 ring-amber-500/70 ring-offset-2 ring-offset-ink-900',
            )}
          >
            <span className="text-[11px] tracking-wider text-ink-500 uppercase">Result</span>
            <SegmentedControl
              value={s.result}
              options={RESULT_OPTIONS}
              disabled={s.status !== 'Tested' && !awaitingChoice}
              onChange={chooseResult}
            />
          </div>

          <Button
            size="sm"
            variant={awaitingChoice ? 'subtle' : 'primary'}
            className="ml-auto"
            onClick={onNextUntested}
            title="Jump to the next Not Tested item (Enter)"
          >
            Next untested →
          </Button>
        </div>

        {awaitingChoice && (
          <p className="flex items-center gap-1.5 text-xs text-amber-400">
            <IconAlert size={13} /> Choose Vulnerable or Not Vulnerable — “Tested” is only recorded
            together with its result.
          </p>
        )}
      </div>

      {/* Body ------------------------------------------------------------- */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <Section title="Description">
          <p className="text-sm leading-relaxed text-ink-200">{d.description}</p>
          {d.aliases && d.aliases.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-500">
              Also known as: <span className="text-ink-400">{d.aliases.join(' · ')}</span>
            </p>
          )}
        </Section>

        <Section title="Testing guidance">
          <ol className="space-y-2 text-sm text-ink-300">
            {d.testingGuidance.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded bg-ink-800 text-[10px] text-ink-400">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Applicability">
          <div className="panel-muted space-y-2 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <ApplicabilityExplanation suggestion={suggestion} className="min-w-0 flex-1" />
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
            <p className="border-t border-ink-800 pt-2 text-[11px] text-ink-600">
              Rule: {describeRule(d.applicability)}
            </p>
            {s.applicabilitySource === 'manual' && (
              <div className="flex items-center justify-between gap-2">
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
        </Section>

        <Section title="References">
          <div className="flex flex-wrap gap-1.5">
            {resolveReferences(d).map((reference) => (
              <a
                key={reference.label}
                href={reference.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded-md border border-ink-600 px-2 py-0.5 text-[11px] text-ink-300 hover:border-brand-500/50 hover:text-brand-400"
              >
                {reference.label}
                <IconExternal size={10} />
              </a>
            ))}
          </div>
        </Section>

        <Section title="Notes">
          <Textarea
            ref={notesRef}
            rows={5}
            value={notes}
            onChange={(e) => saveNotes(e.target.value)}
            placeholder="Endpoints and parameters tested, payloads used, observations, conclusion…"
            className="text-xs"
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-ink-600">Optional · saved automatically</span>
            {s.updatedAt && (
              <span className="text-[11px] text-ink-700">
                updated {s.updatedAt.slice(0, 16).replace('T', ' ')}
              </span>
            )}
          </div>

          {naWithoutReason && (
            <div className="animate-in mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-300">
                Why is this not applicable? A one-line reason makes the report defensible — optional,
                but recommended.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {NA_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => saveNotes(reason)}
                    className="rounded-md border border-ink-600 bg-ink-900/60 px-2 py-1 text-[11px] text-ink-300 hover:border-amber-500/40 hover:text-amber-300"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>

        <div className="flex items-center justify-between border-t border-ink-800 pt-4">
          <Button variant="ghost" size="sm" onClick={onPrevious}>
            ← Previous
          </Button>
          <Button variant="secondary" size="sm" onClick={onNext}>
            Next test →
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-medium tracking-wider text-ink-400 uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
