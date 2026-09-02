import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Badge,
  Button,
  IconButton,
  InlineAlert,
  PriorityBadge,
  SegmentedControl,
  Textarea,
} from '../../ui/primitives';
import { IconAlert, IconChevron, IconExternal } from '../../ui/icons';
import { categoryName } from '../../data/categories';
import { resolveReferences } from '../../data/references';
import { describeRule, suggestApplicability } from '../../domain/applicability';
import { TEXT_LIMITS } from '../../domain/untrusted';
import type { ApplicationContext } from '../../domain/context';
import type { ChecklistItem, TestResult, TestStatus } from '../../domain/types';
import { recordTestState } from './recordState';
import { ApplicabilityExplanation } from './ApplicabilityExplanation';

/**
 * The detail pane — where the tester actually works.
 *
 * Ordered for the real loop: identity and the status/result controls sit in a
 * sticky header (reachable without scrolling past guidance), then
 * Description → Testing guidance → Notes → Applicability → References.
 * Notes come before the reference material because they are the thing a
 * tester writes while the guidance is still on screen.
 */

const STATUS_OPTIONS = [
  { value: 'Not Tested' as TestStatus, label: 'Not Tested', glyph: '○', title: 'Not performed yet (1)' },
  { value: 'Tested' as TestStatus, label: 'Tested', glyph: '●', title: 'Performed — a result is required (2)' },
  {
    value: 'N/A' as TestStatus,
    label: 'N/A',
    glyph: '⊘',
    tone: 'na' as const,
    title: 'Not applicable in practice — no result required (3)',
  },
];

