import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Badge, LoadingPanel, ProgressBar, Select } from '../../ui/primitives';
import { useChecklist, useEngagement, useMetrics } from '../../hooks/useData';
import { repairIntegrity, setEngagementStatus } from '../../persistence/repository';
import { toast } from '../../ui/toast';
import { EmptyState } from '../../ui/primitives';
import { IconAlert } from '../../ui/icons';
import { FACT_BY_KEY } from '../../domain/context';
import type { EngagementStatus } from '../../domain/types';

const TABS = [
  { to: '', label: 'Dashboard', end: true },
  { to: 'workspace', label: 'Testing Workspace', end: false },
  { to: 'context', label: 'Application Context', end: false },
  { to: 'export', label: 'Export', end: false },
];

export default function EngagementLayout() {
  const { engagementId } = useParams();
  const engagement = useEngagement(engagementId);
  const items = useChecklist(engagementId);
  const metrics = useMetrics(items);
  const repaired = useRef<string | null>(null);

  // A database written by an older build could hold `Tested` rows with no
  // result. Repair them once per engagement so the stored data always
  // satisfies the invariants the app now guarantees.
  useEffect(() => {
    if (!engagementId || repaired.current === engagementId) return;
    repaired.current = engagementId;
    void repairIntegrity(engagementId).then((count) => {
      if (count > 0) {
        toast.info(
          `${count} incomplete record${count === 1 ? '' : 's'} reset`,
          'They were marked Tested without a result and are now Not Tested.',
        );
      }
    });
  }, [engagementId]);

  if (engagement === undefined) return <LoadingPanel rows={4} label="Loading engagement" />;
  if (engagement === null) {
    return (
      <EmptyState
        icon={<IconAlert size={28} />}
        title="Engagement not found"
        description="It is not in this browser's local database. Engagements are stored per browser — if it was created elsewhere, import its JSON backup from Data & Settings."
        action={
          <NavLink
            to="/"
            className="inline-flex h-9 items-center rounded-[--radius-control] border border-ink-600 bg-ink-800 px-3.5 text-sm text-ink-100 hover:bg-ink-700"
          >
            Back to engagements
          </NavLink>
        }
      />
    );
  }

  const c = metrics.counts;
  const typeOptions = FACT_BY_KEY.assetTypes.options ?? [];
  const applicationType = ((engagement.context.assetTypes as string[] | undefined) ?? [])
    .map((v) => typeOptions.find((o) => o.value === v)?.label ?? v)
    .join(' · ');

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <NavLink to="/" className="text-xs text-ink-500 hover:text-ink-300">
                Engagements
              </NavLink>
              <span className="text-ink-500">/</span>
              <span className="text-xs text-ink-400">{engagement.clientName || 'Untitled client'}</span>
            </div>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-ink-50">
              {engagement.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
              {engagement.applicationUrl && (
                <a
                  href={engagement.applicationUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-mono text-brand-400/90 hover:text-brand-400"
                >
                  {engagement.applicationUrl}
                </a>
              )}
              {applicationType && <span>{applicationType}</span>}
              {engagement.scope.length > 0 && (
                <span className="truncate font-mono">{engagement.scope.join(' · ')}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[11px] tracking-wider text-ink-400 uppercase">Completion</p>
              <p className="text-xl font-semibold tabular-nums text-ink-50">
                {Math.round(metrics.completion * 100)}%
              </p>
            </div>
            <div className="w-44">
              <ProgressBar
                value={metrics.completion}
                label="Engagement progress"
                tone={metrics.completion === 1 ? 'safe' : 'brand'}
              />
              <p className="mt-1.5 text-[11px] text-ink-400">
                {c.tested + c.na} of {c.applicable} applicable completed
              </p>
            </div>
            <Select
              aria-label="Engagement status"
              value={engagement.status}
              onChange={(e) =>
                void setEngagementStatus(engagement.id, e.target.value as EngagementStatus)
              }
              className="w-36"
            >
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Archived">Archived</option>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-800 pt-4">
          <Badge tone="brand">{c.applicable} applicable</Badge>
          <Badge tone="neutral" glyph="○">
            {c.notTested} Not Tested
          </Badge>
          <Badge tone="brand" glyph="●">
            {c.tested} Tested
          </Badge>
          <Badge tone="na" glyph="⊘">
            {c.na} N/A
          </Badge>
          <Badge tone="vulnerable" glyph="▲">
            {c.vulnerable} Vulnerable
          </Badge>
          <Badge tone="safe" glyph="✓">
            {c.notVulnerable} Not Vulnerable
          </Badge>
          <span className="ml-auto text-[11px] text-ink-400">
            {c.excluded} Not Applicable
          </span>
        </div>
      </div>

      <nav aria-label="Engagement sections" className="flex gap-1 overflow-x-auto border-b border-ink-800">
        {TABS.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              clsx(
                '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors sm:px-4',
                isActive
                  ? 'border-brand-500 font-medium text-ink-50'
                  : 'border-transparent text-ink-300 hover:text-ink-100',
              )
            }
            aria-current={undefined}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
