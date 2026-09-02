import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Modal, SectionHeading, Stat } from '../../ui/primitives';
import { IconAlert, IconDownload, IconTrash } from '../../ui/icons';
import { DB_NAME, DB_VERSION, estimateUsage } from '../../persistence/db';
import { clearAllData, exportBackup, importBackup, syncLibrary } from '../../persistence/repository';
import { useEngagements } from '../../hooks/useData';
import { LIBRARY_VERSION, TEST_LIBRARY } from '../../data/library';
import { toast } from '../../ui/toast';

export default function SettingsPage() {
  const engagements = useEngagements();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
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

  async function handleImport(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      const { engagements: count } = await importBackup(parsed);
      toast.success('Backup restored', `${count} engagement(s) imported.`);
    } catch (error) {
      toast.error('Import failed', String(error));
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
          <Button variant="primary" icon={<IconDownload size={15} />} onClick={() => void handleBackupAll()}>
            Download full backup
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Import backup file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
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
