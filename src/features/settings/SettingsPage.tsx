import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Modal, SectionHeading, Stat } from '../../ui/primitives';
import { IconAlert, IconDownload, IconTrash } from '../../ui/icons';
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
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
          <IconAlert size={16} className="mt-0.5 shrink-0 text-rose-400" />
          <p className="text-sm text-rose-300">
            Nothing was imported and your existing engagements are untouched.
          </p>
        </div>
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-ink-800 p-3 text-xs text-ink-300">
          {inspection.issues.map((issue, index) => (
            <li key={index} className="flex gap-2">
              <span className="text-rose-400">•</span>
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
      <ul className="space-y-1 rounded-lg border border-ink-800 p-3 text-xs text-ink-300">
        {inspection.names.map((name) => (
          <li key={name} className="truncate">
            {name}
          </li>
        ))}
      </ul>
      {inspection.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-300">
          {inspection.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-500">
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
    for (const e of engagements) added += await syncLibrary(e.id);
    toast.success(
      added === 0 ? 'All engagements are up to date' : 'Library synchronised',
      added === 0 ? undefined : `${added} new test state(s) added.`,
    );
  }

  const outdated = (engagements ?? []).filter((e) => e.libraryVersion !== LIBRARY_VERSION);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">Data & settings</h1>
        <p className="mt-1 text-sm text-ink-400">
          Everything is stored locally in this browser. There is no account, no server and no
          synchronisation — take backups if the data matters.
        </p>
      </div>

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

      <Card className="space-y-4">
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

      <Card className="space-y-3">
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
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <IconAlert size={14} />
            {outdated.length} engagement(s) were created on an older library version.
          </div>
        ) : (
          <p className="text-xs text-ink-500">All engagements are on library v{LIBRARY_VERSION}.</p>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionHeading title="Storage details" />
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between rounded-lg border border-ink-800 px-3 py-2">
            <dt className="text-ink-400">Mechanism</dt>
            <dd className="text-ink-100">IndexedDB (Dexie)</dd>
          </div>
          <div className="flex justify-between rounded-lg border border-ink-800 px-3 py-2">
            <dt className="text-ink-400">Database</dt>
            <dd className="font-mono text-xs text-ink-100">
              {DB_NAME} · v{DB_VERSION}
            </dd>
          </div>
          <div className="flex justify-between rounded-lg border border-ink-800 px-3 py-2">
            <dt className="text-ink-400">Network calls</dt>
            <dd className="text-emerald-400">None</dd>
          </div>
          <div className="flex justify-between rounded-lg border border-ink-800 px-3 py-2">
            <dt className="text-ink-400">Excel generation</dt>
            <dd className="text-ink-100">Client-side (bundled)</dd>
          </div>
        </dl>
      </Card>

      <Card className="space-y-3 border-rose-500/25">
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
          <Badge tone="critical">{engagements?.length ?? 0} engagements</Badge>
          will be removed from IndexedDB.
        </div>
      </Modal>
    </div>
  );
}
