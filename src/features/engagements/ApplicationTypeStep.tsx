import type { ReactElement } from 'react';
import clsx from 'clsx';
import { Badge, Card, InlineAlert } from '../../ui/primitives';
import {
  IconAlert,
  IconCheck,
  IconCircle,
  IconCircleHalf,
  IconCloud,
  IconCode,
  IconGlobe,
  IconHexagon,
  IconInfo,
  IconMonitor,
  IconServer,
  IconSmartphone,
} from '../../ui/icons';
import { APPLICATION_TYPES, type ApplicationTypeId } from '../../domain/applicationType';
import { coverageFor } from '../../data/typeCoverage';
import { categoryName } from '../../data/categories';

/**
 * Application type selection — the first substantive decision in an engagement.
 *
 * Every card states the coverage the bundled library actually provides for that
 * domain, measured from the library itself. A type with no domain-specific
 * tests is shown, explained and refused: offering it would produce a checklist
 * of web tests wearing the wrong label.
 */

const SUPPORT_BADGE = {
  supported: { tone: 'success' as const, label: 'Supported', glyph: <IconCheck size={11} strokeWidth={3} /> },
  limited: { tone: 'warn' as const, label: 'Limited support', glyph: <IconCircleHalf size={11} strokeWidth={2.5} /> },
  unsupported: { tone: 'neutral' as const, label: 'Not supported', glyph: <IconCircle size={11} strokeWidth={2.5} /> },
};

/* One glyph per testing domain, so the picker scans as a set of disciplines. */
const TYPE_ICON: Record<ApplicationTypeId, ReactElement> = {
  'web-app': <IconGlobe size={20} aria-hidden="true" />,
  'rest-api': <IconServer size={20} aria-hidden="true" />,
  'graphql-api': <IconHexagon size={20} aria-hidden="true" />,
  'soap-api': <IconCode size={20} aria-hidden="true" />,
  'mobile-android': <IconSmartphone size={20} aria-hidden="true" />,
  'mobile-ios': <IconSmartphone size={20} aria-hidden="true" />,
  cloud: <IconCloud size={20} aria-hidden="true" />,
  'thick-client': <IconMonitor size={20} aria-hidden="true" />,
};

export function ApplicationTypePicker({
  value,
  onChange,
}: {
  value: ApplicationTypeId | null;
  onChange: (id: ApplicationTypeId) => void;
}) {
  return (
    <ul className="grid list-none gap-2 sm:grid-cols-2">
      {APPLICATION_TYPES.map((type) => {
        const coverage = coverageFor(type.id);
        const badge = SUPPORT_BADGE[coverage.support];
        const selected = value === type.id;
        const unsupported = coverage.support === 'unsupported';
        return (
          <li key={type.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(type.id)}
              className={clsx(
                'flex h-full w-full flex-col gap-2 rounded-(--radius-control) border p-3.5 text-left transition-colors duration-150',
                selected
                  ? 'glow-active border-brand-500 bg-brand-500/10'
                  : unsupported
                    ? 'border-dashed border-ink-700 bg-ink-900 opacity-60 hover:opacity-80'
                    : 'border-ink-700 bg-ink-850 hover:border-brand-500/40 hover:bg-ink-800',
              )}
            >
              <span className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={clsx(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius-control) border',
                    selected
                      ? 'border-brand-500/50 bg-brand-500/15 text-brand-400'
                      : 'border-ink-600 bg-ink-900 text-ink-300',
                  )}
                >
                  {TYPE_ICON[type.id]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink-100">{type.label}</span>
                    <Badge tone={badge.tone} glyph={badge.glyph}>
                      {badge.label}
                    </Badge>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-ink-400">
                    {type.description}
                  </span>
                </span>
              </span>
              <span className="mt-auto pt-1 text-micro text-ink-400">
                {unsupported ? (
                  'No tests for this domain'
                ) : (
                  <>
                    <strong className="font-mono tabular-nums text-ink-100">
                      {coverage.specific.length}
                    </strong>{' '}
                    tests specific to this domain
                    <span className="mt-0.5 block tabular-nums">
                      {coverage.startingChecklist} in the starting checklist
                    </span>
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The honest detail for whichever type is selected. */
export function ApplicationTypeDetail({ type }: { type: ApplicationTypeId }) {
  const definition = APPLICATION_TYPES.find((t) => t.id === type)!;
  const coverage = coverageFor(type);

  if (coverage.support === 'unsupported') {
    return (
      <InlineAlert
        tone="error"
        icon={<IconAlert size={18} aria-hidden="true" />}
        title={`${definition.label} is not supported`}
      >
        <ul className="mt-1 space-y-1">
          {definition.limitations?.map((limitation) => (
            <li key={limitation}>· {limitation}</li>
          ))}
        </ul>
        {definition.alternative && (
          <p className="mt-2 text-ink-200">{definition.alternative}</p>
        )}
      </InlineAlert>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-ink-100">
          What this covers
        </h3>
        <Badge
          tone={SUPPORT_BADGE[coverage.support].tone}
          glyph={SUPPORT_BADGE[coverage.support].glyph}
        >
          {SUPPORT_BADGE[coverage.support].label}
        </Badge>
      </div>
      <p className="text-sm text-ink-300">{definition.covers}</p>

      <div className="flex flex-wrap gap-1.5">
        {coverage.categories.map(({ category, count }) => (
          <Badge key={category} tone="neutral">
            {categoryName(category)} · {count}
          </Badge>
        ))}
      </div>

      <div className="border-t border-ink-800 pt-3">
        <p className="mb-1.5 text-micro tracking-wider text-ink-400 uppercase">
          Where the starting checklist comes from
        </p>
        <dl className="space-y-1 text-xs">
          {[
            ['Specific to this domain', coverage.specific.length],
            ['Shared HTTP-layer tests', coverage.shared.length],
            ['Apply to any target', coverage.universal],
            ['Awaiting a context answer', coverage.pendingContext],
          ]
            .filter(([, count]) => (count as number) > 0)
            .map(([label, count]) => (
              <div key={label as string} className="flex justify-between gap-4">
                <dt className="text-ink-300">{label}</dt>
                <dd className="tabular-nums text-ink-200">{count as number}</dd>
              </div>
            ))}
          <div className="flex justify-between gap-4 border-t border-ink-800 pt-1 font-medium">
            <dt className="text-ink-100">Starting checklist</dt>
            <dd className="tabular-nums text-ink-50">{coverage.startingChecklist}</dd>
          </div>
        </dl>
        <p className="mt-1.5 text-micro text-ink-400">
          Answering the context questions removes what does not apply.
        </p>
      </div>

      {definition.limitations && (
        <div className="border-t border-ink-800 pt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-warn-300">
            <IconInfo size={13} aria-hidden="true" />
            What it does not cover
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-ink-400">
            {definition.limitations.map((limitation) => (
              <li key={limitation} className="flex gap-2">
                <span aria-hidden="true">·</span>
                {limitation}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!definition.limitations && (
        <p className="flex items-center gap-1.5 border-t border-ink-800 pt-3 text-xs text-safe-400">
          <IconCheck size={13} aria-hidden="true" />
          Full coverage for this domain — the library was built around it.
        </p>
      )}
    </Card>
  );
}
