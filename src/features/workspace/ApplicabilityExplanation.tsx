import clsx from 'clsx';
import { Badge } from '../../ui/primitives';
import type { ApplicabilityCondition, ApplicabilitySuggestion } from '../../domain/applicability';

/**
 * Renders *why* a test is in (or out of) scope.
 *
 *   Applicable because:
 *     ✓ API available            REST API
 *     ✓ Multiple user roles      Yes
 *     ? Users own records        Not recorded
 *
 * Applicability must never be a black box — the tester needs to see the
 * reasoning to decide whether to trust or override it.
 */

const MARK: Record<
  ApplicabilityCondition['outcome'],
  { glyph: string; chip: string }
> = {
  met: {
    glyph: '✓',
    chip: 'border-safe-500/40 bg-safe-500/10 text-safe-400',
  },
  unmet: {
    glyph: '✕',
    chip: 'border-ink-600 bg-ink-850 text-ink-500',
  },
  unknown: {
    glyph: '?',
    chip: 'border-warn-500/40 bg-warn-500/10 text-warn-300',
  },
};

export function ApplicabilityExplanation({
  suggestion,
  compact = false,
  className,
}: {
  suggestion: ApplicabilitySuggestion;
  compact?: boolean;
  className?: string;
}) {
  const { conditions, applicable, uncertain } = suggestion;

  const heading = uncertain
    ? 'Kept in scope — context incomplete'
    : applicable
      ? 'Applicable because'
      : 'Not applicable because';

  return (
    <div className={clsx('text-xs', className)}>
      <p
        className={clsx(
          'mb-1.5 font-medium',
          uncertain ? 'text-warn-400' : applicable ? 'text-safe-400' : 'text-ink-400',
        )}
      >
        {conditions.length === 0 ? suggestion.summary : `${heading}:`}
      </p>
      {conditions.length > 0 && (
        <ul className="space-y-1">
          {conditions.map((condition, index) => {
            const mark = MARK[condition.outcome];
            return (
              <li key={`${condition.label}-${index}`} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={clsx(
                    'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border font-mono text-micro leading-none',
                    mark.chip,
                  )}
                >
                  {mark.glyph}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-200">{condition.label}</span>
                {!compact && (
                  <span className="shrink-0 font-mono text-micro text-ink-500">
                    {condition.detail}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Compact inline badge for list rows. */
export function ApplicabilityBadge({ suggestion }: { suggestion: ApplicabilitySuggestion }) {
  if (suggestion.uncertain) {
    return (
      <Badge tone="warn" title={suggestion.reasons.join(' · ')}>
        Unconfirmed
      </Badge>
    );
  }
  return null;
}
