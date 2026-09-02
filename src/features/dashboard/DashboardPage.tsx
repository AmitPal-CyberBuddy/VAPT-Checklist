import { Link, useParams } from 'react-router-dom';
import { Badge, Card, EmptyState, ProgressBar, SectionHeading, Stat, priorityTone } from '../../ui/primitives';
import { IconAlert, IconCheck, IconTarget } from '../../ui/icons';
import { useChecklist, useEngagement, useMetrics } from '../../hooks/useData';
import { collectFindings, incompleteItems, nextUpQueue } from '../../domain/metrics';
import { contextCompleteness } from '../context/ContextForm';
import { suggestApplicability } from '../../domain/applicability';
import type { Priority } from '../../domain/types';

export default function DashboardPage() {
  const { engagementId } = useParams();
  const engagement = useEngagement(engagementId);
  const items = useChecklist(engagementId);
  const metrics = useMetrics(items);

  if (!items || !engagement) return <Card className="text-sm text-ink-400">Loading…</Card>;

  const c = metrics.counts;
  const findings = collectFindings(items);
  const nextUp = nextUpQueue(items, 8);
  const incomplete = incompleteItems(items);
  const completeness = contextCompleteness(engagement.context);
  const uncertain = items.filter(
    (i) => i.state.applicable && suggestApplicability(i.definition, engagement.context).uncertain,
  );

  return (
    <div className="space-y-5">
      {/* Headline metrics ------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Applicable tests"
          value={c.applicable}
          hint={`${c.excluded} excluded from ${c.total}`}
          tone="brand"
        />
        <Stat
          label="Resolved"
          value={c.na + c.vulnerable + c.notVulnerable}
          hint={`${Math.round(metrics.completion * 100)}% of applicable`}
        />
        <Stat label="Not tested" value={c.notTested} tone={c.notTested > 0 ? 'warn' : 'safe'} />
        <Stat label="Vulnerable" value={c.vulnerable} tone={c.vulnerable > 0 ? 'vuln' : 'neutral'} />
        <Stat
          label="Not vulnerable"
          value={c.notVulnerable}
          tone="safe"
          hint={`${c.na} marked N/A`}
        />
      </div>

      {/* Attention banners ------------------------------------------------ */}
      {(incomplete.length > 0 || completeness.ratio < 0.5 || uncertain.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {incomplete.length > 0 && (
            <Card className="flex items-start gap-3 border-amber-500/30 bg-amber-500/5">
              <IconAlert size={18} className="mt-0.5 shrink-0 text-amber-400" />
              <div className="text-sm">
                <p className="font-medium text-amber-300">
                  {incomplete.length} test{incomplete.length === 1 ? '' : 's'} marked Tested without
                  a result
                </p>
                <p className="mt-1 text-ink-400">
                  A result is required to count as resolved.{' '}
                  <Link
                    to={`/e/${engagementId}/checklist?view=awaiting`}
                    className="text-brand-400 hover:underline"
                  >
                    Record the results →
                  </Link>
                </p>
              </div>
            </Card>
          )}
          {completeness.ratio < 0.5 && (
            <Card className="flex items-start gap-3 border-brand-500/25 bg-brand-500/5">
              <IconTarget size={18} className="mt-0.5 shrink-0 text-brand-400" />
              <div className="text-sm">
                <p className="font-medium text-brand-400">
                  Application context is {Math.round(completeness.ratio * 100)}% complete
                </p>
                <p className="mt-1 text-ink-400">
                  {uncertain.length} tests are included only because facts are unknown.{' '}
                  <Link to={`/e/${engagementId}/context`} className="text-brand-400 hover:underline">
                    Refine the context →
                  </Link>
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Findings ------------------------------------------------------- */}
        <Card className="space-y-3 lg:col-span-2">
          <SectionHeading
            title="Findings"
            description="Applicable tests recorded as Vulnerable, ordered by priority."
            actions={
              findings.length > 0 && (
                <Link
                  to={`/e/${engagementId}/checklist?result=Vulnerable`}
                  className="text-xs text-brand-400 hover:underline"
                >
                  Open in checklist →
                </Link>
              )
            }
          />
          {findings.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-900/40 px-4 py-6 text-sm text-ink-400">
              <IconCheck size={18} className="text-emerald-400" />
              No vulnerabilities recorded yet. Findings appear here as soon as you mark a test
              Tested → Vulnerable.
            </div>
          ) : (
            <ul className="divide-y divide-ink-850">
              {findings.map(({ definition, state }) => (
                <li key={definition.id} className="flex items-start gap-3 py-2.5">
                  <Badge tone={priorityTone(definition.priority)}>{definition.priority}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-100">
                      {definition.vulnerabilityName}
                      <span className="ml-2 font-mono text-[11px] text-ink-600">
                        {definition.id}
                      </span>
                    </p>
                    {state.notes && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-400">{state.notes}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Priority progress ---------------------------------------------- */}
        <Card className="space-y-4">
          <SectionHeading title="Progress by priority" />
          {metrics.byPriority.map((group) => (
            <div key={group.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <Badge tone={priorityTone(group.key as Priority)}>{group.label}</Badge>
                  {metrics.findingsByPriority[group.key as Priority] > 0 && (
                    <span className="text-rose-400">
                      {metrics.findingsByPriority[group.key as Priority]} vulnerable
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-ink-400">
                  {group.counts.na + group.counts.vulnerable + group.counts.notVulnerable}/
                  {group.counts.applicable}
                </span>
              </div>
              <ProgressBar
                value={group.completion}
                height="sm"
                tone={group.completion === 1 ? 'safe' : 'brand'}
              />
            </div>
          ))}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Next up -------------------------------------------------------- */}
        <Card className="space-y-3">
          <SectionHeading
            title="Next up"
            description="Highest-priority applicable tests that have not been performed."
          />
          {nextUp.length === 0 ? (
            <EmptyState title="Nothing outstanding" description="Every applicable test has a recorded outcome." />
          ) : (
            <ul className="space-y-1.5">
              {nextUp.map(({ definition }) => (
                <li key={definition.id}>
                  <Link
                    to={`/e/${engagementId}/checklist?test=${definition.id}`}
                    className="flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2 transition-colors hover:border-ink-600"
                  >
                    <Badge tone={priorityTone(definition.priority)}>{definition.priority}</Badge>
                    <span className="flex-1 truncate text-sm text-ink-100">
                      {definition.vulnerabilityName}
                    </span>
                    <span className="font-mono text-[11px] text-ink-600">{definition.id}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Coverage by category ------------------------------------------- */}
        <Card className="space-y-3">
          <SectionHeading title="Coverage by category" />
          <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
            {metrics.byCategory
              .filter((g) => g.counts.applicable > 0)
              .map((group) => (
                <div key={group.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink-200">{group.label}</span>
                    <span className="flex items-center gap-2 tabular-nums text-ink-500">
                      {group.counts.vulnerable > 0 && (
                        <span className="text-rose-400">{group.counts.vulnerable} vuln</span>
                      )}
                      {group.counts.na + group.counts.vulnerable + group.counts.notVulnerable}/
                      {group.counts.applicable}
                    </span>
                  </div>
                  <ProgressBar
                    value={group.completion}
                    height="sm"
                    tone={group.counts.vulnerable > 0 ? 'vuln' : group.completion === 1 ? 'safe' : 'brand'}
                  />
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
