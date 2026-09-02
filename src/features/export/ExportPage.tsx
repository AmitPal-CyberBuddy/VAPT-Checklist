import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, Card, SectionHeading, Stat, Toggle } from '../../ui/primitives';
import { IconAlert, IconDownload } from '../../ui/icons';
import { useChecklist, useEngagement, useMetrics } from '../../hooks/useData';
import { buildFileName } from '../../export/fileName';
import { exportBackup } from '../../persistence/repository';
import { completedOf } from '../../domain/metrics';
import { toast } from '../../ui/toast';

const SHEETS = [
  {
    key: 'summary',
    name: 'Engagement Summary',
    description:
      'Name, application URL and type, created/export dates, the six assessment statistics, overall progress and the full application context.',
    fixed: true,
  },
  {
    key: 'assessment',
    name: 'Assessment',
    description:
      'Every applicable test: ID, vulnerability, category, subcategory, priority, status, result and notes — plus description, guidance and standards mapping.',
    fixed: true,
  },
  {
    key: 'vulnerable',
    name: 'Vulnerable Tests',
    description: 'Only Status = Tested and Result = Vulnerable, ordered Critical → Low.',
    fixed: true,
  },
  {
    key: 'notApplicable',
    name: 'Not Applicable',
    description:
      'Excluded tests with the rule and reason — the audit trail for every scope decision.',
  },
  {
    key: 'coverage',
    name: 'Coverage',
    description: 'Per-category counts and progress, with a total row.',
  },
];

export default function ExportPage() {
  const { engagementId = '' } = useParams();
  const engagement = useEngagement(engagementId);
  const items = useChecklist(engagementId);
  const metrics = useMetrics(items);

  const [includeNotApplicable, setIncludeNotApplicable] = useState(true);
  const [includeCoverage, setIncludeCoverage] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!engagement || !items) return <Card className="text-sm text-ink-400">Loading…</Card>;

  const notTested = metrics.counts.notTested;

  async function handleExcel() {
    if (!engagement || !items) return;
    setBusy(true);
    try {
      // Lazy-loaded: the XLSX writer is only fetched when an export is requested.
      const { exportEngagementToExcel } = await import('../../export/excel');
      const fileName = await exportEngagementToExcel(engagement, items, {
        includeNotApplicable,
        includeCoverage,
      });
      toast.success('Workbook downloaded', fileName);
    } catch (error) {
      toast.error('Excel export failed', String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleBackup() {
    if (!engagement) return;
    try {
      const backup = await exportBackup(engagement.id);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildFileName(engagement, 'json');
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Engagement JSON downloaded', 'Restore it from Data & Settings → Import.');
    } catch (error) {
      toast.error('Backup failed', String(error));
    }
  }

  const toggles = [
    { key: 'notApplicable', value: includeNotApplicable, set: setIncludeNotApplicable },
    { key: 'coverage', value: includeCoverage, set: setIncludeCoverage },
  ] as const;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card className="space-y-4">
          <SectionHeading
            title="Excel export"
            description="Generated in your browser from the same data the dashboard shows. Nothing is uploaded."
          />

          <div className="space-y-2">
            {SHEETS.map((sheet) => {
              const toggle = toggles.find((t) => t.key === sheet.key);
              return (
                <div
                  key={sheet.key}
                  className="flex items-start justify-between gap-4 rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm text-ink-100">
                      {sheet.name}
                      {sheet.fixed && <Badge tone="neutral">Always included</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">{sheet.description}</p>
                  </div>
                  {toggle && <Toggle checked={toggle.value} onChange={toggle.set} />}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-4">
            <div>
              <p className="font-mono text-xs text-ink-400">{buildFileName(engagement)}</p>
              <p className="mt-0.5 text-[11px] text-ink-600">
                Frozen headers, filter dropdowns, tuned column widths, colour-coded priority and
                result cells.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              icon={<IconDownload size={16} />}
              onClick={() => void handleExcel()}
            >
              {busy ? 'Generating…' : 'Download Excel'}
            </Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <SectionHeading
            title="Engagement JSON backup"
            description="A complete, re-importable copy of this engagement: context, applicability overrides, statuses, results and notes. Engagement data lives only in this browser — take a backup before clearing site data or moving machines."
            actions={
              <Button
                variant="subtle"
                icon={<IconDownload size={15} />}
                onClick={() => void handleBackup()}
              >
                Export Engagement JSON
              </Button>
            }
          />
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="space-y-3">
          <SectionHeading title="What will be exported" />
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Applicable" value={metrics.counts.applicable} />
            <Stat label="Excluded" value={metrics.counts.excluded} />
            <Stat
              label="Vulnerable"
              value={metrics.counts.vulnerable}
              tone={metrics.counts.vulnerable ? 'vuln' : 'neutral'}
            />
            <Stat
              label="Progress"
              value={`${Math.round(metrics.completion * 100)}%`}
              tone="brand"
              hint={`${completedOf(metrics.counts)} completed`}
            />
          </div>
        </Card>

        {notTested > 0 && (
          <Card className="space-y-2 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-2">
              <IconAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
              <div className="text-sm">
                <p className="font-medium text-amber-300">Assessment is not complete</p>
                <p className="mt-1 text-xs text-ink-300">
                  {notTested} applicable test{notTested === 1 ? '' : 's'} still Not Tested. They are
                  exported with an empty status so the gap is visible in the report.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card className="space-y-2 text-xs text-ink-400">
          <p className="text-sm font-medium text-ink-100">Export notes</p>
          <p>Produced locally with a bundled XLSX writer — no server, no network request.</p>
          <p>
            Every number in the workbook comes from the same calculation the dashboard uses, so the
            two can never disagree.
          </p>
        </Card>
      </div>
    </div>
  );
}
