/**
 * Command palette — Ctrl/⌘-K anywhere in the console.
 *
 * A keyboard-first navigation layer over the whole product: screens,
 * engagements and the bundled test library. It is pure navigation — it never
 * writes data — so it is UI surface, not product behaviour.
 *
 * Results are grouped and ranked, arrows move, Enter follows, Escape closes
 * and returns focus to the trigger. Every result is a real anchor, so the
 * browser's own affordances (focus, middle-click, copy link) keep working.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  IconBook,
  IconChevron,
  IconGrid,
  IconPlus,
  IconSearch,
  IconSettings,
} from './icons';
import { PriorityBadge } from './primitives';
import { TEST_LIBRARY } from '../data/library';
import { categoryName } from '../data/categories';
import { applicationTypeLabel } from '../domain/applicationType';
import type { Engagement, TestDefinition } from '../domain/types';

/** The platform-correct shortcut label shown on triggers and hints. */
const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
export const PALETTE_KBD = IS_MAC ? '⌘ K' : 'Ctrl K';

interface PaletteItem {
  key: string;
  group: 'Navigate' | 'Engagements' | 'Test library';
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Trailing metadata, e.g. the priority badge on a test result. */
  meta?: ReactNode;
  to: string;
}

const DESTINATIONS: PaletteItem[] = [
  {
    key: 'nav-engagements',
    group: 'Navigate',
    icon: <IconGrid size={15} aria-hidden="true" />,
    title: 'Engagements',
    subtitle: 'The assessment register',
    to: '/engagements',
  },
  {
    key: 'nav-new',
    group: 'Navigate',
    icon: <IconPlus size={15} aria-hidden="true" />,
    title: 'New engagement',
    subtitle: 'Start an assessment',
    to: '/engagements/new',
  },
  {
    key: 'nav-library',
    group: 'Navigate',
    icon: <IconBook size={15} aria-hidden="true" />,
    title: 'Test Library',
    subtitle: 'The bundled methodology knowledge base',
    to: '/library',
  },
  {
    key: 'nav-settings',
    group: 'Navigate',
    icon: <IconSettings size={15} aria-hidden="true" />,
    title: 'Data & Settings',
    subtitle: 'Backup, restore and local storage',
    to: '/settings',
  },
];

/** Does this item answer the query? Title, subtitle and keywords all count. */
function matches(item: PaletteItem, q: string): boolean {
  if (!q) return true;
  return (
    item.title.toLowerCase().includes(q) ||
    (item.subtitle?.toLowerCase().includes(q) ?? false)
  );
}

function engagementItem(engagement: Engagement): PaletteItem {
  return {
    key: `eng-${engagement.id}`,
    group: 'Engagements',
    icon: <IconGrid size={15} aria-hidden="true" />,
    title: engagement.name,
    subtitle: [
      applicationTypeLabel(engagement.applicationType),
      engagement.clientName,
    ]
      .filter(Boolean)
      .join(' · '),
    to: `/e/${engagement.id}`,
  };
}

