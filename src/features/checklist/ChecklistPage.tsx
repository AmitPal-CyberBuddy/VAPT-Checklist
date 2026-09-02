import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Badge, Button, Card, EmptyState, Input, Select } from '../../ui/primitives';
import { IconFilter, IconSearch, IconX } from '../../ui/icons';
import { ChecklistRow } from './ChecklistRow';
import { CATEGORIES } from '../../data/categories';
import { useChecklist, useEngagement } from '../../hooks/useData';
import { bulkUpdateTestStates } from '../../persistence/repository';
import { PRIORITY_ORDER, PRIORITIES, type ChecklistItem } from '../../domain/types';
import type { ApplicationContext } from '../../domain/context';
import { toast } from '../../ui/toast';

type ScopeFilter = 'applicable' | 'excluded' | 'all';
type StatusFilter = 'all' | 'Not Tested' | 'Tested' | 'N/A' | 'awaiting';
type ResultFilter = 'all' | 'Vulnerable' | 'Not Vulnerable';
type GroupBy = 'category' | 'priority' | 'none';

export default function ChecklistPage() {
  const { engagementId = '' } = useParams();
  const engagement = useEngagement(engagementId);
  const items = useChecklist(engagementId);
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('applicable');
  const [status, setStatus] = useState<StatusFilter>(
    params.get('view') === 'awaiting' ? 'awaiting' : 'all',
  );
  const [result, setResult] = useState<ResultFilter>(
    (params.get('result') as ResultFilter) ?? 'all',
  );
  const [category, setCategory] = useState<string>('all');
  const [priority, setPriority] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const focusTest = params.get('test');

  useEffect(() => {
    if (focusTest) setExpanded((prev) => new Set(prev).add(focusTest));
  }, [focusTest]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter(({ definition: d, state: s }) => {
      if (scope === 'applicable' && !s.applicable) return false;
      if (scope === 'excluded' && s.applicable) return false;
      if (status === 'awaiting' && !(s.applicable && s.status === 'Tested' && !s.result)) return false;
      if (status !== 'all' && status !== 'awaiting' && s.status !== status) return false;
      if (result !== 'all' && s.result !== result) return false;
      if (category !== 'all' && d.category !== category) return false;
      if (priority !== 'all' && d.priority !== priority) return false;
      if (q) {
        const haystack = `${d.id} ${d.vulnerabilityName} ${d.description} ${(d.tags ?? []).join(' ')} ${(d.owasp ?? []).join(' ')} ${s.notes}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, scope, status, result, category, priority]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: `${filtered.length} tests`, items: filtered }];
    if (groupBy === 'priority') {
      return PRIORITIES.map((p) => ({
        key: p,
        label: p,
        items: filtered.filter((i) => i.definition.priority === p),
      })).filter((g) => g.items.length > 0);
    }
    return CATEGORIES.map((c) => ({
      key: c.id,
      label: c.name,
      items: filtered
        .filter((i) => i.definition.category === c.id)
        .sort(
          (a, b) =>
            PRIORITY_ORDER[a.definition.priority] - PRIORITY_ORDER[b.definition.priority] ||
            a.definition.id.localeCompare(b.definition.id),
        ),
    })).filter((g) => g.items.length > 0);
  }, [filtered, groupBy]);

  const activeFilters =
    (query ? 1 : 0) +
    (scope !== 'applicable' ? 1 : 0) +
    (status !== 'all' ? 1 : 0) +
    (result !== 'all' ? 1 : 0) +
    (category !== 'all' ? 1 : 0) +
    (priority !== 'all' ? 1 : 0);

  function resetFilters() {
    setQuery('');
    setScope('applicable');
    setStatus('all');
    setResult('all');
    setCategory('all');
    setPriority('all');
    setParams({}, { replace: true });
  }

  function toggle(set: Set<string>, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  async function bulk(change: Parameters<typeof bulkUpdateTestStates>[2], message: string) {
    const ids = [...selected];
    await bulkUpdateTestStates(engagementId, ids, change);
    toast.success(message, `${ids.length} test${ids.length === 1 ? '' : 's'} updated.`);
    setSelected(new Set());
  }

  if (!items || !engagement) return <Card className="text-sm text-ink-400">Loading checklist…</Card>;

  return (
    <div className="space-y-4">
      {/* Filter bar -------------------------------------------------------- */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <IconSearch
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vulnerability, ID, guidance, notes…"
              className="pl-9"
            />
          </div>

          <Select value={scope} onChange={(e) => setScope(e.target.value as ScopeFilter)} className="w-40">
            <option value="applicable">In scope</option>
            <option value="excluded">Excluded</option>
            <option value="all">All tests</option>
          </Select>

          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="w-40">
            <option value="all">Any status</option>
            <option value="Not Tested">Not Tested</option>
            <option value="Tested">Tested</option>
            <option value="N/A">N/A</option>
            <option value="awaiting">Awaiting result</option>
          </Select>

          <Select value={result} onChange={(e) => setResult(e.target.value as ResultFilter)} className="w-40">
            <option value="all">Any result</option>
            <option value="Vulnerable">Vulnerable</option>
            <option value="Not Vulnerable">Not Vulnerable</option>
          </Select>

          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-36">
            <option value="all">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>

          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-52">
            <option value="all">Any category</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="w-40">
            <option value="category">Group by category</option>
            <option value="priority">Group by priority</option>
            <option value="none">No grouping</option>
          </Select>

          {activeFilters > 0 && (
            <Button size="sm" variant="ghost" icon={<IconX size={13} />} onClick={resetFilters}>
              Clear
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-ink-800 pt-3 text-xs text-ink-500">
          <span className="flex items-center gap-1.5">
            <IconFilter size={13} />
            Showing <strong className="text-ink-200">{filtered.length}</strong> of {items.length} tests
          </span>
          <button
            className="text-ink-400 hover:text-brand-400"
            onClick={() =>
              setExpanded(
                expanded.size > 0 ? new Set() : new Set(filtered.map((i) => i.definition.id)),
              )
            }
          >
            {expanded.size > 0 ? 'Collapse all' : 'Expand all'}
          </button>
          <button
            className="text-ink-400 hover:text-brand-400"
            onClick={() =>
              setSelected(
                selected.size === filtered.length
                  ? new Set()
                  : new Set(filtered.map((i) => i.definition.id)),
              )
            }
          >
            {selected.size === filtered.length && filtered.length > 0
              ? 'Deselect all'
              : 'Select all shown'}
          </button>
        </div>
      </Card>

      {/* Bulk action bar --------------------------------------------------- */}
      {selected.size > 0 && (
        <div className="panel animate-in sticky top-16 z-30 flex flex-wrap items-center gap-2 border-brand-500/30 bg-ink-900/95 p-3">
          <Badge tone="brand">{selected.size} selected</Badge>
          <span className="text-xs text-ink-500">Bulk update:</span>
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
            onClick={() =>
              void bulk({ applicable: true, applicabilitySource: 'manual' }, 'Included in scope')
            }
          >
            Include
          </Button>
          <Button
            size="sm"
            variant="subtle"
            onClick={() =>
              void bulk({ applicable: false, applicabilitySource: 'manual' }, 'Excluded from scope')
            }
          >
            Exclude
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      {/* Groups ------------------------------------------------------------ */}
      {filtered.length === 0 ? (
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
        groups.map((group) => (
          <GroupPanel
            key={group.key}
            label={group.label}
            items={group.items}
            engagementId={engagementId}
            context={engagement.context}
            expanded={expanded}
            selected={selected}
            focusTest={focusTest}
            onToggleExpand={(id) => setExpanded((prev) => toggle(prev, id))}
            onToggleSelect={(id) => setSelected((prev) => toggle(prev, id))}
          />
        ))
      )}
    </div>
  );
}

function GroupPanel({
  label,
  items,
  engagementId,
  context,
  expanded,
  selected,
  focusTest,
  onToggleExpand,
  onToggleSelect,
}: {
  label: string;
  items: ChecklistItem[];
  engagementId: string;
  context: ApplicationContext;
  expanded: Set<string>;
  selected: Set<string>;
  focusTest: string | null;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string) => void;
}) {
  const done = items.filter(
    (i) => i.state.applicable && (i.state.status === 'N/A' || (i.state.status === 'Tested' && i.state.result)),
  ).length;
  const applicable = items.filter((i) => i.state.applicable).length;
  const vulnerable = items.filter((i) => i.state.result === 'Vulnerable').length;

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center gap-3 border-b border-ink-800 bg-ink-900/60 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-ink-100">{label}</h3>
        <span className="text-[11px] text-ink-500">
          {done}/{applicable} resolved
        </span>
        {vulnerable > 0 && <Badge tone="vulnerable">{vulnerable} vulnerable</Badge>}
        <span className={clsx('ml-auto text-[11px] text-ink-600')}>{items.length} shown</span>
      </header>
      <div>
        {items.map((item) => (
          <ChecklistRow
            key={item.definition.id}
            item={item}
            engagementId={engagementId}
            context={context}
            expanded={expanded.has(item.definition.id)}
            onToggleExpand={() => onToggleExpand(item.definition.id)}
            selected={selected.has(item.definition.id)}
            onToggleSelect={() => onToggleSelect(item.definition.id)}
            highlighted={focusTest === item.definition.id}
          />
        ))}
      </div>
    </section>
  );
}
