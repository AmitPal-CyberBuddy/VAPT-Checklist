import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Badge, Button, Card, EmptyState, Input, Select } from '../../ui/primitives';
import { IconSearch, IconX } from '../../ui/icons';
import { TestListRow } from './TestListRow';
import { TestDetailPanel } from './TestDetailPanel';
import { CATEGORIES, CATEGORY_BY_ID, categoryName } from '../../data/categories';
import { SEARCH_INDEX } from '../../data/library';
import { parseQuery, relevance } from '../../data/searchIndex';
import { useChecklist, useEngagement } from '../../hooks/useData';
import { bulkUpdateTestStates, updateTestState } from '../../persistence/repository';
import { suggestApplicability } from '../../domain/applicability';
import { PRIORITIES, PRIORITY_ORDER, type CategoryId, type ChecklistItem } from '../../domain/types';
import { toast } from '../../ui/toast';

type ScopeFilter = 'applicable' | 'excluded' | 'all' | 'manual' | 'unconfirmed';
type StatusFilter = 'all' | 'Not Tested' | 'Tested' | 'N/A';
type ResultFilter = 'all' | 'Vulnerable' | 'Not Vulnerable';
type SortBy = 'priority' | 'id' | 'name' | 'status' | 'recent';

const SCOPE_LABELS: Record<ScopeFilter, string> = {
  applicable: 'In scope',
  excluded: 'Excluded',
  all: 'All tests',
  manual: 'Manually overridden',
  unconfirmed: 'Unconfirmed',
};

const STATUS_RANK: Record<string, number> = { 'Not Tested': 0, Tested: 1, 'N/A': 2 };

/**
 * The testing workspace: list on the left, full test detail on the right.
 *
 * One screen for the whole loop — open, read guidance, set status, set result,
 * note, move on — with keyboard shortcuts so a tester never has to reach for
 * the mouse between tests. Every write goes through the repository, so the
 * dashboard, filters and export update from the same state.
 */
