import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  Badge,
  Card,
  EmptyState,
  InlineAlert,
  LinkButton,
  LoadingPanel,
  PriorityBadge,
  ProgressBar,
  SectionHeading,
  Stat,
} from '../../ui/primitives';
import { IconCheck, IconExternal, IconList, IconTarget } from '../../ui/icons';
import { useChecklist, useEngagement, useMetrics } from '../../hooks/useData';
import { collectFindings, highValueTests } from '../../domain/metrics';
import { contextCompleteness } from '../context/ContextForm';
import { effectiveAssetTypes, effectiveContext, FACT_BY_KEY } from '../../domain/context';
import { suggestApplicability } from '../../domain/applicability';
import { safeExternalUrl } from '../../domain/untrusted';
import type { Priority } from '../../domain/types';
import {
  applicationTypeLabel as applicationTypeName,
  type ApplicationTypeId,
} from '../../domain/applicationType';
import { supportLevel } from '../../data/typeCoverage';

function surfaceLabel(engagement: { applicationType: ApplicationTypeId; context: object }): string {
  const options = FACT_BY_KEY.assetTypes.options ?? [];
  const surfaces = effectiveAssetTypes(engagement.applicationType, engagement.context as never);
  return surfaces.map((v) => options.find((o) => o.value === v)?.label ?? v).join(' · ');
}

/**
 * Engagement dashboard. Five things, each with a job:
 *   identity · progress · the six counts · what to test next · what you found
 * Category coverage closes it out because it answers "where is the work left".
 * Nothing decorative.
 */
