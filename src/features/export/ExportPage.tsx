import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, Card, SectionHeading, Stat, Toggle } from '../../ui/primitives';
import { IconAlert, IconDownload } from '../../ui/icons';
import { useChecklist, useEngagement, useMetrics } from '../../hooks/useData';
import { buildFileName } from '../../export/fileName';
import { exportBackup } from '../../persistence/repository';
import { incompleteItems } from '../../domain/metrics';
import { toast } from '../../ui/toast';

const SHEETS = [
  { key: 'summary', name: 'Summary', description: 'Engagement identity, coverage metrics and a findings overview.', fixed: true },
  { key: 'checklist', name: 'Checklist', description: 'Every applicable test with status, result, notes, description and guidance.', fixed: true },
  { key: 'findings', name: 'Findings', description: 'Vulnerable tests only, ordered Critical → Low.' },
  { key: 'notApplicable', name: 'Not Applicable', description: 'Excluded tests with the rule and reason — an audit trail of scope decisions.' },
  { key: 'context', name: 'Application Context', description: 'Every recorded fact about the target application.' },
  { key: 'coverage', name: 'Coverage', description: 'Per-category counts and completion percentages.' },
];

export default function ExportPage() {
  const { engagementId = '' } = useParams();
  const engagement = useEngagement(engagementId);
  const items = useChecklist(engagementId);
  const metrics = useMetrics(items);

  const [includeFindings, setIncludeFindings] = useState(true);
  const [includeNotApplicable, setIncludeNotApplicable] = useState(true);
  const [includeContext, setIncludeContext] = useState(true);
  const [includeCoverage, setIncludeCoverage] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!engagement || !items) return <Card className="text-sm text-ink-400">Loading…</Card>;

  const awaiting = incompleteItems(items);
  const notTested = metrics.counts.notTested;

  async function handleExcel() {
    if (!engagement || !items) return;
    setBusy(true);
    try {
      // Lazy-loaded: the XLSX writer is only fetched when an export is requested.
      const { exportEngagementToExcel } = await import('../../export/excel');
      const fileName = await exportEngagementToExcel(engagement, items, {
        includeFindings,
        includeNotApplicable,
        includeContext,
        includeCoverage,
      });
      toast.success('Workbook generated', fileName);
    } catch (error) {
      toast.error('Excel export failed', String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleBackup() {
    if (!engagement) return;
    const backup = await exportBackup(engagement.id);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFileName(engagement, 'json');
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON backup downloaded', 'Restore it from Data & Settings.');
  }

  const toggles = [
    { key: 'findings', value: includeFindings, set: setIncludeFindings },
    { key: 'notApplicable', value: includeNotApplicable, set: setIncludeNotApplicable },
    { key: 'context', value: includeContext, set: setIncludeContext },
    { key: 'coverage', value: includeCoverage, set: setIncludeCoverage },
  ] as const;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card className="space-y-4">
          <SectionHeading
            title="Excel export"
            description="The workbook is generated in your browser from the same data the dashboard shows. Nothing is uploaded."
          />

          <div className="space-y-2">
            {SHEETS.map((sheet) => {
              const toggle = toggles.find((t) => t.key === sheet.key);
              const enabled = sheet.fixed || toggle?.value;
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
                  {toggle ? (
                    <Toggle checked={toggle.value} onChange={toggle.set} />
                  ) : (
                    <Badge tone={enabled ? 'success' : 'neutral'}>On</Badge>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-4">
            <p className="font-mono text-xs text-ink-500">{buildFileName(engagement)}</p>
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              icon={<IconDownload size={16} />}
              onClick={() => void handleExcel()}
            >
              {busy ? 'Generating…' : 'Export to Excel'}
            </Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <SectionHeading
            title="JSON backup"
            description="Engagement data lives only in this browser. Take a backup before clearing site data or moving machines."
            actions={
              <Button variant="subtle" icon={<IconDownload size={15} />} onClick={() => void handleBackup()}>
                Download backup
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
            <Stat label="Findings" value={metrics.counts.vulnerable} tone={metrics.counts.vulnerable ? 'vuln' : 'neutral'} />
            <Stat label="Completion" value={`${Math.round(metrics.completion * 100)}%`} tone="brand" />
          </div>
        </Card>

        {(awaiting.length > 0 || notTested > 0) && (
          <Card className="space-y-3 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-2">
              <IconAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-300">Assessment is not complete</p>
                <ul className="mt-2 space-y-1 text-xs text-ink-300">
                  {awaiting.length > 0 && (
                    <li>
                      {awaiting.length} test{awaiting.length === 1 ? '' : 's'} marked Tested with no
                      result recorded — they will export with a blank Result column.
                    </li>
                  )}
                  {notTested > 0 && (
                    <li>
                      {notTested} applicable test{notTested === 1 ? '' : 's'} still Not Tested.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </Card>
        )}

        <Card className="space-y-2 text-xs text-ink-400">
          <p className="text-sm font-medium text-ink-100">Export notes</p>
          <p>Generated locally with a bundled XLSX writer — no server, no network request.</p>
          <p>
            Sheets are styled for direct client delivery: priority and result cells are colour coded
            and the header row is frozen.
          </p>
        </Card>
      </div>
    </div>
  );
}