export default function WorkspacePage() {
  const { engagementId = '' } = useParams();
  const engagement = useEngagement(engagementId);
  const items = useChecklist(engagementId);
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('applicable');
  const [status, setStatus] = useState<StatusFilter>(() => {
    const requested = params.get('status');
    return requested === 'Not Tested' || requested === 'Tested' || requested === 'N/A'
      ? requested
      : 'all';
  });
  const [result, setResult] = useState<ResultFilter>((params.get('result') as ResultFilter) ?? 'all');
  const [category, setCategory] = useState<string>(params.get('category') ?? 'all');
  const [subcategory, setSubcategory] = useState<string>('all');
  const [priority, setPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('priority');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(params.get('test'));

  const notesRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const context = engagement?.context ?? {};

  useEffect(() => {
    const requested = params.get('test');
    if (requested) setActiveId(requested);
  }, [params]);

  useEffect(() => {
    setSubcategory('all');
  }, [category]);

  const uncertainIds = useMemo(() => {
    const ids = new Set<string>();
    for (const { definition } of items ?? []) {
      if (suggestApplicability(definition, context).uncertain) ids.add(definition.id);
    }
    return ids;
  }, [items, context]);

  const subcategoryOptions: string[] = useMemo(() => {
    if (category !== 'all') return CATEGORY_BY_ID[category as CategoryId]?.subcategories ?? [];
    return Array.from(new Set(CATEGORIES.flatMap((c) => c.subcategories))).sort();
  }, [category]);

  const visible = useMemo(() => {
    if (!items) return [];
    const terms = parseQuery(query);
    const matched = items.filter(({ definition: d, state: s }) => {
      if (scope === 'applicable' && !s.applicable) return false;
      if (scope === 'excluded' && s.applicable) return false;
      if (scope === 'manual' && s.applicabilitySource !== 'manual') return false;
      if (scope === 'unconfirmed' && !(s.applicable && uncertainIds.has(d.id))) return false;
      if (status !== 'all' && s.status !== status) return false;
      if (result !== 'all' && s.result !== result) return false;
      if (category !== 'all' && d.category !== category) return false;
      if (subcategory !== 'all' && d.subcategory !== subcategory) return false;
      if (priority !== 'all' && d.priority !== priority) return false;
      if (terms.length > 0) {
        const entry = SEARCH_INDEX.get(d.id);
        const notes = s.notes.toLowerCase();
        if (!terms.every((t) => entry?.haystack.includes(t) || notes.includes(t))) return false;
      }
      return true;
    });

    const byId = (a: ChecklistItem, b: ChecklistItem) =>
      a.definition.id.localeCompare(b.definition.id);

    const sorted = [...matched];
    switch (sortBy) {
      case 'id':
        sorted.sort(byId);
        break;
      case 'name':
        sorted.sort((a, b) =>
          a.definition.vulnerabilityName.localeCompare(b.definition.vulnerabilityName),
        );
        break;
      case 'status':
        sorted.sort(
          (a, b) =>
            STATUS_RANK[a.state.status] - STATUS_RANK[b.state.status] ||
            PRIORITY_ORDER[a.definition.priority] - PRIORITY_ORDER[b.definition.priority] ||
            byId(a, b),
        );
        break;
      case 'recent':
        sorted.sort((a, b) => b.state.updatedAt.localeCompare(a.state.updatedAt) || byId(a, b));
        break;
      default:
        sorted.sort(
          (a, b) =>
            PRIORITY_ORDER[a.definition.priority] - PRIORITY_ORDER[b.definition.priority] ||
            byId(a, b),
        );
    }

    if (terms.length > 0) {
      sorted.sort(
        (a, b) =>
          relevance(SEARCH_INDEX.get(b.definition.id), terms) -
          relevance(SEARCH_INDEX.get(a.definition.id), terms),
      );
    }
    return sorted;
  }, [items, query, scope, status, result, category, subcategory, priority, sortBy, uncertainIds]);

  const activeIndex = visible.findIndex((i) => i.definition.id === activeId);
  const active = activeIndex >= 0 ? visible[activeIndex] : visible[0];

  // Keep a valid selection as filters change, without fighting the tester.
  useEffect(() => {
    if (visible.length === 0) return;
    if (!visible.some((i) => i.definition.id === activeId)) {
      setActiveId(visible[0].definition.id);
    }
  }, [visible, activeId]);

  const open = useCallback(
    (id: string) => {
      setActiveId(id);
      const next = new URLSearchParams(params);
      next.set('test', id);
      setParams(next, { replace: true });
      const row = listRef.current?.querySelector(`[data-test-id="${id}"]`);
      row?.scrollIntoView?.({ block: 'nearest' });
    },
    [params, setParams],
  );

  const step = useCallback(
    (delta: number) => {
      if (visible.length === 0) return;
      const from = activeIndex < 0 ? 0 : activeIndex;
      const nextIndex = Math.min(visible.length - 1, Math.max(0, from + delta));
      open(visible[nextIndex].definition.id);
    },
    [activeIndex, visible, open],
  );

  const nextUntested = useCallback(() => {
    if (visible.length === 0) return;
    const from = activeIndex < 0 ? -1 : activeIndex;
    const forward = visible.slice(from + 1).find((i) => i.state.status === 'Not Tested');
    const wrapped = forward ?? visible.find((i) => i.state.status === 'Not Tested');
    if (wrapped) open(wrapped.definition.id);
    else toast.info('Nothing left untested', 'Every test in this view has a status.');
  }, [activeIndex, visible, open]);

  /* ----------------------------------------------------------- shortcuts */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (typing) {
        if (event.key === 'Escape') target?.blur();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const current = active;

      switch (event.key) {
        case 'j':
        case 'ArrowDown':
          event.preventDefault();
          step(1);
          break;
        case 'k':
        case 'ArrowUp':
          event.preventDefault();
          step(-1);
          break;
        case '1':
          if (current) void updateTestState(engagementId, current.definition.id, { status: 'Not Tested' });
          break;
        case '2':
          // Tested needs a result; pressing 2 focuses the choice rather than
          // writing a half-recorded row. v / b complete it.
          if (current && current.state.result) {
            void updateTestState(engagementId, current.definition.id, { status: 'Tested' });
          } else if (current) {
            toast.info('Choose a result', 'Press v for Vulnerable or b for Not Vulnerable.');
          }
          break;
        case '3':
          if (current) void updateTestState(engagementId, current.definition.id, { status: 'N/A' });
          break;
        case 'v':
          if (current?.state.applicable) {
            void updateTestState(engagementId, current.definition.id, {
              status: 'Tested',
              result: 'Vulnerable',
            });
          }
          break;
        case 'b':
          if (current?.state.applicable) {
            void updateTestState(engagementId, current.definition.id, {
              status: 'Tested',
              result: 'Not Vulnerable',
            });
          }
          break;
        case 'e':
          event.preventDefault();
          notesRef.current?.focus();
          break;
        case 'Enter':
          event.preventDefault();
          nextUntested();
          break;
        case '/':
          event.preventDefault();
          document.getElementById('workspace-search')?.focus();
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, engagementId, step, nextUntested]);

  const activeFilters =
    (query ? 1 : 0) +
    (scope !== 'applicable' ? 1 : 0) +
    (status !== 'all' ? 1 : 0) +
    (result !== 'all' ? 1 : 0) +
    (category !== 'all' ? 1 : 0) +
    (subcategory !== 'all' ? 1 : 0) +
    (priority !== 'all' ? 1 : 0);

  function resetFilters() {
    setQuery('');
    setScope('applicable');
    setStatus('all');
    setResult('all');
    setCategory('all');
    setSubcategory('all');
    setPriority('all');
  }

  async function bulk(change: Parameters<typeof bulkUpdateTestStates>[2], message: string) {
    const ids = [...selected];
    await bulkUpdateTestStates(engagementId, ids, change);
    toast.success(message, `${ids.length} test${ids.length === 1 ? '' : 's'} updated.`);
    setSelected(new Set());
  }

  if (!items || !engagement) return <Card className="text-sm text-ink-400">Loading workspace…</Card>;

  const untestedShown = visible.filter((i) => i.state.status === 'Not Tested').length;

  return (
    <div className="space-y-3">
      {/* Filter bar -------------------------------------------------------- */}
      <Card className="space-y-2.5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <IconSearch
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500"
            />
            <Input
              id="workspace-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, alias, ID, guidance, notes…   ( / )"
              className="pl-9"
            />
          </div>
          <Select value={scope} onChange={(e) => setScope(e.target.value as ScopeFilter)} className="w-40">
            {(Object.keys(SCOPE_LABELS) as ScopeFilter[]).map((key) => (
              <option key={key} value={key}>
                {SCOPE_LABELS[key]}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="w-36">
            <option value="all">Any status</option>
            <option value="Not Tested">Not Tested</option>
            <option value="Tested">Tested</option>
            <option value="N/A">N/A</option>
          </Select>
          <Select value={result} onChange={(e) => setResult(e.target.value as ResultFilter)} className="w-36">
            <option value="all">Any result</option>
            <option value="Vulnerable">Vulnerable</option>
            <option value="Not Vulnerable">Not Vulnerable</option>
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-32">
            <option value="all">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-48">
            <option value="all">Any category</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className="w-44">
            <option value="all">Any subcategory</option>
            {subcategoryOptions.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </Select>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="w-40">
            <option value="priority">Sort: Priority</option>
            <option value="status">Sort: Status</option>
            <option value="id">Sort: Test ID</option>
            <option value="name">Sort: Name</option>
            <option value="recent">Sort: Recently updated</option>
          </Select>
          {activeFilters > 0 && (
            <Button size="sm" variant="ghost" icon={<IconX size={13} />} onClick={resetFilters}>
              Clear
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-ink-800 pt-2.5 text-xs text-ink-500">
          <span>
            <strong className="text-ink-200">{visible.length}</strong> shown ·{' '}
            <strong className="text-ink-300">{untestedShown}</strong> not tested
          </span>
          {uncertainIds.size > 0 && scope !== 'unconfirmed' && (
            <button className="text-amber-400 hover:underline" onClick={() => setScope('unconfirmed')}>
              {uncertainIds.size} unconfirmed
            </button>
          )}
          <button
            className={clsx('hover:text-brand-400', selectionMode ? 'text-brand-400' : 'text-ink-400')}
            onClick={() => {
              setSelectionMode((v) => !v);
              setSelected(new Set());
            }}
          >
            {selectionMode ? 'Exit bulk edit' : 'Bulk edit'}
          </button>
          {selectionMode && (
            <button
              className="text-ink-400 hover:text-brand-400"
              onClick={() =>
                setSelected(
                  selected.size === visible.length
                    ? new Set()
                    : new Set(visible.map((i) => i.definition.id)),
                )
              }
            >
              {selected.size === visible.length && visible.length > 0
                ? 'Deselect all'
                : 'Select all shown'}
            </button>
          )}
          <span className="ml-auto hidden text-[11px] text-ink-600 lg:inline">
            <kbd className="rounded bg-ink-800 px-1">j</kbd>/
            <kbd className="rounded bg-ink-800 px-1">k</kbd> move ·{' '}
            <kbd className="rounded bg-ink-800 px-1">1</kbd>
            <kbd className="rounded bg-ink-800 px-1">2</kbd>
            <kbd className="rounded bg-ink-800 px-1">3</kbd> status ·{' '}
            <kbd className="rounded bg-ink-800 px-1">v</kbd>/
            <kbd className="rounded bg-ink-800 px-1">b</kbd> result ·{' '}
            <kbd className="rounded bg-ink-800 px-1">e</kbd> note ·{' '}
            <kbd className="rounded bg-ink-800 px-1">⏎</kbd> next untested
          </span>
        </div>
      </Card>

      {/* Bulk bar ---------------------------------------------------------- */}
      {selectionMode && selected.size > 0 && (
        <div className="panel animate-in sticky top-16 z-30 flex flex-wrap items-center gap-2 border-brand-500/30 bg-ink-900/95 p-3">
          <Badge tone="brand">{selected.size} selected</Badge>
          <Button size="sm" onClick={() => void bulk({ status: 'Not Tested' }, 'Reset to Not Tested')}>
            Not Tested
          </Button>
          <Button
            size="sm"
            onClick={() => void bulk({ status: 'Tested', result: 'Not Vulnerable' }, 'Marked Not Vulnerable')}
          >
            Tested → Not Vulnerable
          </Button>
          <Button
            size="sm"
            onClick={() => void bulk({ status: 'Tested', result: 'Vulnerable' }, 'Marked Vulnerable')}
          >
            Tested → Vulnerable
          </Button>
          <Button size="sm" onClick={() => void bulk({ status: 'N/A' }, 'Marked N/A')}>
            N/A
          </Button>
          <span className="mx-1 h-4 w-px bg-ink-700" />
          <Button
            size="sm"
            variant="subtle"
            onClick={() => void bulk({ applicable: true, applicabilitySource: 'manual' }, 'Included in scope')}
          >
            Include
          </Button>
          <Button
            size="sm"
            variant="subtle"
            onClick={() => void bulk({ applicable: false, applicabilitySource: 'manual' }, 'Excluded from scope')}
          >
            Exclude
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Two-pane workspace ------------------------------------------------ */}
      {visible.length === 0 ? (
        <EmptyState
          title="No tests match these filters"
          description="Adjust the filters, or widen the scope selector to see excluded tests."
          action={
            <Button variant="subtle" onClick={resetFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(280px,340px)_1fr]">
          <div
            ref={listRef}
            className="panel max-h-[calc(100vh-15rem)] min-h-[24rem] divide-y divide-ink-850 overflow-y-auto p-0"
          >
            {visible.map((item) => (
              <div key={item.definition.id} data-test-id={item.definition.id}>
                <TestListRow
                  item={item}
                  active={active?.definition.id === item.definition.id}
                  selected={selected.has(item.definition.id)}
                  selectionMode={selectionMode}
                  categoryLabel={categoryName(item.definition.category)}
                  uncertain={uncertainIds.has(item.definition.id)}
                  onOpen={() => open(item.definition.id)}
                  onToggleSelect={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.definition.id)) next.delete(item.definition.id);
                      else next.add(item.definition.id);
                      return next;
                    })
                  }
                />
              </div>
            ))}
          </div>

          <div className="panel max-h-[calc(100vh-15rem)] min-h-[24rem] overflow-hidden p-0">
            {active && (
              <TestDetailPanel
                key={active.definition.id}
                item={active}
                engagementId={engagementId}
                context={context}
                position={(activeIndex < 0 ? 0 : activeIndex) + 1}
                total={visible.length}
                onPrevious={() => step(-1)}
                onNext={() => step(1)}
                onNextUntested={nextUntested}
                notesRef={notesRef}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
