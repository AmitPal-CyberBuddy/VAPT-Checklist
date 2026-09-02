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

const MARK: Record<ApplicabilityCondition['outcome'], { glyph: string; cls: string }> = {
  met: { glyph: '✓', cls: 'text-safe-400' },
  unmet: { glyph: '✕', cls: 'text-ink-500' },
  unknown: { glyph: '?', cls: 'text-amber-400' },
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
          'mb-1 font-medium',
          uncertain ? 'text-amber-400' : applicable ? 'text-safe-400' : 'text-ink-400',
        )}
      >
        {conditions.length === 0 ? suggestion.summary : `${heading}:`}
      </p>
      {conditions.length > 0 && (
        <ul className={clsx('space-y-0.5', compact && 'space-y-0')}>
          {conditions.map((condition, index) => {
            const mark = MARK[condition.outcome];
            return (
              <li key={`${condition.label}-${index}`} className="flex items-baseline gap-2">
                <span className={clsx('w-3 shrink-0 font-mono', mark.cls)}>{mark.glyph}</span>
                <span className="text-ink-200">{condition.label}</span>
                {!compact && (
                  <span className="truncate text-ink-500">— {condition.detail}</span>
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