export default function DashboardPage() {
  const { engagementId } = useParams();
  const engagement = useEngagement(engagementId);
  const items = useChecklist(engagementId);
  const metrics = useMetrics(items);

  if (!items || !engagement) {
    return (
      <div className="space-y-4">
        <LoadingPanel rows={3} label="Loading engagement" />
        <LoadingPanel rows={5} label="Loading assessment statistics" />
      </div>
    );
  }

  const c = metrics.counts;
  const completed = c.tested + c.na;
  const findings = collectFindings(items);
  const resolved = effectiveContext(engagement);
  const highValue = highValueTests(items, resolved, 6);
  const completeness = contextCompleteness(engagement.context, engagement.applicationType);
  const unconfirmed = items.filter(
    (i) => i.state.applicable && suggestApplicability(i.definition, resolved).uncertain,
  );
  const safeUrl = safeExternalUrl(engagement.applicationUrl);
  const findingsByPriority = (['Critical', 'High', 'Medium', 'Low'] as Priority[]).filter(
    (p) => metrics.findingsByPriority[p] > 0,
  );

  return (
    <div className="space-y-4">
      {/* 1 — identity and progress ---------------------------------------- */}
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <Card as="section" aria-labelledby="engagement-info" className="space-y-3">
          <h2 id="engagement-info" className="sr-only">
            Engagement information
          </h2>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-micro tracking-wider text-ink-400 uppercase">Engagement</dt>
              <dd className="mt-0.5 truncate text-sm font-medium text-ink-50">{engagement.name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-micro tracking-wider text-ink-400 uppercase">Application URL</dt>
              <dd className="mt-0.5 truncate font-mono text-xs text-ink-200">
                {!engagement.applicationUrl ? (
                  <span className="text-ink-400">Not recorded</span>
                ) : safeUrl ? (
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex max-w-full items-center gap-1 truncate hover:text-brand-400"
                  >
                    {engagement.applicationUrl}
                    <IconExternal size={11} aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  // Unsupported scheme (javascript:, data:…) — shown, never linked.
                  <span className="break-all" title="Not a linkable http(s) URL">
                    {engagement.applicationUrl}
                  </span>
                )}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-micro tracking-wider text-ink-400 uppercase">Application type</dt>
              <dd className="mt-0.5 text-sm text-ink-200">
                <span className="flex flex-wrap items-center gap-1.5">
                  {applicationTypeName(engagement.applicationType)}
                  {supportLevel(engagement.applicationType) === 'limited' && (
                    <Badge tone="warn" glyph="◐" title="Coverage for this domain is limited">
                      Limited
                    </Badge>
                  )}
                </span>
                {surfaceLabel(engagement) !== applicationTypeName(engagement.applicationType) && (
                  <span className="mt-0.5 block text-micro text-ink-400">
                    Surfaces: {surfaceLabel(engagement)}
                  </span>
                )}
              </dd>
            </div>
          </dl>
          {(engagement.clientName || engagement.testerName || engagement.scope.length > 0) && (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-800 pt-3 text-micro text-ink-400">
              {engagement.clientName && <span>Client: {engagement.clientName}</span>}
              {engagement.testerName && <span>Tester: {engagement.testerName}</span>}
              {engagement.scope.length > 0 && (
                <span className="min-w-0 truncate font-mono">
                  Also in scope: {engagement.scope.join(' · ')}
                </span>
              )}
            </p>
          )}
        </Card>

        <Card as="section" aria-labelledby="progress-heading" className="flex flex-col justify-center">
          <div className="flex items-baseline justify-between">
            <h2
              id="progress-heading"
              className="text-micro font-medium tracking-wider text-ink-400 uppercase"
            >
              Overall progress
            </h2>
            <span className="text-2xl font-semibold tabular-nums text-ink-50">
              {Math.round(metrics.completion * 100)}%
            </span>
          </div>
          <ProgressBar
            className="mt-2"
            label="Overall assessment progress"
            value={metrics.completion}
            tone={metrics.completion === 1 ? 'safe' : 'brand'}
          />
          <p className="mt-2 text-xs text-ink-400">
            <strong className="text-ink-200">{completed}</strong> completed (Tested {c.tested} + N/A{' '}
            {c.na}) of <strong className="text-ink-200">{c.applicable}</strong> applicable tests
          </p>
          <LinkButton
            to={`/e/${engagementId}/workspace`}
            variant="primary"
            full
            className="mt-3"
            icon={<IconList size={15} />}
          >
            Open testing workspace
          </LinkButton>
        </Card>
      </div>

      {/* 2 — the six assessment counts ------------------------------------ */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Assessment statistics
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <Stat
            label="Total applicable"
            value={c.applicable}
            hint={
              unconfirmed.length > 0
                ? `${c.excluded} Not Applicable · ${unconfirmed.length} unconfirmed`
                : `${c.excluded} Not Applicable`
            }
            tone="brand"
          />
          <Stat label="Tested" value={c.tested} glyph="●" />
          <Stat
            label="Not Tested"
            value={c.notTested}
            glyph="○"
            tone={c.notTested > 0 ? 'warn' : 'safe'}
          />
          <Stat label="N/A" value={c.na} glyph="⊘" />
          <Stat
            label="Vulnerable"
            value={c.vulnerable}
            glyph="▲"
            tone={c.vulnerable > 0 ? 'vuln' : 'neutral'}
          />
          <Stat label="Not Vulnerable" value={c.notVulnerable} glyph="✓" tone="safe" />
        </div>
      </section>

      {completeness.ratio < 0.5 && (
        <InlineAlert
          tone="info"
          icon={<IconTarget size={18} aria-hidden="true" />}
          title={`Application context is ${Math.round(completeness.ratio * 100)}% complete`}
          action={
            <Link
              to={`/e/${engagementId}/context`}
              className="rounded text-xs font-medium text-brand-400 hover:underline"
            >
              Refine context →
            </Link>
          }
        >
          {unconfirmed.length} tests are applicable only because facts are unknown. Answering more
          questions narrows the list without losing coverage.
        </InlineAlert>
      )}

      {/* 3 — what to test next -------------------------------------------- */}
      <Card as="section" aria-labelledby="high-value-heading" className="space-y-3">
        <SectionHeading
          id="high-value-heading"
          title="High-value tests"
          description="Applicable and Not Tested, ranked by priority, how strongly this application's context points at the test, exploitability and what you have already found."
          actions={
            <Link
              to={`/e/${engagementId}/workspace?status=Not+Tested`}
              className="rounded text-xs text-brand-400 hover:underline"
            >
              See all Not Tested →
            </Link>
          }
        />
        {highValue.length === 0 ? (
          <EmptyState
            compact
            icon={<IconCheck size={24} />}
            title="Nothing outstanding"
            description="Every applicable test has a status. Review the vulnerable tests below, or export the assessment."
          />
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {highValue.map(({ item, rationale, uncertain }) => (
              <li key={item.definition.id}>
                <Link
                  to={`/e/${engagementId}/workspace?test=${item.definition.id}`}
                  className="flex h-full items-start gap-3 rounded-[--radius-control] border border-ink-700 bg-ink-850 px-3 py-2 transition-colors hover:border-brand-500/50 hover:bg-ink-800"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-100">
                      {item.definition.vulnerabilityName}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <PriorityBadge priority={item.definition.priority} />
                      <Badge tone="neutral" glyph="○">
                        Not Tested
                      </Badge>
                    </span>
                    <span
                      className={clsx(
                        'mt-1 block truncate text-micro',
                        uncertain ? 'text-amber-300' : 'text-brand-400',
                      )}
                    >
                      {rationale}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 4 — what you found ------------------------------------------------ */}
      <Card as="section" aria-labelledby="vulnerable-heading" className="space-y-3">
        <SectionHeading
          id="vulnerable-heading"
          title="Vulnerable tests"
          description={
            findings.length > 0
              ? findingsByPriority
                  .map((p) => `${metrics.findingsByPriority[p]} ${p}`)
                  .join(' · ')
              : undefined
          }
          actions={
            findings.length > 0 && (
              <Link
                to={`/e/${engagementId}/workspace?result=Vulnerable`}
                className="rounded text-xs text-brand-400 hover:underline"
              >
                Open in workspace →
              </Link>
            )
          }
        />
        {findings.length === 0 ? (
          <EmptyState
            compact
            icon={<IconCheck size={24} />}
            title="No vulnerable tests recorded"
            description="A test appears here as soon as you record Tested → Vulnerable."
          />
        ) : (
          <ul className="divide-y divide-ink-800">
            {findings.map(({ definition, state }) => (
              <li key={definition.id}>
                <Link
                  to={`/e/${engagementId}/workspace?test=${definition.id}`}
                  className="flex items-start gap-3 py-2 transition-opacity hover:opacity-80"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink-100">
                      {definition.vulnerabilityName}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-micro text-ink-400">
                      <PriorityBadge priority={definition.priority} />
                      <Badge tone="vulnerable" glyph="▲">
                        Vulnerable
                      </Badge>
                      <span className="font-mono">{definition.id}</span>
                    </span>
                    {state.notes && (
                      <span className="mt-1 line-clamp-2 block text-xs break-words text-ink-400">
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

      {/* 5 — where the remaining work is ----------------------------------- */}
      <Card as="section" aria-labelledby="coverage-heading" className="space-y-3">
        <SectionHeading
          id="coverage-heading"
          title="Coverage by category"
          description="Completed of applicable, per category."
        />
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.byCategory
            .filter((g) => g.counts.applicable > 0)
            .map((group) => (
              <div key={group.key}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <Link
                    to={`/e/${engagementId}/workspace?category=${group.key}`}
                    className="truncate rounded text-ink-200 hover:text-brand-400"
                  >
                    {group.label}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums text-ink-400">
                    {group.counts.vulnerable > 0 && (
                      <span className="text-vuln-400">▲ {group.counts.vulnerable}</span>
                    )}
                    {group.counts.tested + group.counts.na}/{group.counts.applicable}
                  </span>
                </div>
                <ProgressBar
                  value={group.completion}
                  height="sm"
                  label={`${group.label} progress`}
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
