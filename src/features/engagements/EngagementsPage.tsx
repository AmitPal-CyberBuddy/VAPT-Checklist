import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  ProgressBar,
} from '../../ui/primitives';
import { IconCopy, IconPlus, IconSearch, IconShield, IconTrash } from '../../ui/icons';
import { useEngagementSummaries } from '../../hooks/useData';
import { deleteEngagement, duplicateEngagement, setEngagementStatus } from '../../persistence/repository';
import { toast } from '../../ui/toast';
import type { Engagement } from '../../domain/types';

export default function EngagementsPage() {
  const summaries = useEngagementSummaries();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Engagement | null>(null);

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

  async function handleDuplicate(engagement: Engagement) {
    const copy = await duplicateEngagement(engagement.id, `${engagement.name} (copy)`);
    if (copy) {
      toast.success('Engagement duplicated', 'Context copied, results reset.');
      navigate(`/e/${copy.id}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-50">Engagements</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">
            Each engagement pairs an application context with its own copy of the test library.
            Given this application — what should I test, what have I tested, and what did I find?
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <IconSearch
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search engagements"
              className="w-56 pl-9"
            />
          </div>
          <Button
            variant="primary"
            icon={<IconPlus size={15} />}
            onClick={() => navigate('/engagements/new')}
          >
            New engagement
          </Button>
        </div>
      </div>

      {summaries === undefined ? (
        <Card className="text-sm text-ink-400">Loading…</Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconShield size={32} />}
          title={query ? 'No engagements match that search' : 'No engagements yet'}
          description={
            query
              ? 'Try a different name, client or scope entry.'
              : 'Create an engagement, describe the target application, and the applicable vulnerability checklist is generated for you.'
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ engagement, applicable, resolved, vulnerable, completion }) => (
            <Card key={engagement.id} className="flex flex-col gap-4 transition-colors hover:border-ink-600">
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

              {engagement.scope.length > 0 && (
                <p className="truncate font-mono text-[11px] text-ink-500">
                  {engagement.scope.join(' · ')}
                </p>
              )}

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-ink-400">
                    {resolved} of {applicable} applicable tests resolved
                  </span>
                  <span className="font-medium tabular-nums text-ink-200">
                    {Math.round(completion * 100)}%
                  </span>
                </div>
                <ProgressBar value={completion} tone={completion === 1 ? 'safe' : 'brand'} />
              </div>

              <div className="flex items-center justify-between border-t border-ink-800 pt-3">
                <div className="flex items-center gap-2">
                  {vulnerable > 0 ? (
                    <Badge tone="vulnerable">
                      {vulnerable} finding{vulnerable === 1 ? '' : 's'}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">No findings recorded</Badge>
                  )}
                  <span className="text-[11px] text-ink-600">
                    {new Date(engagement.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Duplicate (context only)"
                    onClick={() => void handleDuplicate(engagement)}
                  >
                    <IconCopy size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Delete"
                    onClick={() => setPendingDelete(engagement)}
                    className="hover:text-rose-400"
                  >
                    <IconTrash size={14} />
                  </Button>
                  <Button size="sm" variant="subtle" onClick={() => navigate(`/e/${engagement.id}`)}>
                    Open
                  </Button>
                </div>
              </div>

              {engagement.status === 'Active' && completion === 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="justify-start text-emerald-400"
                  onClick={() => void setEngagementStatus(engagement.id, 'Completed')}
                >
                  All applicable tests resolved — mark as completed
                </Button>
              )}
            </Card>
          ))}
        </div>
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
