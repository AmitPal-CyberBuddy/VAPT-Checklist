import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FilterSelect,
  Input,
  PageHeader,
  PriorityBadge,
  Stat,
} from '../../ui/primitives';
import {
  IconChevron,
  IconClock,
  IconCloud,
  IconCode,
  IconExternal,
  IconEye,
  IconFileText,
  IconFingerprint,
  IconGauge,
  IconGlobe,
  IconHexagon,
  IconKey,
  IconLock,
  IconMonitor,
  IconSearch,
  IconServer,
  IconSettings,
  IconShieldCheck,
  IconSmartphone,
  IconWorkflow,
  IconX,
} from '../../ui/icons';
import { CATEGORIES, CATEGORY_BY_ID, categoryName } from '../../data/categories';
import { LIBRARY_VERSION, SEARCH_INDEX, TEST_LIBRARY, libraryStats } from '../../data/library';
import { parseQuery, relevance } from '../../data/searchIndex';
import { resolveReferences } from '../../data/references';
import { describeRule } from '../../domain/applicability';
import { PRIORITIES, type CategoryId } from '../../domain/types';

/**
 * Read-only browser for the bundled knowledge base.
 * Engagement state is never shown here — this is the permanent test library.
 */
export default function LibraryPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [subcategory, setSubcategory] = useState('all');
  const [priority, setPriority] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const stats = useMemo(libraryStats, []);

  /* Deep links: the command palette (and shared URLs) can address one test
     directly with ?test=<id> — it arrives expanded and centred. */
  const [params] = useSearchParams();
  const testParam = params.get('test');
  useEffect(() => {
    if (!testParam) return;
    setOpen(testParam);
    document.getElementById(`library-test-${testParam}`)?.scrollIntoView?.({ block: 'center' });
  }, [testParam]);

  const subcategoryOptions: string[] = useMemo(() => {
    if (category !== 'all') return CATEGORY_BY_ID[category as CategoryId]?.subcategories ?? [];
    return Array.from(new Set(CATEGORIES.flatMap((c) => c.subcategories))).sort();
  }, [category]);

  const filtered = useMemo(() => {
    const terms = parseQuery(query);
    const matched = TEST_LIBRARY.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (subcategory !== 'all' && t.subcategory !== subcategory) return false;
      if (priority !== 'all' && t.priority !== priority) return false;
      if (terms.length === 0) return true;
      const entry = SEARCH_INDEX.get(t.id);
      return terms.every((term) => entry?.haystack.includes(term));
    });
    if (terms.length === 0) return matched;
    return [...matched].sort(
      (a, b) => relevance(SEARCH_INDEX.get(b.id), terms) - relevance(SEARCH_INDEX.get(a.id), terms),
    );
  }, [query, category, subcategory, priority]);

  /** Alias hits worth surfacing: the query matched a synonym, not the title. */
  const aliasHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return [];
    return filtered
      .filter(
        (t) =>
          !t.vulnerabilityName.toLowerCase().includes(q) &&
          (t.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
      )
      .slice(0, 4)
      .map((t) => ({
        id: t.id,
        name: t.vulnerabilityName,
        alias: (t.aliases ?? []).find((a) => a.toLowerCase().includes(q))!,
      }));
  }, [filtered, query]);

  const filtersActive =
    query !== '' || category !== 'all' || subcategory !== 'all' || priority !== 'all';

  /** Catalog sections: keep the canonical taxonomy order, drop empty groups. */
  const grouped = useMemo(() => {
    const byCategory = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const list = byCategory.get(t.category) ?? [];
      list.push(t);
      byCategory.set(t.category, list);
    }
    return CATEGORIES.filter((c) => byCategory.has(c.id)).map((c) => ({
      category: c,
      tests: byCategory.get(c.id)!,
    }));
  }, [filtered]);

  /* Severity rail per priority — colour + position, never colour alone. */
  const PRIORITY_RAIL: Record<string, string> = {
    Critical: 'border-l-vuln-500/80',
    High: 'border-l-high-500/70',
    Medium: 'border-l-medium-400/60',
    Low: 'border-l-brand-500/40',
  };

  /* One glyph per category, so the taxonomy reads at a glance. */
  const CATEGORY_ICON: Record<CategoryId, ReactElement> = {
    recon: <IconSearch size={15} aria-hidden="true" />,
    config: <IconSettings size={15} aria-hidden="true" />,
    transport: <IconGlobe size={15} aria-hidden="true" />,
    authentication: <IconKey size={15} aria-hidden="true" />,
    session: <IconClock size={15} aria-hidden="true" />,
    authorization: <IconLock size={15} aria-hidden="true" />,
    'input-validation': <IconCode size={15} aria-hidden="true" />,
    'client-side': <IconMonitor size={15} aria-hidden="true" />,
    'business-logic': <IconWorkflow size={15} aria-hidden="true" />,
    cryptography: <IconFingerprint size={15} aria-hidden="true" />,
    'file-handling': <IconFileText size={15} aria-hidden="true" />,
    api: <IconServer size={15} aria-hidden="true" />,
    graphql: <IconHexagon size={15} aria-hidden="true" />,
    disclosure: <IconEye size={15} aria-hidden="true" />,
    availability: <IconGauge size={15} aria-hidden="true" />,
    privacy: <IconShieldCheck size={15} aria-hidden="true" />,
    cloud: <IconCloud size={15} aria-hidden="true" />,
    mobile: <IconSmartphone size={15} aria-hidden="true" />,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Test library"
        eyebrow="Reference library"
        description="The permanent VAPT knowledge base bundled with the application. Definitions are immutable — engagements reference them by ID and hold their own status, result and notes."
      />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Tests" value={stats.total} tone="brand" hint={`Library v${LIBRARY_VERSION}`} />
        <Stat
          label="Taxonomy"
          value={CATEGORIES.length}
          hint={`${CATEGORIES.reduce((n, c) => n + c.subcategories.length, 0)} subcategories`}
        />
        <Stat label="Aliases" value={stats.aliases} hint="searchable synonyms" />
        <Stat
          label="Context-driven"
          value={stats.contextDriven}
          hint={`${stats.baseline} baseline tests`}
        />
        <Stat label="Critical" value={stats.byPriority.Critical} tone="vuln" />
        <Stat label="High" value={stats.byPriority.High} tone="warn" />
      </div>

      {/* Two-pane knowledge base: a persistent taxonomy tree on wide screens
          (sticky, with subcategories under the selected domain), a horizontal
          chip strip on narrow ones — the layout recomposes, it does not
          shrink. */}
      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside aria-label="Library navigation" className="min-w-0">
          {/* Desktop tree */}
          <nav className="sticky top-16 hidden max-h-[calc(100vh-6rem)] flex-col gap-0.5 overflow-y-auto rounded-(--radius-panel) border border-ink-700 bg-ink-900 p-2.5 shadow-(--shadow-panel) lg:top-3 lg:flex">
            <p className="section-kicker mb-1.5 px-2">Taxonomy</p>
            <button
              type="button"
              aria-pressed={category === 'all'}
              onClick={() => {
                setCategory('all');
                setSubcategory('all');
              }}
              className={clsx(
                'flex items-center gap-2 rounded-(--radius-control) border px-2.5 py-1.5 text-left text-xs transition-colors duration-150',
                category === 'all'
                  ? 'border-brand-500/60 bg-brand-500/15 text-brand-400'
                  : 'border-transparent text-ink-300 hover:bg-ink-850 hover:text-ink-100',
              )}
            >
              <span className="flex-1">All categories</span>
              <span className="rounded bg-ink-800 px-1.5 font-mono text-micro tabular-nums text-ink-300">
                {stats.total}
              </span>
            </button>
            {CATEGORIES.map((c) => {
              const selected = category === c.id;
              const subcounts = selected
                ? CATEGORY_BY_ID[c.id]?.subcategories
                    .map((sub) => ({
                      sub,
                      count: TEST_LIBRARY.filter((t) => t.category === c.id && t.subcategory === sub)
                        .length,
                    }))
                    .filter((s) => s.count > 0) ?? []
                : [];
              return (
                <div key={c.id} className="rounded-(--radius-control)">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setCategory(selected ? 'all' : c.id);
                      setSubcategory('all');
                    }}
                    className={clsx(
                      'flex w-full items-center gap-2 rounded-(--radius-control) border px-2.5 py-1.5 text-left text-xs transition-colors duration-150',
                      selected
                        ? 'border-brand-500/60 bg-brand-500/15 text-brand-400'
                        : 'border-transparent text-ink-300 hover:bg-ink-850 hover:text-ink-100',
                    )}
                  >
                    <span className="text-brand-500/80">{CATEGORY_ICON[c.id]}</span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="rounded bg-ink-800 px-1.5 font-mono text-micro tabular-nums text-ink-300">
                      {stats.byCategory[c.id] ?? 0}
                    </span>
                  </button>
                  {selected && subcounts.length > 0 && (
                    <div className="mt-0.5 space-y-0.5 border-l border-ink-700 pl-2 ml-3">
                      <button
                        type="button"
                        aria-pressed={subcategory === 'all'}
                        onClick={() => setSubcategory('all')}
                        className={clsx(
                          'w-full rounded px-2 py-1 text-left text-micro transition-colors',
                          subcategory === 'all'
                            ? 'bg-brand-500/10 font-medium text-brand-400'
                            : 'text-ink-400 hover:bg-ink-850 hover:text-ink-200',
                        )}
                      >
                        All in category
                      </button>
                      {subcounts.map(({ sub, count }) => (
                        <button
                          key={sub}
                          type="button"
                          aria-pressed={subcategory === sub}
                          onClick={() => setSubcategory(subcategory === sub ? 'all' : sub)}
                          className={clsx(
                            'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-micro transition-colors',
                            subcategory === sub
                              ? 'bg-brand-500/10 font-medium text-brand-400'
                              : 'text-ink-400 hover:bg-ink-850 hover:text-ink-200',
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{sub}</span>
                          <span className="tabular-nums text-ink-500">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Mobile chip strip */}
          <nav aria-label="Library categories" className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            <button
              type="button"
              aria-pressed={category === 'all'}
              onClick={() => {
                setCategory('all');
                setSubcategory('all');
              }}
              className={clsx(
                'inline-flex shrink-0 items-center gap-1.5 rounded-(--radius-control) border px-2.5 py-1 text-xs transition-colors duration-150',
                category === 'all'
                  ? 'border-brand-500/60 bg-brand-500/15 text-brand-400'
                  : 'border-ink-700 bg-ink-900 text-ink-300',
              )}
            >
              All
              <span className="font-mono text-micro tabular-nums text-ink-400">{stats.total}</span>
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => {
                  setCategory(category === c.id ? 'all' : c.id);
                  setSubcategory('all');
                }}
                className={clsx(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-(--radius-control) border px-2.5 py-1 text-xs transition-colors duration-150',
                  category === c.id
                    ? 'border-brand-500/60 bg-brand-500/15 text-brand-400'
                    : 'border-ink-700 bg-ink-900 text-ink-300',
                )}
              >
                <span className="text-brand-500/70">{CATEGORY_ICON[c.id]}</span>
                {c.name}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
      <Card className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <IconSearch
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the test library"
            placeholder="Search name, alias, ID, guidance, CWE, OWASP…"
            className="pl-9"
          />
        </div>
        <FilterSelect
          label="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setSubcategory('all');
          }}
          className="w-56"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({stats.byCategory[c.id] ?? 0})
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Subcategory"
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
          className="w-52"
        >
          <option value="all">All subcategories</option>
          {subcategoryOptions.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-40">
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </FilterSelect>
        <span className="text-xs text-ink-500">{filtered.length} shown</span>
        {filtersActive && (
          <button
            className="flex items-center gap-1 text-xs text-ink-400 hover:text-brand-400"
            onClick={() => {
              setQuery('');
              setCategory('all');
              setSubcategory('all');
              setPriority('all');
            }}
          >
            <IconX size={12} /> Clear
          </button>
        )}
      </Card>

      {aliasHits.length > 0 && (
        <div className="rounded-(--radius-control) border border-brand-500/25 bg-brand-500/5 px-3 py-2 text-xs text-ink-300">
          Matched on synonyms:{' '}
          {aliasHits.map((hit, index) => (
            <span key={hit.id}>
              {index > 0 && ' · '}
              <button className="text-brand-400 hover:underline" onClick={() => setOpen(hit.id)}>
                “{hit.alias}” → {hit.name}
              </button>
            </span>
          ))}
        </div>
      )}

      <Card className="p-0">
        {filtered.length === 0 && (
          <EmptyState
            compact
            icon={<IconSearch size={24} />}
            title={query ? `No tests match “${query}”` : 'No tests match those filters'}
            description="Search covers vulnerability names, aliases, test IDs, descriptions, guidance and standards codes."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                  setSubcategory('all');
                  setPriority('all');
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}

        {grouped.map(({ category, tests }) => (
          <Card
            key={category.id}
            as="section"
            aria-labelledby={`library-cat-${category.id}`}
            className="scroll-reveal overflow-hidden rounded-(--radius-panel) p-0"
          >
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-800 bg-ink-850/60 px-4 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-(--radius-control) border border-ink-700 bg-ink-900 text-brand-400">
                {CATEGORY_ICON[category.id]}
              </span>
              <h3 id={`library-cat-${category.id}`} className="text-sm font-semibold text-ink-100">
                {category.name}
              </h3>
              <span className="rounded-md border border-ink-600 px-1.5 py-0.5 font-mono text-micro tabular-nums text-ink-400">
                {tests.length}
              </span>
              <span className="ml-auto hidden text-micro text-ink-500 sm:inline">
                {(category as { subcategories?: string[] }).subcategories?.length ?? 0} subcategories
              </span>
            </header>
            <ul className="list-none divide-y divide-ink-800">
              {tests.map((t) => {
                const expanded = open === t.id;
                return (
                  <li
                    key={t.id}
                    id={`library-test-${t.id}`}
                    className={clsx('border-l-2', PRIORITY_RAIL[t.priority])}
                  >
                    <button
                      onClick={() => setOpen(expanded ? null : t.id)}
                      aria-expanded={expanded}
                      className="group flex w-full items-center gap-3 py-2.5 pr-4 pl-3 text-left transition-colors duration-150 hover:bg-ink-850/70"
                    >
                      <IconChevron
                        size={14}
                        className={clsx(
                          'row-open shrink-0 text-ink-500 transition-transform duration-150',
                          expanded && 'rotate-90 text-brand-400',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        {/* The vulnerability name is the primary element. */}
                        <span
                          className={clsx(
                            'block truncate text-base leading-snug',
                            expanded ? 'font-semibold text-ink-50' : 'font-medium text-ink-100',
                          )}
                        >
                          {t.vulnerabilityName}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-micro text-ink-500">
                          <span className="font-mono">{t.id}</span>
                          <span aria-hidden="true">·</span>
                          <span>{t.subcategory}</span>
                          <span aria-hidden="true">·</span>
                          <span>{categoryName(t.category)}</span>
                        </span>
                      </span>
                      <PriorityBadge priority={t.priority} />
                    </button>
                    {expanded && (
                      <div className="animate-in grid gap-5 border-t border-ink-800 bg-ink-950/40 px-4 py-4 pl-[3.6rem] lg:grid-cols-2 lg:gap-8">
                        <div className="space-y-4">
                          <div>
                            <p className="section-kicker mb-1">Description</p>
                            <p className="text-sm leading-relaxed text-ink-200">{t.description}</p>
                          </div>
                          {t.aliases && t.aliases.length > 0 && (
                            <div>
                              <p className="section-kicker mb-1">Also known as</p>
                              <div className="flex flex-wrap gap-1.5">
                                {t.aliases.map((alias) => (
                                  <Badge key={alias} tone="neutral">
                                    {alias}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="section-kicker mb-1">Applicability rule</p>
                            <code className="rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-ink-300">
                              {describeRule(t.applicability)}
                            </code>
                          </div>
                          {((t.owasp && t.owasp.length > 0) || (t.cwe && t.cwe.length > 0)) && (
                            <div>
                              <p className="section-kicker mb-1">Standards mapping</p>
                              <p className="font-mono text-xs text-ink-400">
                                {t.owasp && t.owasp.length > 0 && `OWASP ${t.owasp.join(', ')}`}
                                {t.owasp && t.owasp.length > 0 && t.cwe && t.cwe.length > 0 && ' · '}
                                {t.cwe && t.cwe.length > 0 && `CWE ${t.cwe.join(', ')}`}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="section-kicker mb-1">Testing guidance</p>
                            <ol className="panel-inset space-y-2 p-3 text-sm text-ink-200">
                              {t.testingGuidance.map((g, i) => (
                                <li key={i} className="flex gap-2.5">
                                  <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded bg-ink-800 font-mono text-micro text-brand-400">
                                    {i + 1}
                                  </span>
                                  <span className="leading-relaxed">{g}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                          <div>
                            <p className="section-kicker mb-1">References</p>
                            <div className="flex flex-wrap gap-1.5">
                              {resolveReferences(t).map((reference) => (
                                <a
                                  key={reference.label}
                                  href={reference.url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex items-center gap-1 rounded-md border border-ink-600 px-1.5 py-0.5 text-micro text-ink-300 transition-colors hover:border-brand-500/50 hover:text-brand-400"
                                >
                                  {reference.label}
                                  <IconExternal size={10} />
                                  <span className="sr-only">(opens in a new tab)</span>
                                </a>
                              ))}
                            </div>
                          </div>
                          {t.tags && t.tags.length > 0 && (
                            <div className="flex flex-wrap gap-x-2 gap-y-1">
                              {t.tags.map((tag) => (
                                <span key={tag} className="text-micro text-ink-500">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </Card>
        </div>
      </div>
    </div>
  );
}
