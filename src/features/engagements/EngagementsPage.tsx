import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
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
import { applicationTypeLabel } from '../../domain/applicationType';

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
        eyebrow="Assessment register"
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
          icon={<IconShield size={30} />}
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
        >
          {!query && (
            <ol className="mt-4 grid w-full max-w-2xl gap-2 text-left sm:grid-cols-3">
              {[
                ['01', 'Record the target', 'Name, application type and URL — the assessment identity.'],
                ['02', 'Answer the context', 'A few per-domain questions decide which tests are in scope.'],
                ['03', 'Work the checklist', 'Test, record status and result, and export the assessment.'],
              ].map(([step, title, text]) => (
                <li
                  key={step}
                  className="panel-inset flex flex-col gap-1 px-3 py-2.5 text-left"
                >
                  <span className="font-mono text-micro text-brand-400">{step}</span>
                  <span className="text-xs font-semibold text-ink-100">{title}</span>
                  <span className="text-micro leading-relaxed text-ink-400">{text}</span>
                </li>
              ))}
            </ol>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-5">
          <section
            aria-label="Engagement register summary"
            className="grid gap-2 sm:grid-cols-4"
          >
            {[
              {
                label: 'Engagements',
                value: summaries.length,
                tone: 'neutral' as const,
              },
              {
                label: 'Active',
                value: summaries.filter((s) => s.engagement.status === 'Active').length,
                tone: 'brand' as const,
              },
              {
                label: 'Completed',
                value: summaries.filter((s) => s.engagement.status === 'Completed').length,
                tone: 'safe' as const,
              },
              {
                label: 'Vulnerable records',
                value: summaries.reduce((n, s) => n + s.vulnerable, 0),
                tone: summaries.some((s) => s.vulnerable > 0) ? ('vuln' as const) : ('neutral' as const),
              },
            ].map((cell) => (
              <div key={cell.label} className="metric-tile">
                <p className="text-micro font-medium tracking-wider text-ink-400 uppercase">
                  {cell.label}
                </p>
                <p
                  className={clsx(
                    'text-2xl leading-tight font-semibold tracking-tight tabular-nums',
                    cell.tone === 'brand' && 'text-brand-400',
                    cell.tone === 'safe' && 'text-safe-400',
                    cell.tone === 'vuln' && 'text-vuln-400',
                    cell.tone === 'neutral' && 'text-ink-50',
                  )}
                >
                  {cell.value}
                </p>
              </div>
            ))}
          </section>

          {/* The register: a dense, scannable list rather than a card grid —
              every row answers name → target → progress → vulnerable → actions
              in one horizontal scan, like the logs a tester actually keeps. */}
          <ul className="list-none overflow-hidden rounded-(--radius-panel) border border-ink-700 bg-ink-900 shadow-(--shadow-panel)">
            {filtered.map(({ engagement, applicable, resolved, vulnerable, completion }, index) => (
              <li
                key={engagement.id}
                style={{ '--d': Math.min(index, 8) } as CSSProperties}
                className={clsx(
                  'stagger-item group relative flex flex-col gap-3 border-b border-ink-700/70 p-4 transition-colors duration-150 last:border-b-0 hover:bg-ink-850/70 sm:flex-row sm:items-center sm:gap-5 sm:px-5',
                  vulnerable > 0
                    ? 'rail-vuln'
                    : engagement.status === 'Completed'
                      ? 'rail-safe'
                      : engagement.status === 'Active'
                        ? 'rail-brand'
                        : '',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <Link
                      to={`/e/${engagement.id}`}
                      className="truncate text-base font-semibold tracking-tight text-ink-50 hover:text-brand-400"
                    >
                      {engagement.name}
                    </Link>
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
                    {vulnerable > 0 && (
                      <Badge tone="vulnerable" glyph="▲">
                        {vulnerable} vulnerable
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 truncate text-xs text-ink-400">
                    <span>{applicationTypeLabel(engagement.applicationType)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{engagement.clientName || 'No client recorded'}</span>
                    {engagement.testerName && <span>· {engagement.testerName}</span>}
                  </p>
                  {(engagement.applicationUrl || engagement.scope.length > 0) && (
                    <p className="mt-1 truncate font-mono text-micro text-ink-500">
                      {[engagement.applicationUrl, ...engagement.scope].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {engagement.status === 'Active' && completion === 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 justify-start text-safe-400"
                      onClick={() =>
                        void setEngagementStatus(engagement.id, 'Completed').catch((error: unknown) =>
                          toast.error(
                            'Engagement status not saved',
                            error instanceof Error ? error.message : String(error),
                          ),
                        )
                      }
                    >
                      All applicable tests completed — mark engagement as Completed
                    </Button>
                  )}
                </div>

                <div className="w-full shrink-0 sm:w-52">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="text-ink-400">
                      {resolved} of {applicable} applicable
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
                  <p className="mt-1 text-micro text-ink-500">
                    Updated {new Date(engagement.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
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
                  <Button size="sm" variant="primary" onClick={() => navigate(`/e/${engagement.id}`)}>
                    Open
                  </Button>
                </div>
              </li>
            ))}
          </ul>
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
