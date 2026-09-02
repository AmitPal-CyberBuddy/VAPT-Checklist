import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FilterSelect,
  Input,
  LiveAnnouncement,
  LoadingPanel,
} from '../../ui/primitives';
import { IconFilter, IconSearch, IconX } from '../../ui/icons';
import { TestListRow } from './TestListRow';
import { TestDetailPanel } from './TestDetailPanel';
import { CATEGORIES, CATEGORY_BY_ID, categoryName } from '../../data/categories';
import { SEARCH_INDEX } from '../../data/library';
import { parseQuery, relevance } from '../../data/searchIndex';
import { useChecklist, useEngagement } from '../../hooks/useData';
import { useIsWide } from '../../hooks/useMediaQuery';
import { bulkUpdateTestStates, updateTestState } from '../../persistence/repository';
import { suggestApplicability } from '../../domain/applicability';
import { effectiveContext } from '../../domain/context';
import { PRIORITIES, PRIORITY_ORDER, type CategoryId, type ChecklistItem } from '../../domain/types';
import { toast } from '../../ui/toast';

type ScopeFilter = 'applicable' | 'notApplicable' | 'all' | 'manual' | 'unconfirmed';
type StatusFilter = 'all' | 'Not Tested' | 'Tested' | 'N/A';
type ResultFilter = 'all' | 'Vulnerable' | 'Not Vulnerable';
type SortBy = 'priority' | 'id' | 'name' | 'status' | 'recent';

const SCOPE_LABELS: Record<ScopeFilter, string> = {
  applicable: 'Applicable',
  notApplicable: 'Not Applicable',
  all: 'All tests',
  manual: 'Set by me',
  unconfirmed: 'Unconfirmed',
};

const STATUS_RANK: Record<string, number> = { 'Not Tested': 0, Tested: 1, 'N/A': 2 };

/**
 * The testing workspace: list on the left, full test on the right.
 *
 * Below `lg` the two panes become two views (list → detail → back), because a
 * squeezed side-by-side layout is worse than either one at full width.
 */
