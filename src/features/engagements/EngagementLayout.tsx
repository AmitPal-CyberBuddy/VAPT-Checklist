import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Badge, Card, ProgressBar, Select } from '../../ui/primitives';
import { useChecklist, useEngagement, useMetrics } from '../../hooks/useData';
import { repairIntegrity, setEngagementStatus } from '../../persistence/repository';
import { toast } from '../../ui/toast';
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

  if (engagement === undefined) {
    return <Card className="text-sm text-ink-400">Loading engagement…</Card>;
  }
  if (engagement === null) {
    return <Card className="text-sm text-rose-400">Engagement not found in this browser.</Card>;
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
              <span className="text-ink-700">/</span>
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
                tone={metrics.completion === 1 ? 'safe' : 'brand'}
              />
              <p className="mt-1.5 text-[11px] text-ink-500">
                {c.tested + c.na} of {c.applicable} applicable completed
              </p>
            </div>
            <Select
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
          <Badge tone="neutral">{c.notTested} not tested</Badge>
          <Badge tone="safe">{c.notVulnerable} not vulnerable</Badge>
          <Badge tone="vulnerable">{c.vulnerable} vulnerable</Badge>
          <Badge tone="na">{c.na} N/A</Badge>
          <span className="ml-auto text-[11px] text-ink-600">
            {c.excluded} tests excluded from this engagement
          </span>
        </div>
      </div>

      <nav className="flex gap-1 border-b border-ink-800">
        {TABS.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              clsx(
                '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
                isActive
                  ? 'border-brand-500 text-ink-50'
                  : 'border-transparent text-ink-400 hover:text-ink-100',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
