import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  InlineAlert,
  Modal,
  PageHeader,
  ProgressBar,
  SectionHeading,
  Stat,
} from '../../ui/primitives';
import { IconAlert, IconCheck, IconDownload, IconTrash } from '../../ui/icons';
import { DB_NAME, DB_VERSION, estimateUsage } from '../../persistence/db';
import {
  clearAllData,
  exportBackup,
  importBackup,
  inspectBackup,
  syncLibrary,
  type BackupInspection,
} from '../../persistence/repository';
import { useEngagements } from '../../hooks/useData';
import { LIBRARY_VERSION, TEST_LIBRARY } from '../../data/library';
import { toast } from '../../ui/toast';

function ImportPreview({ inspection }: { inspection: BackupInspection }) {
  if (!inspection.ok) {
    return (
      <div className="space-y-3">
        <InlineAlert tone="error" icon={<IconAlert size={16} aria-hidden="true" />}>
          Nothing was imported and your existing engagements are untouched.
        </InlineAlert>
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-(--radius-control) border border-ink-700 p-3 text-xs text-ink-300">
          {inspection.issues.map((issue, index) => (
            <li key={index} className="flex gap-2">
              <span aria-hidden="true" className="text-vuln-400">
                •
              </span>
              {issue}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Engagements" value={inspection.engagements} tone="brand" />
        <Stat label="Test states" value={inspection.testStates} />
      </div>
      <ul className="space-y-1 rounded-(--radius-control) border border-ink-700 p-3 text-xs text-ink-300">
        {inspection.names.map((name) => (
          <li key={name} className="truncate break-words">
            {name}
          </li>
        ))}
      </ul>
      {inspection.warnings.length > 0 && (
        <ul className="space-y-1 rounded-(--radius-control) border border-warn-500/30 bg-warn-500/5 p-3 text-xs text-warn-300">
          {inspection.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-400">
        Imported engagements are added alongside what you already have. If an id collides it is
        re-keyed, so nothing is overwritten.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const engagements = useEngagements();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    inspection: BackupInspection;
    data: unknown;
    fileName: string;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void estimateUsage().then(setUsage);
  }, [engagements?.length]);

  async function handleBackupAll() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vapt-checklist-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup downloaded', `${backup.engagements.length} engagement(s).`);
  }

  /**
   * Two steps on purpose: the file is parsed and fully validated first, and
   * the tester confirms what will be added. Nothing is written until then, so
   * a malformed file can never touch existing engagements.
   */
  async function handleFileChosen(file: File) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast.error('Import failed', 'That file is not valid JSON.');
      return;
    }
    setPendingImport({ inspection: inspectBackup(parsed), data: parsed, fileName: file.name });
  }

  async function confirmImport() {
    if (!pendingImport?.inspection.ok) return;
    setImporting(true);
    try {
      const { engagements: count, tests } = await importBackup(pendingImport.data);
      toast.success(
        'Backup restored',
        `${count} engagement(s), ${tests} test state(s) imported.`,
      );
      setPendingImport(null);
    } catch (error) {
      toast.error('Import failed', error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }

  async function handleSync() {
    if (!engagements) return;
    let added = 0;
    let retired = 0;
    for (const e of engagements) {
      const result = await syncLibrary(e.id);
      added += result.added;
      retired += result.retired;
    }
    const detail = [
      added > 0 ? `${added} new test${added === 1 ? '' : 's'} added` : '',
      retired > 0
        ? `${retired} recorded state${retired === 1 ? '' : 's'} belong to tests that have since been merged and are no longer shown`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
    toast.success(
      added === 0 && retired === 0 ? 'All engagements are up to date' : 'Library synchronised',
      detail || undefined,
    );
  }

  const outdated = (engagements ?? []).filter((e) => e.libraryVersion !== LIBRARY_VERSION);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Data & settings"
        eyebrow="This installation"
        description="Everything is stored locally in this browser. There is no account, no server and no synchronisation — take backups if the data matters."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Engagements" value={engagements?.length ?? '—'} tone="brand" />
        <Stat label="Library tests" value={TEST_LIBRARY.length} />
        <Stat label="Library version" value={LIBRARY_VERSION} />
        <Stat
          label="Storage used"
          value={usage ? `${(usage.usage / 1024 / 1024).toFixed(1)} MB` : '—'}
          hint={usage ? `of ~${(usage.quota / 1024 / 1024 / 1024).toFixed(1)} GB available` : undefined}
        />
      </div>

      <Card className="panel-accent scroll-reveal space-y-4">
        <SectionHeading
          title="Backup & restore"
          description="A JSON backup contains every engagement, context and recorded result. Import merges into this browser; duplicate IDs are re-keyed rather than overwritten."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={<IconDownload size={15} />}
            onClick={() => void handleBackupAll()}
          >
            Export all engagements (JSON)
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Import Engagement JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileChosen(file);
              e.target.value = '';
            }}
          />
        </div>
      </Card>

      <Card className="scroll-reveal space-y-3">
        <SectionHeading
          title="Test library synchronisation"
          description="When the bundled library gains new tests, existing engagements can adopt them without losing recorded work."
          actions={
            <Button variant="subtle" onClick={() => void handleSync()}>
              Sync all engagements
            </Button>
          }
        />
        {outdated.length > 0 ? (
          <InlineAlert tone="warn" icon={<IconAlert size={14} aria-hidden="true" />}>
            {outdated.length} engagement(s) were created on an older library version.
          </InlineAlert>
        ) : (
          <p className="text-xs text-ink-400">All engagements are on library v{LIBRARY_VERSION}.</p>
        )}
      </Card>

      <Card className="scroll-reveal space-y-4">
        <SectionHeading
          title="Local data & posture"
          description="This installation's storage and its local-only guarantees, at a glance."
        />
        <div className="panel-inset space-y-2 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink-200">Storage in use</span>
            <span className="font-mono text-xs tabular-nums text-ink-300">
              {usage
                ? `${(usage.usage / 1024 / 1024).toFixed(1)} MB of ~${(usage.quota / 1024 / 1024 / 1024).toFixed(1)} GB`
                : 'Measuring…'}
            </span>
          </div>
          <ProgressBar
            value={usage && usage.quota > 0 ? usage.usage / usage.quota : 0}
            label="Local storage in use"
          />
        </div>
        <dl className="panel-inset px-4 py-1 text-sm">
          <div className="kv-row">
            <dt className="flex items-center gap-2 text-ink-400">
              <IconCheck size={12} strokeWidth={2.5} className="text-safe-400" />
              Mechanism
            </dt>
            <dd className="text-ink-100">IndexedDB (Dexie)</dd>
          </div>
          <div className="kv-row">
            <dt className="flex items-center gap-2 text-ink-400">
              <IconCheck size={12} strokeWidth={2.5} className="text-safe-400" />
              Database
            </dt>
            <dd className="font-mono text-xs text-ink-100">
              {DB_NAME} · v{DB_VERSION}
            </dd>
          </div>
          <div className="kv-row">
            <dt className="flex items-center gap-2 text-ink-400">
              <IconCheck size={12} strokeWidth={2.5} className="text-safe-400" />
              Network calls
            </dt>
            <dd className="text-safe-400">None</dd>
          </div>
          <div className="kv-row">
            <dt className="flex items-center gap-2 text-ink-400">
              <IconCheck size={12} strokeWidth={2.5} className="text-safe-400" />
              Telemetry
            </dt>
            <dd className="text-safe-400">None</dd>
          </div>
          <div className="kv-row">
            <dt className="flex items-center gap-2 text-ink-400">
              <IconCheck size={12} strokeWidth={2.5} className="text-safe-400" />
              Excel generation
            </dt>
            <dd className="text-ink-100">Client-side (bundled)</dd>
          </div>
        </dl>
      </Card>

      <Card className="scroll-reveal space-y-3 border-vuln-500/30">
        <SectionHeading
          title="Danger zone"
          description="Permanently removes every engagement, result and note stored by this application in this browser."
          actions={
            <Button variant="danger" icon={<IconTrash size={15} />} onClick={() => setConfirmClear(true)}>
              Delete all data
            </Button>
          }
        />
      </Card>

      <Modal
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title={pendingImport?.inspection.ok ? 'Confirm import' : 'This backup was rejected'}
        description={pendingImport?.fileName}
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingImport(null)}>
              {pendingImport?.inspection.ok ? 'Cancel' : 'Close'}
            </Button>
            {pendingImport?.inspection.ok && (
              <Button variant="primary" disabled={importing} onClick={() => void confirmImport()}>
                {importing ? 'Importing…' : 'Import'}
              </Button>
            )}
          </>
        }
      >
        {pendingImport && <ImportPreview inspection={pendingImport.inspection} />}
      </Modal>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Delete all local data"
        description="This cannot be undone. Download a backup first if you need the records."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await clearAllData();
                setConfirmClear(false);
                toast.success('All local data deleted');
              }}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-2 text-sm text-ink-300">
          <Badge tone="neutral">{engagements?.length ?? 0} engagements</Badge>
          will be removed from IndexedDB.
        </div>
      </Modal>
    </div>
  );
}