export default function WorkspacePage() {
  const { engagementId = '' } = useParams();
  const engagement = useEngagement(engagementId);
  const items = useChecklist(engagementId);
  const [params, setParams] = useSearchParams();
  const isWide = useIsWide();

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(params.get('test'));
  const [mobileView, setMobileView] = useState<'list' | 'detail'>(
    params.get('test') ? 'detail' : 'list',
  );

  const notesRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);
  /** True when the last move came from the keyboard, so focus should follow. */
  const keyboardMove = useRef(false);

  // Rules always see the derived asset types, never the raw context.
  const context = engagement ? effectiveContext(engagement) : {};

  useEffect(() => {
    const requested = params.get('test');
    if (requested) setActiveId(requested);
  }, [params]);

  useEffect(() => {
    setSubcategory('all');
  }, [category]);

  const unconfirmedIds = useMemo(() => {
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
      if (scope === 'notApplicable' && s.applicable) return false;
      if (scope === 'manual' && s.applicabilitySource !== 'manual') return false;
      if (scope === 'unconfirmed' && !(s.applicable && unconfirmedIds.has(d.id))) return false;
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
  }, [items, query, scope, status, result, category, subcategory, priority, sortBy, unconfirmedIds]);

  const activeIndex = visible.findIndex((i) => i.definition.id === activeId);
  const active = activeIndex >= 0 ? visible[activeIndex] : visible[0];

  useEffect(() => {
    if (visible.length === 0) return;
    if (!visible.some((i) => i.definition.id === activeId)) {
      setActiveId(visible[0].definition.id);
    }
  }, [visible, activeId]);

  const open = useCallback(
    (id: string) => {
      setActiveId(id);
      setMobileView('detail');
      const next = new URLSearchParams(params);
      next.set('test', id);
      setParams(next, { replace: true });
      listRef.current
        ?.querySelector(`[data-test-id="${id}"]`)
        ?.scrollIntoView?.({ block: 'nearest' });
    },
    [params, setParams],
  );

  const step = useCallback(
    (delta: number, fromKeyboard = false) => {
      if (visible.length === 0) return;
      const from = activeIndex < 0 ? 0 : activeIndex;
      const nextIndex = Math.min(visible.length - 1, Math.max(0, from + delta));
      keyboardMove.current = fromKeyboard;
      open(visible[nextIndex].definition.id);
    },
    [activeIndex, visible, open],
  );

  // Keep focus on the active row when the keyboard moved the selection, so the
  // roving tabindex stays coherent and the change is announced.
  useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    if (document.activeElement?.closest('[data-test-id]')) activeRowRef.current?.focus();
  }, [activeId]);

  const nextUntested = useCallback(() => {
    if (visible.length === 0) return;
    const from = activeIndex < 0 ? -1 : activeIndex;
    const forward = visible.slice(from + 1).find((i) => i.state.status === 'Not Tested');
    const wrapped = forward ?? visible.find((i) => i.state.status === 'Not Tested');
    if (wrapped) open(wrapped.definition.id);
    else toast.info('Nothing left Not Tested', 'Every test in this view has a status.');
  }, [activeIndex, visible, open]);

  /* ----------------------------------------------------------- shortcuts */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
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
          step(1, true);
          break;
        case 'k':
        case 'ArrowUp':
          event.preventDefault();
          step(-1, true);
          break;
        case '1':
          if (current) void updateTestState(engagementId, current.definition.id, { status: 'Not Tested' });
          break;
        case '2':
          if (current?.state.result) {
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
    try {
      await bulkUpdateTestStates(engagementId, ids, change);
      toast.success(message, `${ids.length} test${ids.length === 1 ? '' : 's'} updated.`);
      setSelected(new Set());
    } catch (error) {
      toast.error('Bulk update failed', error instanceof Error ? error.message : String(error));
    }
  }

  if (!items || !engagement) {
    return (
      <div className="grid gap-3 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <LoadingPanel rows={8} label="Loading tests" />
        <LoadingPanel rows={10} label="Loading test detail" />
      </div>
    );
  }

  const notTestedShown = visible.filter((i) => i.state.status === 'Not Tested').length;
  const showList = isWide || mobileView === 'list';
  const showDetail = isWide || mobileView === 'detail';

  return (
    <div className="space-y-3">
      {active && (
        <LiveAnnouncement
          message={`Test ${(activeIndex < 0 ? 0 : activeIndex) + 1} of ${visible.length}: ${
            active.definition.vulnerabilityName
          }. Priority ${active.definition.priority}. Status ${active.state.status}${
            active.state.result ? `, result ${active.state.result}` : ''
          }.`}
        />
      )}

      {/* Toolbar ----------------------------------------------------------- */}
      <Card className="space-y-2 py-3" as="section" aria-labelledby="workspace-filters">
        <h2 id="workspace-filters" className="sr-only">
          Search and filter tests
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
            />
            <Input
              id="workspace-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search tests by name, alias, ID, guidance or notes"
              placeholder="Search tests…  ( / )"
              className="pl-9"
            />
          </div>

          <Button
            variant={filtersOpen || activeFilters > 0 ? 'secondary' : 'subtle'}
            icon={<IconFilter size={14} />}
            aria-expanded={filtersOpen}
            aria-controls="workspace-filter-panel"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            Filters
            {activeFilters > 0 && (
              <span className="ml-1 rounded bg-brand-500 px-1.5 text-micro font-semibold text-ink-950">
                {activeFilters}
              </span>
            )}
          </Button>

          <FilterSelect
            label="Sort tests by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="w-auto min-w-36"
          >
            <option value="priority">Sort: Priority</option>
            <option value="status">Sort: Status</option>
            <option value="id">Sort: Test ID</option>
            <option value="name">Sort: Name</option>
            <option value="recent">Sort: Recently updated</option>
          </FilterSelect>
        </div>

        {filtersOpen && (
          <div
            id="workspace-filter-panel"
            className="animate-in grid gap-2 border-t border-ink-800 pt-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          >
            <FilterSelect
              label="Applicability"
              value={scope}
              onChange={(e) => setScope(e.target.value as ScopeFilter)}
            >
              {(Object.keys(SCOPE_LABELS) as ScopeFilter[]).map((key) => (
                <option key={key} value={key}>
                  {SCOPE_LABELS[key]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="all">Any status</option>
              <option value="Not Tested">Not Tested</option>
              <option value="Tested">Tested</option>
              <option value="N/A">N/A</option>
            </FilterSelect>
            <FilterSelect
              label="Result"
              value={result}
              onChange={(e) => setResult(e.target.value as ResultFilter)}
            >
              <option value="all">Any result</option>
              <option value="Vulnerable">Vulnerable</option>
              <option value="Not Vulnerable">Not Vulnerable</option>
            </FilterSelect>
            <FilterSelect label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="all">Any priority</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">Any category</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Subcategory"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
            >
              <option value="all">Any subcategory</option>
              {subcategoryOptions.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </FilterSelect>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink-800 pt-2.5 text-xs text-ink-400">
          <span aria-live="polite">
            <strong className="text-ink-100">{visible.length}</strong> shown ·{' '}
            <strong className="text-ink-200">{notTestedShown}</strong> Not Tested
          </span>
          {unconfirmedIds.size > 0 && scope !== 'unconfirmed' && (
            <button
              className="rounded text-amber-400 hover:underline"
              onClick={() => setScope('unconfirmed')}
            >
              {unconfirmedIds.size} unconfirmed
            </button>
          )}
          <button
            className={clsx('rounded hover:text-brand-400', selectionMode ? 'text-brand-400' : '')}
            aria-pressed={selectionMode}
            onClick={() => {
              setSelectionMode((v) => !v);
              setSelected(new Set());
            }}
          >
            {selectionMode ? 'Exit bulk edit' : 'Bulk edit'}
          </button>
          {selectionMode && (
            <button
              className="rounded hover:text-brand-400"
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
          {(activeFilters > 0 || query) && (
            <button className="ml-auto rounded hover:text-brand-400" onClick={resetFilters}>
              <IconX size={11} className="mr-1 inline" aria-hidden="true" />
              Clear filters
            </button>
          )}
          <span className="hidden w-full text-micro text-ink-500 xl:block">
            <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> status ·{' '}
            <kbd>v</kbd>/<kbd>b</kbd> result · <kbd>e</kbd> note · <kbd>⏎</kbd> next Not Tested ·{' '}
            <kbd>/</kbd> search
          </span>
        </div>
      </Card>

      {/* Bulk bar ---------------------------------------------------------- */}
      {selectionMode && selected.size > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="panel animate-in sticky top-16 z-30 flex flex-wrap items-center gap-2 border-brand-500/40 p-3"
        >
          <Badge tone="brand">{selected.size} selected</Badge>
          <Button size="sm" onClick={() => void bulk({ status: 'Not Tested' }, 'Set to Not Tested')}>
            Not Tested
          </Button>
          <Button
            size="sm"
            onClick={() =>
              void bulk({ status: 'Tested', result: 'Not Vulnerable' }, 'Set to Not Vulnerable')
            }
          >
            Tested → Not Vulnerable
          </Button>
          <Button
            size="sm"
            onClick={() => void bulk({ status: 'Tested', result: 'Vulnerable' }, 'Set to Vulnerable')}
          >
            Tested → Vulnerable
          </Button>
          <Button size="sm" onClick={() => void bulk({ status: 'N/A' }, 'Set to N/A')}>
            N/A
          </Button>
          <span className="mx-1 h-4 w-px bg-ink-700" aria-hidden="true" />
          <Button
            size="sm"
            variant="subtle"
            onClick={() =>
              void bulk({ applicable: true, applicabilitySource: 'manual' }, 'Marked Applicable')
            }
          >
            Applicable
          </Button>
          <Button
            size="sm"
            variant="subtle"
            onClick={() =>
              void bulk({ applicable: false, applicabilitySource: 'manual' }, 'Marked Not Applicable')
            }
          >
            Not Applicable
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Panes ------------------------------------------------------------- */}
      {visible.length === 0 ? (
        <EmptyState
          icon={<IconSearch size={28} />}
          title={query ? `No tests match “${query}”` : 'No tests match these filters'}
          description={
            query
              ? 'Search covers vulnerability names, aliases, test IDs, guidance and your notes. Try a shorter term, or clear the filters.'
              : 'Nothing in this engagement matches the current combination. Widen the applicability filter to include tests marked Not Applicable.'
          }
          action={
            <Button variant="secondary" onClick={resetFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(280px,340px)_1fr]">
          {showList && (
            <nav
              aria-label="Tests"
              className="panel max-h-[calc(100vh-16rem)] min-h-[20rem] overflow-y-auto p-0 lg:max-h-[calc(100vh-15rem)]"
            >
              <ul ref={listRef} className="divide-y divide-ink-800">
                {visible.map((item) => (
                  <TestListRow
                    key={item.definition.id}
                    item={item}
                    active={active?.definition.id === item.definition.id}
                    selected={selected.has(item.definition.id)}
                    selectionMode={selectionMode}
                    categoryLabel={categoryName(item.definition.category)}
                    unconfirmed={unconfirmedIds.has(item.definition.id)}
                    buttonRef={
                      active?.definition.id === item.definition.id ? activeRowRef : undefined
                    }
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
                ))}
              </ul>
            </nav>
          )}

          {showDetail && active && (
            <div className="panel max-h-[calc(100vh-15rem)] min-h-[24rem] overflow-hidden p-0">
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
                onBackToList={isWide ? undefined : () => setMobileView('list')}
                notesRef={notesRef}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
