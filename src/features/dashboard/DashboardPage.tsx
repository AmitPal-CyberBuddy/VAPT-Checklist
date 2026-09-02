import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  Badge,
  Card,
  ProgressBar,
  SectionHeading,
  Stat,
  priorityTone,
} from '../../ui/primitives';
import { IconAlert, IconCheck, IconExternal, IconTarget } from '../../ui/icons';
import { useChecklist, useEngagement, useMetrics } from '../../hooks/useData';
import { collectFindings, highValueTests, incompleteItems } from '../../domain/metrics';
import { contextCompleteness } from '../context/ContextForm';
import { FACT_BY_KEY } from '../../domain/context';
import { suggestApplicability } from '../../domain/applicability';
import type { Priority } from '../../domain/types';

function applicationTypeLabel(values: string[] | undefined): string {
  if (!values || values.length === 0) return 'Not recorded';
  const options = FACT_BY_KEY.assetTypes.options ?? [];
  return values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(' · ');
}

export default function DashboardPage() {
  const { engagementId } = useParams();
  const engagement = useEngagement(engagementId);
  const items = useChecklist(engagementId);
  const metrics = useMetrics(items);

  if (!items || !engagement) return <Card className="text-sm text-ink-400">Loading…</Card>;

  const c = metrics.counts;
  const completed = c.tested + c.na;
  const findings = collectFindings(items);
  const highValue = highValueTests(items, engagement.context, 6);
  const incomplete = incompleteItems(items);
  const completeness = contextCompleteness(engagement.context);
  const uncertain = items.filter(
    (i) => i.state.applicable && suggestApplicability(i.definition, engagement.context).uncertain,
  );

  return (
    <div className="space-y-5">
      {/* Engagement information ------------------------------------------- */}
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <Card className="space-y-3">
          <SectionHeading title="Engagement" />
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] tracking-wider text-ink-500 uppercase">Name</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink-50">{engagement.name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] tracking-wider text-ink-500 uppercase">Application URL</dt>
              <dd className="mt-0.5 truncate font-mono text-xs text-ink-200">
                {engagement.applicationUrl ? (
                  <a
                    href={engagement.applicationUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 hover:text-brand-400"
                  >
                    {engagement.applicationUrl}
                    <IconExternal size={11} />
                  </a>
                ) : (
                  <span className="text-ink-600">Not recorded</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wider text-ink-500 uppercase">
                Application type
              </dt>
              <dd className="mt-0.5 text-sm text-ink-200">
                {applicationTypeLabel(engagement.context.assetTypes as string[] | undefined)}
              </dd>
            </div>
          </dl>
          {(engagement.clientName || engagement.testerName || engagement.scope.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-800 pt-3 text-[11px] text-ink-500">
              {engagement.clientName && <span>Client: {engagement.clientName}</span>}
              {engagement.testerName && <span>Tester: {engagement.testerName}</span>}
              {engagement.scope.length > 0 && (
                <span className="truncate font-mono">Also in scope: {engagement.scope.join(' · ')}</span>
              )}
            </div>
          )}
        </Card>

        <Card className="flex flex-col justify-center">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] tracking-wider text-ink-400 uppercase">
              Overall progress
            </span>
            <span className="text-2xl font-semibold tabular-nums text-ink-50">
              {Math.round(metrics.completion * 100)}%
            </span>
          </div>
          <ProgressBar
            className="mt-2"
            value={metrics.completion}
            tone={metrics.completion === 1 ? 'safe' : 'brand'}
          />
          <p className="mt-2 text-xs text-ink-500">
            Completed <strong className="text-ink-300">{completed}</strong> (Tested {c.tested} + N/A{' '}
            {c.na}) of <strong className="text-ink-300">{c.applicable}</strong> applicable tests
          </p>
        </Card>
      </div>

      {/* Assessment statistics -------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Total applicable"
          value={c.applicable}
          hint={`${c.excluded} excluded of ${c.total}`}
          tone="brand"
        />
        <Stat label="Tested" value={c.tested} />
        <Stat label="Not tested" value={c.notTested} tone={c.notTested > 0 ? 'warn' : 'safe'} />
        <Stat label="N/A" value={c.na} />
        <Stat label="Vulnerable" value={c.vulnerable} tone={c.vulnerable > 0 ? 'vuln' : 'neutral'} />
        <Stat label="Not vulnerable" value={c.notVulnerable} tone="safe" />
      </div>

      {/* Attention banners ------------------------------------------------ */}
      {(incomplete.length > 0 || completeness.ratio < 0.5) && (
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
                  Record Vulnerable / Not Vulnerable so the finding count is accurate.{' '}
                  <Link
                    to={`/e/${engagementId}/workspace?view=awaiting`}
                    className="text-brand-400 hover:underline"
                  >
                    Open them →
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

      {/* High-value tests -------------------------------------------------- */}
      <Card className="space-y-3 border-brand-500/25">
        <SectionHeading
          title="High-value tests"
          description="Ranked by priority, how strongly this application's context points at the test, exploitability and what you have already found — not by severity alone."
          actions={
            <Link
              to={`/e/${engagementId}/workspace?status=Not+Tested`}
              className="text-xs text-brand-400 hover:underline"
            >
              Open workspace →
            </Link>
          }
        />
        {highValue.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-900/40 px-4 py-6 text-sm text-ink-400">
            <IconCheck size={18} className="text-emerald-400" />
            Nothing outstanding — every applicable test has a status.
          </div>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {highValue.map(({ item, rationale, uncertain: isUncertain }) => (
              <li key={item.definition.id}>
                <Link
                  to={`/e/${engagementId}/workspace?test=${item.definition.id}`}
                  className="flex h-full items-start gap-3 rounded-lg border border-ink-700 bg-ink-900/50 px-3 py-2.5 transition-colors hover:border-brand-500/50 hover:bg-ink-800/60"
                >
                  <Badge tone={priorityTone(item.definition.priority)}>
                    {item.definition.priority}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-100">
                      {item.definition.vulnerabilityName}
                    </span>
                    <span
                      className={clsx(
                        'mt-0.5 block truncate text-[11px]',
                        isUncertain ? 'text-amber-500/90' : 'text-brand-400/90',
                      )}
                    >
                      {rationale}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-600">Not Tested</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Findings ------------------------------------------------------- */}
        <Card className="space-y-3 lg:col-span-2">
          <SectionHeading
            title="Findings"
            description="Applicable tests recorded as Vulnerable, ordered by priority."
            actions={
              findings.length > 0 && (
                <Link
                  to={`/e/${engagementId}/workspace?result=Vulnerable`}
                  className="text-xs text-brand-400 hover:underline"
                >
                  Open in workspace →
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
                <li key={definition.id}>
                  <Link
                    to={`/e/${engagementId}/workspace?test=${definition.id}`}
                    className="flex items-start gap-3 py-2.5 hover:opacity-90"
                  >
                    <Badge tone={priorityTone(definition.priority)}>{definition.priority}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink-100">
                        {definition.vulnerabilityName}
                        <span className="ml-2 font-mono text-[11px] text-ink-600">
                          {definition.id}
                        </span>
                      </span>
                      {state.notes && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-ink-400">
                          {state.notes}
                        </span>
                      )}
                    </span>
                  </Link>
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
                  {group.counts.tested + group.counts.na}/{group.counts.applicable}
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

      {/* Coverage by category ---------------------------------------------- */}
      <Card className="space-y-3">
        <SectionHeading title="Coverage by category" />
        <div className="grid gap-x-6 gap-y-2.5 md:grid-cols-2 xl:grid-cols-3">
          {metrics.byCategory
            .filter((g) => g.counts.applicable > 0)
            .map((group) => (
              <div key={group.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <Link
                    to={`/e/${engagementId}/workspace?category=${group.key}`}
                    className="text-ink-200 hover:text-brand-400"
                  >
                    {group.label}
                  </Link>
                  <span className="flex items-center gap-2 tabular-nums text-ink-500">
                    {group.counts.vulnerable > 0 && (
                      <span className="text-rose-400">{group.counts.vulnerable} vuln</span>
                    )}
                    {group.counts.tested + group.counts.na}/{group.counts.applicable}
                  </span>
                </div>
                <ProgressBar
                  value={group.completion}
                  height="sm"
                  tone={
                    group.counts.vulnerable > 0 ? 'vuln' : group.completion === 1 ? 'safe' : 'brand'
                  }
                />
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