const RESULT_OPTIONS = [
  {
    value: 'Vulnerable' as TestResult,
    label: 'Vulnerable',
    glyph: '▲',
    tone: 'vulnerable' as const,
    title: 'Record as Vulnerable (v)',
  },
  {
    value: 'Not Vulnerable' as TestResult,
    label: 'Not Vulnerable',
    glyph: '✓',
    tone: 'safe' as const,
    title: 'Record as Not Vulnerable (b)',
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
  onBackToList,
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
  /** Present only on narrow screens, where list and detail are separate views. */
  onBackToList?: () => void;
  notesRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { definition: d, state: s } = item;
  const [notes, setNotes] = useState(s.notes);
  /**
   * "Tested" is never written on its own — the store refuses a Tested row with
   * no result. Choosing Tested parks the intent here until the tester picks
   * Vulnerable / Not Vulnerable, written as one atomic transition.
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

  const [noteError, setNoteError] = useState(false);

  const flushNotes = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const value = pending.current;
    pending.current = null;
    if (value === null) return;
    void recordTestState(engagementId, d.id, { notes: value }, 'Note').then((ok) =>
      setNoteError(!ok),
    );
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
    void recordTestState(engagementId, d.id, { status }, 'Status');
  }

  function chooseResult(result: TestResult) {
    setPendingTested(false);
    void recordTestState(engagementId, d.id, { status: 'Tested', result }, 'Result');
  }

  const suggestion = suggestApplicability(d, context);
  const awaitingChoice = pendingTested && s.status !== 'Tested';
  const naWithoutReason = s.status === 'N/A' && !notes.trim();

  return (
    <article className="flex h-full min-h-0 flex-col" aria-label={d.vulnerabilityName}>
      {/* Sticky header: identity + the two decisions ---------------------- */}
      <header className="sticky top-0 z-10 space-y-3 border-b border-ink-800 bg-ink-900 px-4 py-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {onBackToList && (
              <Button
                size="sm"
                variant="ghost"
                className="-ml-2 mb-1"
                onClick={onBackToList}
                icon={<IconChevron size={13} className="rotate-180" />}
              >
                All tests
              </Button>
            )}
            {/* 1 — the vulnerability name is the largest thing on the screen */}
            <h2 className="text-base leading-tight font-semibold text-ink-50 sm:text-lg">
              {d.vulnerabilityName}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-ink-400">
              <PriorityBadge priority={d.priority} />
              <span className="font-mono">{d.id}</span>
              <span aria-hidden="true">·</span>
              <span>{categoryName(d.category)}</span>
              <span aria-hidden="true">·</span>
              <span>{d.subcategory}</span>
              {!s.applicable && <Badge tone="na">Not Applicable</Badge>}
              {s.applicabilitySource === 'manual' && <Badge tone="brand">Manual</Badge>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="mr-1 hidden text-micro tabular-nums text-ink-400 sm:inline">
              {position} / {total}
            </span>
            <IconButton
              size="sm"
              label="Previous test"
              onClick={onPrevious}
              icon={<IconChevron size={14} className="rotate-180" />}
            />
            <IconButton size="sm" label="Next test" onClick={onNext} icon={<IconChevron size={14} />} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-micro font-medium tracking-wider text-ink-400 uppercase">
              Status
            </span>
            <SegmentedControl
              label="Testing status"
              value={awaitingChoice ? 'Tested' : s.status}
              options={STATUS_OPTIONS}
              disabled={!s.applicable}
              onChange={chooseStatus}
            />
          </div>

          <div
            className={clsx(
              'flex items-center gap-2 rounded-[--radius-control] transition-shadow',
              awaitingChoice && 'ring-2 ring-amber-400 ring-offset-2 ring-offset-ink-900',
            )}
          >
            <span className="text-micro font-medium tracking-wider text-ink-400 uppercase">
              Result
            </span>
            <SegmentedControl
              label="Testing result"
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
            title="Jump to the next test with status Not Tested (Enter)"
          >
            Next Not Tested →
          </Button>
        </div>

        {awaitingChoice && (
          <p className="flex items-center gap-1.5 text-xs text-amber-300">
            <IconAlert size={13} aria-hidden="true" />
            Choose Vulnerable or Not Vulnerable — “Tested” is only recorded together with its result.
          </p>
        )}
      </header>

      {/* Body -------------------------------------------------------------- */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5">
        <Section title="Description">
          <p className="text-sm leading-relaxed text-ink-200">{d.description}</p>
          {d.aliases && d.aliases.length > 0 && (
            <p className="mt-2 text-micro text-ink-400">
              Also known as: <span className="text-ink-300">{d.aliases.join(' · ')}</span>
            </p>
          )}
        </Section>

        <Section title="Testing guidance">
          <ol className="space-y-2 text-sm text-ink-200">
            {d.testingGuidance.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded bg-ink-800 text-micro text-ink-300"
                >
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Notes">
          <Textarea
            ref={notesRef}
            rows={5}
            value={notes}
            onChange={(e) => saveNotes(e.target.value)}
            aria-label={`Notes for ${d.vulnerabilityName}`}
            maxLength={TEXT_LIMITS.notes}
            placeholder="Endpoints and parameters tested, payloads used, observations, conclusion…"
            className="text-xs"
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-micro text-ink-400">
            <span className={noteError ? 'font-medium text-vuln-400' : undefined}>
              {noteError
                ? 'Not saved — this note is only in the editor. Copy it before leaving the page.'
                : 'Optional · saved automatically'}
            </span>
            <span>Updated {s.updatedAt.slice(0, 16).replace('T', ' ')}</span>
          </div>

          {naWithoutReason && (
            <InlineAlert tone="warn" className="mt-3" title="Add a reason for N/A?">
              A one-line reason makes the report defensible. Optional, but recommended.
              <div className="mt-2 flex flex-wrap gap-1.5">
                {NA_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => saveNotes(reason)}
                    className="rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-micro text-ink-200 transition-colors hover:border-amber-500/50 hover:text-amber-300"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </InlineAlert>
          )}
        </Section>

        <Section title="Applicability">
          <div className="panel-inset space-y-2 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <ApplicabilityExplanation suggestion={suggestion} className="min-w-0 flex-1" />
              <SegmentedControl
                size="sm"
                label="Include this test in the engagement"
                value={s.applicable ? 'yes' : 'no'}
                options={[
                  { value: 'yes', label: 'Applicable' },
                  { value: 'no', label: 'Not Applicable', tone: 'na' },
                ]}
                onChange={(v) =>
                  void recordTestState(
                    engagementId,
                    d.id,
                    { applicable: v === 'yes', applicabilitySource: 'manual' },
                    'Applicability',
                  )
                }
              />
            </div>
            <p className="border-t border-ink-800 pt-2 text-micro text-ink-400">
              Rule: {describeRule(d.applicability)}
            </p>
            {s.applicabilitySource === 'manual' && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-micro text-amber-300">
                  Set by you (suggestion: {s.suggestedApplicable ? 'Applicable' : 'Not Applicable'})
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void recordTestState(
                      engagementId,
                      d.id,
                      { applicable: s.suggestedApplicable, applicabilitySource: 'auto' },
                      'Applicability',
                    )
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
                className="inline-flex items-center gap-1 rounded-md border border-ink-600 px-2 py-0.5 text-micro text-ink-300 transition-colors hover:border-brand-500/50 hover:text-brand-400"
              >
                {reference.label}
                <IconExternal size={10} aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ))}
          </div>
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
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-micro font-medium tracking-wider text-ink-400 uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
