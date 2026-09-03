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
import { IconAlert, IconChevron, IconExternal, IconTarget } from '../../ui/icons';
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

/* A slim keyline at the top of the pane carries the severity forward, in
   colour and width — the label stays next to it in the meta row. */
const PRIORITY_KEYLINE: Record<string, string> = {
  Critical: 'bg-vuln-500',
  High: 'bg-high-500',
  Medium: 'bg-medium-400',
  Low: 'bg-brand-500/60',
};

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
  const paneRef = useRef<HTMLElement>(null);

  /**
   * On a phone the pane is page-scrolled, so switching tests should land the
   * reader at the top of the new guidance rather than wherever they stopped
   * on the previous one. Wide screens scroll the pane body internally, which
   * already resets on the keyed remount.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    paneRef.current?.scrollIntoView?.({ block: 'start' });
  }, [d.id]);

  /**
   * Sync the editor with the stored row — but only when the store genuinely
   * changed AND the editor holds no unsaved draft. Passive effects flush after
   * paint, so an unconditional mount-time reset races with text typed in that
   * window and wipes it; a save-echo arriving mid-typing would do the same.
   * useState already seeds the draft; switching tests, imports and other tabs'
   * saves still reset it here.
   */
  const lastSynced = useRef({ id: s.id, notes: s.notes, status: s.status });
  useEffect(() => {
    const prev = lastSynced.current;
    lastSynced.current = { id: s.id, notes: s.notes, status: s.status };
    if (s.id !== prev.id || (s.notes !== prev.notes && pending.current === null)) {
      setNotes(s.notes);
    }
    if (s.id !== prev.id || s.status !== prev.status) {
      setPendingTested(false);
    }
  }, [s.id, s.notes, s.status]);

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

  const suggestion = suggestApplicability(d, context);
  const awaitingChoice = pendingTested && s.status !== 'Tested';
  const naWithoutReason = s.status === 'N/A' && !notes.trim();
  const needsEvidence = s.status === 'Tested' && s.result === 'Vulnerable' && !notes.trim();

  /** Subtle in-place confirmation whenever a status/result write lands. */
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );
  const confirmSaved = () => {
    setSavedAt(Date.now());
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedAt(null), 1600);
  };

  function chooseStatus(status: TestStatus) {
    if (status === 'Tested' && !s.result) {
      setPendingTested(true);
      return;
    }
    setPendingTested(false);
    void recordTestState(engagementId, d.id, { status }, 'Status').then(confirmSaved);
  }

  function chooseResult(result: TestResult) {
    setPendingTested(false);
    void recordTestState(engagementId, d.id, { status: 'Tested', result }, 'Result').then(
      confirmSaved,
    );
  }

  return (
    <article
      ref={paneRef}
      className="flex flex-col lg:h-full lg:min-h-0"
      aria-label={d.vulnerabilityName}
    >
      {/* Severity keyline — one glance tells you what this test is. */}
      <div aria-hidden="true" className={clsx('h-1 w-full', PRIORITY_KEYLINE[d.priority])} />
      {/* Header: identity. The decisions live in the tray at the bottom,
          within thumb reach on a phone and always on screen on a laptop. */}
      <header className="space-y-2 border-b border-ink-800 bg-ink-900 px-4 py-3.5 sm:px-5">
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
            {/* 0 — category eyebrow; 1 — the vulnerability name, largest on screen */}
            <p className="section-kicker mb-1 truncate">
              {categoryName(d.category)} · {d.subcategory}
            </p>
            <h2 className="text-base leading-tight font-semibold text-ink-50 sm:text-lg">
              {d.vulnerabilityName}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-ink-400">
              <PriorityBadge priority={d.priority} />
              <span className="font-mono">{d.id}</span>
              {!s.applicable && <Badge tone="na">Not Applicable</Badge>}
              {s.applicabilitySource === 'manual' && <Badge tone="brand">Manual</Badge>}
            </div>
          </div>
          <span className="shrink-0 text-micro tabular-nums text-ink-400">
            {position} / {total}
          </span>
        </div>
      </header>

      {/* Body ----------------------------------------------------------------
              Keyed by the test id so switching tests crossfades the pane
              instead of flashing. Scrolls internally on wide screens; on a
              phone the page itself scrolls, with the tray pinned below. */}
      <div
        key={d.id}
        className="animate-page space-y-5 px-4 py-5 sm:px-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {s.applicable && s.status === 'Not Tested' && !awaitingChoice && (
          <InlineAlert
            tone="info"
            icon={<IconTarget size={15} aria-hidden="true" />}
            title="Ready to test"
            className="items-center"
          >
            Run the guidance below, then record <strong>Tested</strong> with a result — or mark it{' '}
            <strong>N/A</strong> if it does not apply here.
          </InlineAlert>
        )}

        <Section title="What to test">
          <p className="text-sm leading-relaxed text-ink-200">{d.description}</p>
          {d.aliases && d.aliases.length > 0 && (
            <p className="mt-2 text-micro text-ink-400">
              Also known as: <span className="text-ink-300">{d.aliases.join(' · ')}</span>
            </p>
          )}
        </Section>

        <Section title="Testing guidance" divided>
          <ol className="space-y-2.5 text-base leading-relaxed text-ink-100">
            {d.testingGuidance.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded bg-ink-800 font-mono text-micro text-brand-400"
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        {needsEvidence && (
          <InlineAlert
            tone="warn"
            icon={<IconAlert size={15} aria-hidden="true" />}
            title="Record the evidence"
          >
            This test is marked Vulnerable with no note. Capture the finding while it is fresh —
            endpoint, payload, observation, impact — so the report is defensible.
          </InlineAlert>
        )}

        <Section title="Notes" divided>
          <Textarea
            ref={notesRef}
            rows={5}
            value={notes}
            onChange={(e) => saveNotes(e.target.value)}
            aria-label={`Notes for ${d.vulnerabilityName}`}
            maxLength={TEXT_LIMITS.notes}
            placeholder="Endpoints and parameters tested, payloads used, observations, conclusion…"
            className="font-mono text-xs"
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
                    className="rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-micro text-ink-200 transition-colors hover:border-warn-500/50 hover:text-warn-300"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </InlineAlert>
          )}
        </Section>

        <Section title="Applicability" divided>
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
                <span className="text-micro text-warn-300">
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

        <Section title="References" divided>
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
      </div>

      {/* Decision tray -------------------------------------------------------
          The working loop's control surface: record the status, record the
          result, move on. Pinned to the bottom of the pane on wide screens
          and to the bottom of the viewport while testing on a phone — where
          the thumb already is. */}
      <footer className="cmd-tray px-4 pt-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="flex items-center gap-1">
            <IconButton
              size="sm"
              label="Previous test"
              onClick={onPrevious}
              icon={<IconChevron size={14} className="rotate-180" />}
            />
            <IconButton size="sm" label="Next test" onClick={onNext} icon={<IconChevron size={14} />} />
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-micro font-medium tracking-wider text-ink-400 uppercase sm:inline">
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
              'flex items-center gap-2 rounded-(--radius-control) transition-shadow',
              awaitingChoice && 'ring-2 ring-warn-400 ring-offset-2 ring-offset-ink-900',
            )}
          >
            <span className="hidden text-micro font-medium tracking-wider text-ink-400 uppercase sm:inline">
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

          {savedAt !== null && (
            <span
              aria-live="polite"
              className="pop-confirm inline-flex items-center gap-1 text-xs font-medium text-safe-400"
            >
              <span aria-hidden="true">✓</span> Saved
            </span>
          )}

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
          <p className="animate-in mt-2.5 flex items-center gap-1.5 text-xs text-warn-300">
            <IconAlert size={13} aria-hidden="true" />
            Choose Vulnerable or Not Vulnerable — “Tested” is only recorded together with its result.
          </p>
        )}
      </footer>
    </article>
  );
}

function Section({
  title,
  children,
  divided,
}: {
  title: string;
  children: React.ReactNode;
  /** Adds the hairline that separates sections under an open pane. */
  divided?: boolean;
}) {
  return (
    <section className={clsx(divided && 'border-t border-ink-800 pt-5')}>
      <h3 className="mb-1.5 flex items-center gap-2 text-micro font-medium tracking-wider text-ink-400 uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
