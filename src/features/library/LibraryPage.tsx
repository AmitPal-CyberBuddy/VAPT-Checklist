import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Badge, Card, Input, Select, Stat, priorityTone } from '../../ui/primitives';
import { IconChevron, IconExternal, IconSearch, IconX } from '../../ui/icons';
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">Test library</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-400">
          The permanent VAPT knowledge base bundled with the application. Definitions are immutable
          — engagements reference them by ID and hold their own status, result and notes.
        </p>
      </div>

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

      <Card className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <IconSearch
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, alias, ID, guidance, CWE, OWASP…"
            className="pl-9"
          />
        </div>
        <Select
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
        </Select>
        <Select
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
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-40">
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
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
        <div className="rounded-lg border border-brand-500/25 bg-brand-500/5 px-3 py-2 text-xs text-ink-300">
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
          <p className="px-4 py-10 text-center text-sm text-ink-500">
            Nothing matches those filters.
          </p>
        )}
        {filtered.map((t) => {
          const expanded = open === t.id;
          return (
            <div key={t.id} className="border-t border-ink-850 first:border-t-0">
              <button
                onClick={() => setOpen(expanded ? null : t.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ink-900/60"
              >
                <IconChevron
                  size={14}
                  className={clsx(
                    'shrink-0 text-ink-600 transition-transform',
                    expanded && 'rotate-90',
                  )}
                />
                <span className="font-mono text-[11px] text-ink-600">{t.id}</span>
                <span className="flex-1 truncate text-sm text-ink-100">{t.vulnerabilityName}</span>
                <span className="hidden text-xs text-ink-500 md:inline">{t.subcategory}</span>
                <span className="hidden text-xs text-ink-600 lg:inline">
                  {categoryName(t.category)}
                </span>
                <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
              </button>
              {expanded && (
                <div className="animate-in grid gap-4 border-t border-ink-850 bg-ink-950/40 px-4 py-4 pl-11 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-[11px] tracking-wider text-ink-400 uppercase">
                        Description
                      </p>
                      <p className="text-sm leading-relaxed text-ink-200">{t.description}</p>
                    </div>
                    {t.aliases && t.aliases.length > 0 && (
                      <div>
                        <p className="mb-1 text-[11px] tracking-wider text-ink-400 uppercase">
                          Also known as
                        </p>
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
                      <p className="mb-1 text-[11px] tracking-wider text-ink-400 uppercase">
                        Applicability rule
                      </p>
                      <p className="font-mono text-xs text-ink-300">
                        {describeRule(t.applicability)}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] tracking-wider text-ink-400 uppercase">
                        References
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {resolveReferences(t).map((reference) => (
                          <a
                            key={reference.label}
                            href={reference.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 rounded-md border border-ink-600 px-1.5 py-0.5 text-[11px] text-ink-300 hover:border-brand-500/50 hover:text-brand-400"
                          >
                            {reference.label}
                            <IconExternal size={10} />
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] tracking-wider text-ink-400 uppercase">
                      Testing guidance
                    </p>
                    <ol className="space-y-1.5 text-sm text-ink-300">
                      {t.testingGuidance.map((g, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-ink-800 text-[10px] text-ink-400">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{g}</span>
                        </li>
                      ))}
                    </ol>
                    {t.tags && t.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {t.tags.map((tag) => (
                          <span key={tag} className="text-[11px] text-ink-600">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