/** Light-weight library search: name, aliases, ID and category. */
function libraryMatches(q: string): TestDefinition[] {
  const scored: { test: TestDefinition; score: number }[] = [];
  for (const test of TEST_LIBRARY) {
    const name = test.vulnerabilityName.toLowerCase();
    let score = 0;
    if (name.startsWith(q)) score = 4;
    else if (name.includes(q)) score = 3;
    else if (test.aliases?.some((a) => a.toLowerCase().includes(q))) score = 2;
    else if (test.id.toLowerCase().includes(q)) score = 2;
    else if (categoryName(test.category).toLowerCase().includes(q)) score = 1;
    if (score > 0) scored.push({ test, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.test.id.localeCompare(b.test.id))
    .slice(0, 7)
    .map((s) => s.test);
}

export function CommandPalette({
  open,
  onOpenChange,
  engagements,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagements: Engagement[];
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const openRef = useRef(open);
  openRef.current = open;

  const q = query.trim().toLowerCase();

  const results = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = DESTINATIONS.filter((d) => matches(d, q));

    const engagementItems = engagements
      .filter((e) =>
        q === ''
          ? true
          : e.name.toLowerCase().includes(q) ||
            (e.clientName?.toLowerCase().includes(q) ?? false) ||
            applicationTypeLabel(e.applicationType).toLowerCase().includes(q),
      )
      .slice(0, q === '' ? 5 : 8)
      .map(engagementItem);
    items.push(...engagementItems);

    if (q !== '') {
      for (const test of libraryMatches(q)) {
        items.push({
          key: `test-${test.id}`,
          group: 'Test library',
          icon: <IconBook size={15} aria-hidden="true" />,
          title: test.vulnerabilityName,
          subtitle: `${test.id} · ${categoryName(test.category)} · ${test.subcategory}`,
          meta: <PriorityBadge priority={test.priority} />,
          to: `/library?test=${test.id}`,
        });
      }
    }
    return items;
  }, [q, engagements]);

  // Keep the highlight inside the result set as it shrinks.
  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const go = useCallback(
    (item: PaletteItem) => {
      onOpenChange(false);
      setQuery('');
      navigate(item.to);
    },
    [navigate, onOpenChange],
  );

  /* Global shortcut: Ctrl/⌘-K toggles the palette from anywhere. */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!openRef.current);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpenChange]);

  /* While open: Escape closes, and the field takes focus on arrival. */
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    inputRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  /* On close, hand focus back to whichever trigger is on screen — but only
     after a real session, so mounting never steals page focus. */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const wide =
      typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;
    const id = wide ? 'command-palette-trigger' : 'command-palette-trigger-bar';
    document.getElementById(id)?.focus?.();
  }, [open]);

  // Follow the highlight with focus so Enter and screen readers agree.
  useEffect(() => {
    itemRefs.current[active]?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  if (!open) return null;

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const next = (active + direction + results.length) % results.length;
      setActive(next);
      itemRefs.current[next]?.focus();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (results[active]) go(results[active]);
    }
  }

  /* Render groups in order, labelling the first row of each. */
  const grouped: { label: string; items: { item: PaletteItem; index: number }[] }[] = [];
  results.forEach((item, index) => {
    const last = grouped[grouped.length - 1];
    if (last && last.label === item.group) last.items.push({ item, index });
    else grouped.push({ label: item.group, items: [{ item, index }] });
  });

  return (
    <div
      className="animate-in fixed inset-0 z-[70] flex items-start justify-center bg-ink-950/70 px-3 pt-[10vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="palette-panel relative w-full max-w-xl"
      >
        <div className="flex items-center gap-2.5 border-b border-ink-800 px-4 py-3">
          <IconSearch size={16} aria-hidden="true" className="shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            aria-label="Search commands, engagements and tests"
            placeholder="Search engagements, tests, screens…"
            autoComplete="off"
            spellCheck={false}
            className="h-7 w-full bg-transparent text-base text-ink-50 outline-none placeholder:text-ink-500"
          />
          <kbd aria-hidden="true">esc</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-400">
              No matches for “{query}”.
            </p>
          ) : (
            grouped.map(({ label, items }) => (
              <div key={label} className="mb-1 last:mb-0">
                <p className="palette-group section-kicker px-3 pt-2 pb-1">{label}</p>
                {items.map(({ item, index }) => (
                  <a
                    key={item.key}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    href={`#${item.to}`}
                    data-active={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={(event) => {
                      event.preventDefault();
                      go(item);
                    }}
                    className="palette-item flex items-center gap-3 rounded-(--radius-control) px-3 py-2 text-left"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-(--radius-control) border border-ink-700 bg-ink-900 text-ink-300">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-100">{item.title}</span>
                      {item.subtitle && (
                        <span className="block truncate text-micro text-ink-400">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    {item.meta}
                    <IconChevron
                      size={13}
                      aria-hidden="true"
                      className={clsx(
                        'shrink-0 transition-colors',
                        index === active ? 'text-brand-400' : 'text-ink-600',
                      )}
                    />
                  </a>
                ))}
              </div>
            ))
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-ink-800 bg-ink-950/40 px-4 py-2 text-micro text-ink-500">
          <span aria-live="polite">
            {results.length} result{results.length === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
            <kbd>↵</kbd> open
            <kbd>esc</kbd> close
          </span>
        </footer>
      </div>
    </div>
  );
}
