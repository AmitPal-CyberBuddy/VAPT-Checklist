import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Input,
  LoadingPanel,
  Modal,
  PageHeader,
  ProgressBar,
} from '../../ui/primitives';
import { IconCopy, IconDownload, IconPlus, IconSearch, IconShield, IconTrash } from '../../ui/icons';
import { useEngagementSummaries } from '../../hooks/useData';
import {
  deleteEngagement,
  duplicateEngagement,
  getChecklist,
  setEngagementStatus,
} from '../../persistence/repository';
import { toast } from '../../ui/toast';
import type { Engagement } from '../../domain/types';

export default function EngagementsPage() {
  const summaries = useEngagementSummaries();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Engagement | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const filtered = (summaries ?? []).filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      s.engagement.name.toLowerCase().includes(q) ||
      (s.engagement.clientName ?? '').toLowerCase().includes(q) ||
      s.engagement.scope.join(' ').toLowerCase().includes(q)
    );
  });

  async function handleDelete() {
    if (!pendingDelete) return;
    await deleteEngagement(pendingDelete.id);
    toast.success('Engagement deleted', pendingDelete.name);
    setPendingDelete(null);
  }

  /** Download Excel without leaving the list. */
  async function handleExcel(engagement: Engagement) {
    setExporting(engagement.id);
    try {
      const [{ exportEngagementToExcel }, items] = await Promise.all([
        import('../../export/excel'),
        getChecklist(engagement.id),
      ]);
      const fileName = await exportEngagementToExcel(engagement, items);
      toast.success('Workbook downloaded', fileName);
    } catch (error) {
      toast.error('Excel export failed', String(error));
    } finally {
      setExporting(null);
    }
  }

  async function handleDuplicate(engagement: Engagement) {
    const copy = await duplicateEngagement(engagement.id, `${engagement.name} (copy)`);
    if (copy) {
      toast.success('Engagement duplicated', 'Context copied, results reset.');
      navigate(`/e/${copy.id}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engagements"
        description="Each engagement pairs an application context with its own copy of the test library. Given this application — what should I test, what have I tested, and what did I find?"
        actions={
          <>
            <div className="relative">
              <IconSearch
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search engagements by name, client or scope"
                placeholder="Search engagements"
                className="w-48 pl-9 sm:w-56"
              />
            </div>
            <Button
              variant="primary"
              icon={<IconPlus size={15} />}
              onClick={() => navigate('/engagements/new')}
            >
              New engagement
            </Button>
          </>
        }
      />

      {summaries === undefined ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LoadingPanel rows={3} label="Loading engagements" />
          <LoadingPanel rows={3} label="" />
          <LoadingPanel rows={3} label="" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconShield size={32} />}
          title={query ? `No engagements match “${query}”` : 'No engagements yet'}
          description={
            query
              ? 'Search covers the engagement name, client and scope. Try a shorter term.'
              : 'Create an engagement, describe the target application, and the applicable test list is generated for you — 184 vulnerability tests, narrowed to the ones that matter for that target.'
          }
          action={
            !query && (
              <Button
                variant="primary"
                icon={<IconPlus size={15} />}
                onClick={() => navigate('/engagements/new')}
              >
                Create your first engagement
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid list-none gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ engagement, applicable, resolved, vulnerable, completion }) => (
            <li key={engagement.id} className="panel flex flex-col gap-4 p-4 transition-colors hover:border-ink-600">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/e/${engagement.id}`}
                    className="block truncate text-base font-semibold text-ink-50 hover:text-brand-400"
                  >
                    {engagement.name}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-ink-400">
                    {engagement.clientName || 'No client recorded'}
                    {engagement.testerName ? ` · ${engagement.testerName}` : ''}
                  </p>
                </div>
                <Badge
                  tone={
                    engagement.status === 'Active'
                      ? 'brand'
                      : engagement.status === 'Completed'
                        ? 'success'
                        : 'neutral'
                  }
                >
                  {engagement.status}
                </Badge>
              </div>

              {(engagement.applicationUrl || engagement.scope.length > 0) && (
                <p className="truncate font-mono text-micro text-ink-500">
                  {[engagement.applicationUrl, ...engagement.scope].filter(Boolean).join(' · ')}
                </p>
              )}

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-ink-400">
                    {resolved} of {applicable} applicable tests completed
                  </span>
                  <span className="font-medium tabular-nums text-ink-200">
                    {Math.round(completion * 100)}%
                  </span>
                </div>
                <ProgressBar
                  value={completion}
                  label={`${engagement.name} progress`}
                  tone={completion === 1 ? 'safe' : 'brand'}
                />
              </div>

              <div className="flex items-center justify-between border-t border-ink-800 pt-3">
                <div className="flex items-center gap-2">
                  {vulnerable > 0 ? (
                    <Badge tone="vulnerable" glyph="▲">
                      {vulnerable} vulnerable
                    </Badge>
                  ) : (
                    <Badge tone="neutral">No vulnerable tests</Badge>
                  )}
                  <span className="text-micro text-ink-400">
                    {new Date(engagement.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton
                    size="sm"
                    label={`Download Excel for ${engagement.name}`}
                    disabled={exporting === engagement.id}
                    onClick={() => void handleExcel(engagement)}
                    icon={<IconDownload size={14} />}
                  />
                  <IconButton
                    size="sm"
                    label={`Duplicate ${engagement.name} (context only)`}
                    onClick={() => void handleDuplicate(engagement)}
                    icon={<IconCopy size={14} />}
                  />
                  <IconButton
                    size="sm"
                    label={`Delete ${engagement.name}`}
                    onClick={() => setPendingDelete(engagement)}
                    className="hover:text-vuln-400"
                    icon={<IconTrash size={14} />}
                  />
                  <Button size="sm" variant="subtle" onClick={() => navigate(`/e/${engagement.id}`)}>
                    Open
                  </Button>
                </div>
              </div>

              {engagement.status === 'Active' && completion === 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="justify-start text-safe-400"
                  onClick={() => void setEngagementStatus(engagement.id, 'Completed')}
                >
                  All applicable tests completed — mark engagement as Completed
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete engagement"
        description={`"${pendingDelete?.name}" and all recorded statuses, results and notes will be permanently removed from this browser.`}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-400">
          Export the assessment to Excel or take a JSON backup first if you need a record.
        </p>
      </Modal>
    </div>
  );
}
