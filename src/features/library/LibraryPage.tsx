import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Badge, Card, Input, Select, Stat, priorityTone } from '../../ui/primitives';
import { IconChevron, IconSearch } from '../../ui/icons';
import { CATEGORIES, categoryName } from '../../data/categories';
import { LIBRARY_VERSION, TEST_LIBRARY, libraryStats } from '../../data/library';
import { describeRule } from '../../domain/applicability';
import { PRIORITIES } from '../../domain/types';

/**
 * Read-only browser for the bundled knowledge base.
 * Engagement state is never shown here — this is the permanent test library.
 */
export default function LibraryPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [priority, setPriority] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const stats = useMemo(libraryStats, []);

  const filtered = TEST_LIBRARY.filter((t) => {
    if (category !== 'all' && t.category !== category) return false;
    if (priority !== 'all' && t.priority !== priority) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${t.id} ${t.vulnerabilityName} ${t.description} ${(t.tags ?? []).join(' ')} ${(t.owasp ?? []).join(' ')} ${(t.cwe ?? []).join(' ')}`
      .toLowerCase()
      .includes(q);
  });

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
        <Stat label="Categories" value={CATEGORIES.length} />
        {PRIORITIES.map((p) => (
          <Stat key={p} label={p} value={stats.byPriority[p]} />
        ))}
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
            placeholder="Search vulnerabilities, CWE, OWASP references…"
            className="pl-9"
          />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-56">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({stats.byCategory[c.id] ?? 0})
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
      </Card>

      <Card className="p-0">
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
                  className={clsx('shrink-0 text-ink-600 transition-transform', expanded && 'rotate-90')}
                />
                <span className="font-mono text-[11px] text-ink-600">{t.id}</span>
                <span className="flex-1 truncate text-sm text-ink-100">{t.vulnerabilityName}</span>
                <span className="hidden text-xs text-ink-500 md:inline">{categoryName(t.category)}</span>
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
                    <div>
                      <p className="mb-1 text-[11px] tracking-wider text-ink-400 uppercase">
                        Applicability rule
                      </p>
                      <p className="font-mono text-xs text-ink-300">{describeRule(t.applicability)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(t.owasp ?? []).map((o) => (
                        <Badge key={o} tone="neutral">
                          {o}
                        </Badge>
                      ))}
                      {(t.cwe ?? []).map((c) => (
                        <Badge key={c} tone="brand">
                          {c}
                        </Badge>
                      ))}
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
