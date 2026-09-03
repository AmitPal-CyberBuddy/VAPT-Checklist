import { useEffect, useState } from 'react';
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
import {
  IconCheck,
  IconChevron,
  IconDownload,
  IconExternal,
  IconList,
  IconTarget,
} from '../../ui/icons';
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

/**
 * A short eased count-up for the headline progress number. Pure presentation —
 * the stored value is never touched. Instant under prefers-reduced-motion so
 * the metric still reads correctly for users who disable animation.
 */
function useCountUp(target: number, duration = 550): number {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !window.matchMedia ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

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
  // Hoisted above the loading early-return so the hook count stays stable
  // between the loading and loaded renders.
  const completionPercent = Math.round(useCountUp(metrics.completion * 100));

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
  const outstandingCount = c.notTested;
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
    <div className="space-y-5">
      {/* 1 — command band: identity + progress ---------------------------- */}
      <section
        aria-labelledby="engagement-info"
        className="cmd-band space-y-5 p-4 sm:p-6"
      >
        <h2 id="engagement-info" className="sr-only">
          Engagement information
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-ink-400">
            <span className="font-mono tracking-wide uppercase">
              {engagement.status} engagement
            </span>
            {engagement.clientName && (
              <>
                <span aria-hidden="true">·</span>
                <span>{engagement.clientName}</span>
              </>
            )}
            {engagement.testerName && (
              <>
                <span aria-hidden="true">·</span>
                <span>{engagement.testerName}</span>
              </>
            )}
          </p>
          {c.vulnerable > 0 ? (
            <Badge tone="vulnerable" glyph="▲">
              {c.vulnerable} vulnerable
            </Badge>
          ) : (
            <Badge tone="safe" glyph="✓">
              No vulnerable tests
            </Badge>
          )}
        </div>

        <div className="grid items-center gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0 space-y-4">
            <p className="text-2xl leading-tight font-semibold tracking-tight text-ink-50">
              {engagement.name}
            </p>
            <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-3">
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
                <dt className="text-micro tracking-wider text-ink-400 uppercase">
                  Application type
                </dt>
                <dd className="mt-0.5 text-sm text-ink-200">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {applicationTypeName(engagement.applicationType)}
                    {supportLevel(engagement.applicationType) === 'limited' && (
                      <Badge tone="warn" glyph="◐" title="Coverage for this domain is limited">
                        Limited
                      </Badge>
                    )}
                  </span>
                  {surfaceLabel(engagement) !==
                    applicationTypeName(engagement.applicationType) && (
                    <span className="mt-0.5 block text-micro text-ink-400">
                      Surfaces: {surfaceLabel(engagement)}
                    </span>
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-micro tracking-wider text-ink-400 uppercase">Targets</dt>
                <dd className="mt-0.5 truncate font-mono text-xs text-ink-300">
                  {engagement.scope.length > 0
                    ? engagement.scope.join(' · ')
                    : engagement.applicationUrl || 'Primary target only'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[--radius-panel] border border-ink-700 bg-ink-950/50 p-4 shadow-[inset_0_1px_0_rgb(141_156_178/0.05)]">
            <div className="flex items-baseline justify-between gap-3">
              <h2
                id="progress-heading"
                className="text-micro font-medium tracking-wider text-ink-400 uppercase"
              >
                Overall progress
              </h2>
              <span
                className={clsx(
                  'metric-hero-value',
                  metrics.completion === 1 ? 'text-safe-400' : 'text-brand-400',
                )}
              >
                {completionPercent}%
              </span>
            </div>
            <ProgressBar
              className="mt-3"
              height="lg"
              label="Overall assessment progress"
              value={metrics.completion}
              tone={metrics.completion === 1 ? 'safe' : 'brand'}
            />
            <p className="mt-2 text-xs tabular-nums text-ink-400">
              <strong className="text-ink-100">{completed}</strong> completed (Tested {c.tested} +{' '}
              N/A {c.na}) of <strong className="text-ink-100">{c.applicable}</strong> applicable
              tests
              {outstandingCount > 0 && (
                <span className="text-warn-300"> · {outstandingCount} still Not Tested</span>
              )}
            </p>
            {/* The one question every tester asks when the checklist closes:
                can this assessment be exported as a report? */}
            <p
              className={clsx(
                'mt-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
                outstandingCount === 0 && c.applicable > 0
                  ? 'border-safe-500/35 bg-safe-500/10 text-safe-400'
                  : 'border-warn-500/30 bg-warn-500/5 text-warn-300',
              )}
            >
              <span aria-hidden="true">
                {c.applicable === 0 ? '—' : outstandingCount === 0 ? '✓' : '◐'}
              </span>
              {c.applicable === 0
                ? 'No applicable tests recorded'
                : outstandingCount === 0
                  ? 'Assessment ready for export'
                  : `${outstandingCount} test${outstandingCount === 1 ? '' : 's'} still need attention`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <LinkButton
                to={`/e/${engagementId}/workspace`}
                variant="primary"
                icon={<IconList size={15} />}
              >
                Open testing workspace
              </LinkButton>
              <LinkButton
                to={`/e/${engagementId}/export`}
                variant="subtle"
                icon={<IconDownload size={15} />}
              >
                Export assessment
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* 2 — the six assessment counts, attention first ------------------- */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Assessment statistics
        </h2>
        {/* Featured row: the three numbers that decide what a tester does
            next get the visual weight; the rest are a compact strip. */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.1fr_1.1fr_1fr]">
          <Stat
            featured
            label="Vulnerable"
            value={c.vulnerable}
            glyph="▲"
            tone={c.vulnerable > 0 ? 'vuln' : 'neutral'}
            hint={c.vulnerable > 0 ? 'needs review' : 'no vulnerable tests recorded'}
          />
          <Stat
            featured
            label="Not Tested"
            value={c.notTested}
            glyph="○"
            tone={c.notTested > 0 ? 'warn' : 'safe'}
            hint={c.notTested > 0 ? 'remaining work' : 'all applicable tested'}
          />
          <Stat
            featured
            label="Total applicable"
            value={c.applicable}
            hint={
              unconfirmed.length > 0
                ? `of which ${unconfirmed.length} unconfirmed · ${c.excluded} excluded`
                : `of ${c.total} in the library, ${c.excluded} excluded`
            }
            tone="brand"
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="Tested" value={c.tested} glyph="●" hint="with a result" />
          <Stat label="N/A" value={c.na} glyph="⊘" hint="out of scope in practice" />
          <Stat label="Not Vulnerable" value={c.notVulnerable} glyph="✓" tone="safe" hint="verified clean" />
        </div>
      </section>

      {c.applicable > 0 && c.notTested === 0 && (
        <InlineAlert
          tone="success"
          icon={<IconCheck size={18} aria-hidden="true" />}
          title="Checklist completed"
          action={
            <LinkButton size="sm" variant="subtle" to={`/e/${engagementId}/export`}>
              Export assessment
            </LinkButton>
          }
        >
          All {c.applicable} applicable tests have a recorded status — {c.tested} tested, {c.na}{' '}
          marked N/A, {c.vulnerable} vulnerable. This records what was assessed; it is not a
          statement that the application is secure.
        </InlineAlert>
      )}

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
          title={
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="text-brand-400">
                ★
              </span>
              High-value tests
            </span>
          }
          description={
            highValue.length > 0
              ? `${highValue.length} outstanding · applicable and Not Tested, ranked by priority, how strongly this application's context points at the test, exploitability and what you have already found.`
              : 'Applicable and Not Tested, ranked by priority, how strongly this application\u2019s context points at the test, exploitability and what you have already found.'
          }
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
            {highValue.map(({ item, rationale, uncertain }, index) => (
              <li key={item.definition.id}>
                <Link
                  to={`/e/${engagementId}/workspace?test=${item.definition.id}`}
                  className={clsx(
                    'group flex h-full items-start gap-3 rounded-[--radius-control] border border-ink-700 bg-ink-850 px-3 py-2 transition-colors duration-150 hover:border-brand-500/50 hover:bg-ink-800',
                    uncertain ? 'rail-warn' : 'rail-brand',
                  )}
                >
                  <span className="mt-0.5 font-mono text-micro text-ink-500 tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </span>
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
                        'mt-1 block truncate font-mono text-micro',
                        uncertain ? 'text-warn-300' : 'text-brand-400',
                      )}
                    >
                      {rationale}
                    </span>
                  </span>
                  <IconChevron
                    size={14}
                    aria-hidden="true"
                    className="row-open mt-0.5 shrink-0 text-ink-600 group-hover:text-brand-400"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 4 — what you found ------------------------------------------------ */}
      <Card
        as="section"
        aria-labelledby="vulnerable-heading"
        className="attn-vuln space-y-3"
      >
        <SectionHeading
          id="vulnerable-heading"
          title={
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="text-vuln-400">
                ▲
              </span>
              Vulnerable tests
            </span>
          }
          description={
            findings.length > 0
              ? `${findings.length} recorded · ${findingsByPriority
                  .map((p) => `${metrics.findingsByPriority[p]} ${p}`)
                  .join(' · ')}`
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
                  className="rail-vuln group flex items-start gap-3 py-2 pl-3 transition-colors duration-150 hover:bg-ink-850/60"
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
                  <IconChevron
                    size={14}
                    aria-hidden="true"
                    className="row-open mt-1 shrink-0 text-ink-600 group-hover:text-vuln-400"
                  />
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
