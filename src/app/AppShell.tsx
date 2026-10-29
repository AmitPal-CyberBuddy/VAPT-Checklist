import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigationType } from 'react-router-dom';
import clsx from 'clsx';
import { IconAlert, IconBook, IconGrid, IconKeyboard, IconSearch, IconSettings, IconShield, IconSun, IconMoon } from '../ui/icons';
import { InlineAlert, ProgressBar } from '../ui/primitives';
import { ShortcutsDialog } from './ShortcutsDialog';
import { applicationTypeLabel } from '../domain/applicationType';
import { CommandPalette, PALETTE_KBD } from '../ui/CommandPalette';
import { checkStorage, requestPersistentStorage, type StorageStatus } from '../persistence/db';
import { useEngagementDirectory, useEngagementSummariesSafe } from '../hooks/useData';
import { useTheme } from '../ui/theme';
import { LIBRARY_VERSION, TEST_LIBRARY } from '../data/library';

/** What the tester should actually do, per failure cause. */
const STORAGE_ADVICE: Record<string, string> = {
  blocked:
    'Site data is blocked for this origin — most often private browsing or a cookie/storage setting. Anything recorded now is lost when the tab closes. Allow site data, or use a normal window, then reload.',
  'version-mismatch':
    'This database was upgraded by a newer version of the application, probably in another tab. Reload the page to pick up the current version; your engagements are intact.',
  'upgrade-blocked':
    'A database upgrade is waiting on another tab that still has the old version open. Close the other tabs for this site and reload.',
  corrupt:
    'The local database could not be opened and may be damaged. If you have a JSON backup, reload and import it; otherwise clearing site data for this origin will reset the application.',
  unknown:
    'IndexedDB could not be opened. Anything recorded now will be lost when the tab closes. Reload the page, and if it persists, check the browser\'s site-data settings.',
};

const NAV = [
  { to: '/engagements', label: 'Engagements', icon: IconGrid, end: false },
  { to: '/library', label: 'Test Library', icon: IconBook, end: false },
  { to: '/settings', label: 'Data & Settings', icon: IconSettings, end: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const engagements = useEngagementDirectory();
  const summaries = useEngagementSummariesSafe();
  const navigationType = useNavigationType();
  const { theme, toggle: toggleTheme } = useTheme();

  /* `?` opens the keyboard map from anywhere — except while typing, where
     it is just a question mark. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '?') return;
      const el = event.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setShortcutsOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Scroll discipline for a hash-routed SPA: a new screen starts at the
     top; Back/Forward return to where that entry was left. Without this,
     the window keeps the previous screen's scroll position — landing
     mid-page on a screen you have never scrolled. Search-param-only
     changes (the workspace setting ?test= as you move) never reset. */
  useEffect(() => {
    let queued = false;
    const save = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        try {
          sessionStorage.setItem(`vapt-scroll:${location.key}`, String(window.scrollY));
        } catch {
          /* storage denied — restoration is best-effort */
        }
      });
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [location.key]);

  const previousPathname = useRef(location.pathname);
  useEffect(() => {
    const pathChanged = previousPathname.current !== location.pathname;
    previousPathname.current = location.pathname;
    if (!pathChanged) return;
    if (navigationType !== 'POP') {
      window.scrollTo(0, 0);
      return;
    }
    let y = 0;
    try {
      y = Number(sessionStorage.getItem(`vapt-scroll:${location.key}`)) || 0;
    } catch {
      y = 0;
    }
    window.scrollTo(0, y);
    // Engagement data arrives from IndexedDB a tick after first paint, so
    // the page may not have its full height yet — re-apply once it does.
    const retry = window.setTimeout(() => window.scrollTo(0, y), 140);
    return () => window.clearTimeout(retry);
  }, [location.pathname, location.key, navigationType]);

  useEffect(() => {
    void (async () => {
      const status = await checkStorage();
      setStorage(status);
      if (status.ok) void requestPersistentStorage();
    })();
  }, []);

  /* Route-aware tab titles — the browser history and tab strip stay
     meaningful when several engagements are open at once. */
  useEffect(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    let title = 'VAPT Checklist';
    if (segments.length === 0) {
      title = 'VAPT Checklist — methodology tracker';
    } else if (segments[0] === 'engagements') {
      title = segments[1] === 'new' ? 'New engagement · VAPT Checklist' : 'Engagements · VAPT Checklist';
    } else if (segments[0] === 'library') {
      title = 'Test library · VAPT Checklist';
    } else if (segments[0] === 'settings') {
      title = 'Data & settings · VAPT Checklist';
    } else if (segments[0] === 'e' && segments[1]) {
      const engagement = engagements.find((e) => e.id === segments[1]);
      title = engagement ? `${engagement.name} · VAPT Checklist` : 'Engagement · VAPT Checklist';
    }
    document.title = title;
  }, [location.pathname, engagements]);

  const storageOk = storage === null ? null : storage.ok;

  return (
    <div className="min-h-full">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      {/* The shell: one element that recomposes instead of shrinking.
          Below `lg` it is a horizontal top bar; at `lg` and up it becomes a
          fixed left rail — the navigation is a single landmark either way,
          so the structure never duplicates for different breakpoints. */}
      <header className="no-print sticky top-0 z-40 border-b border-ink-800 bg-ink-950/95 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:flex-col lg:border-r lg:border-b-0 lg:bg-ink-950">
        {/* The brand keyline — one controlled accent edge across the console. */}
        <div aria-hidden="true" className="brand-edge h-0.5 lg:hidden" />

        <div className="mx-auto flex h-13 max-w-[1600px] items-center gap-3 px-3 sm:gap-6 sm:px-6 lg:mx-0 lg:h-full lg:w-full lg:max-w-none lg:flex-col lg:items-stretch lg:gap-0 lg:px-0">
          {/* Brand — identity always first, wherever the bar sits. */}
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5 lg:px-3 lg:pt-3 lg:pb-2.5" aria-label="VAPT Checklist — home">
            <span className="brand-mark flex h-8 w-8 items-center justify-center rounded-(--radius-control) border border-brand-500/50 text-brand-400">
              <IconShield size={18} />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold tracking-tight text-ink-50">
                VAPT Checklist
              </span>
              <span className="mt-0.5 block font-mono text-micro tracking-widest text-ink-500 uppercase">
                Assessment Tracker
              </span>
            </span>
          </NavLink>

          {/* In the rail, a hairline under the identity marks the end of the
              brand block and the start of the workspace. */}
          <div aria-hidden="true" className="brand-edge hidden h-px opacity-70 lg:block" />

          {/* Command palette trigger — in the rail it reads as a search field
              with the shortcut; on the top bar it is an icon button. The two
              never show at once, so the palette is reachable the same way
              at every breakpoint. */}
          <button
            type="button"
            id="command-palette-trigger"
            onClick={() => setPaletteOpen(true)}
            className="hidden w-full items-center gap-2.5 rounded-(--radius-control) border border-ink-700 bg-ink-900 px-3 py-2 text-left text-sm text-ink-400 transition-[color,border-color,transform] duration-150 hover:border-ink-500 hover:text-ink-200 active:translate-y-px lg:mb-1 lg:flex"
          >
            <IconSearch size={14} aria-hidden="true" />
            <span className="flex-1">Search</span>
            <kbd aria-hidden="true">{PALETTE_KBD}</kbd>
          </button>

          <nav
            aria-label="Primary"
            className="flex min-w-0 flex-1 items-center gap-1 lg:flex-col lg:items-stretch lg:gap-1.5 lg:overflow-y-auto lg:p-3 lg:pt-3"
          >
            {NAV.map(({ to, label, icon: Icon, end }) => {
              const active = end
                ? location.pathname === to
                : location.pathname.startsWith(to) && to !== '/';
              return (
                <NavLink
                  key={to}
                  to={to}
                  aria-label={label}
                  title={label}
                  className={clsx(
                    'nav-pill rail-link flex shrink-0 items-center gap-2 rounded-(--radius-control) border px-2.5 py-1.5 text-sm transition-[color,background-color,border-color,box-shadow] duration-150 sm:px-3 lg:w-full lg:shrink lg:px-3',
                    active
                      ? 'border-ink-700 bg-ink-800 text-ink-50 shadow-[inset_0_1px_0_rgb(141_156_178/0.08)]'
                      : 'border-transparent text-ink-300 hover:bg-ink-900 hover:text-ink-100',
                  )}
                >
                  <Icon size={15} aria-hidden="true" />
                  {/* Always in the accessibility tree; visually hidden only on
                      the narrowest screens (below sm), where the top bar keeps
                      the nav to icons. */}
                  <span className="sr-only sm:not-sr-only">{label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Rail-only engagement switcher: the engagements a tester is
              actually juggling, one click apart, each carrying the same
              progress the list shows. The top bar has no room for it, so
              below `lg` the list (one tap away) stays the way in. */}
          {summaries.length > 0 && (
            <section aria-label="Recent engagements" className="hidden border-t border-ink-800 lg:block">
              <div className="px-3 pt-3 pb-4">
                <h2 className="px-1 font-mono text-micro font-medium tracking-widest text-ink-500 uppercase">
                  Recent engagements
                </h2>
                <ul className="mt-2 space-y-1">
                  {[...summaries]
                    .sort((a, b) => b.engagement.updatedAt.localeCompare(a.engagement.updatedAt))
                    .slice(0, 4)
                    .map((s) => (
                      <li key={s.engagement.id}>
                        <NavLink
                          to={`/e/${s.engagement.id}`}
                          className={({ isActive }) =>
                            clsx(
                              'block rounded-(--radius-control) border border-transparent px-2.5 py-2 transition-colors duration-150',
                              isActive
                                ? 'rail-brand border-ink-700 bg-ink-800'
                                : 'hover:border-ink-800 hover:bg-ink-900',
                            )
                          }
                        >
                          <span className="block truncate text-sm text-ink-100" title={s.engagement.name}>
                            {s.engagement.name}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-micro text-ink-400">
                            <span className="truncate">{applicationTypeLabel(s.engagement.applicationType)}</span>
                            <span className="ml-auto shrink-0 tabular-nums">
                              {Math.round(s.completion * 100)}%
                            </span>
                          </span>
                          <ProgressBar
                            height="sm"
                            className="mt-1.5"
                            label={`${s.engagement.name} progress in quick switch`}
                            value={s.completion}
                          />
                        </NavLink>
                      </li>
                    ))}
                </ul>
              </div>
            </section>
          )}

          {/* Utility cluster — right of the top bar on mobile, pinned to the
              bottom of the rail on wide screens. */}
          <div className="ml-auto flex items-center gap-3 px-1 text-micro text-ink-400 lg:ml-0 lg:mt-auto lg:flex-col lg:items-stretch lg:gap-2.5 lg:border-t lg:border-ink-800 lg:px-3 lg:pt-3 lg:pb-4">
            <button
              type="button"
              id="command-palette-trigger-bar"
              onClick={() => setPaletteOpen(true)}
              aria-label={`Search (${PALETTE_KBD})`}
              title={`Search (${PALETTE_KBD})`}
              className="flex h-8 w-8 items-center justify-center rounded-(--radius-control) border border-ink-700 bg-ink-900 text-ink-400 transition-[color,border-color,box-shadow] duration-150 hover:border-ink-500 hover:text-ink-200 lg:hidden"
            >
              <IconSearch size={13} />
            </button>
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="flex h-8 w-8 items-center justify-center rounded-(--radius-control) border border-ink-700 bg-ink-900 text-ink-400 transition-[color,border-color,box-shadow] duration-150 hover:border-ink-500 hover:text-ink-200 lg:self-start"
            >
              <IconKeyboard size={14} />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="flex h-8 w-8 items-center justify-center rounded-(--radius-control) border border-ink-700 bg-ink-900 text-ink-400 transition-[color,border-color,box-shadow] duration-150 hover:border-ink-500 hover:text-ink-200 lg:self-start"
            >
              {theme === 'dark' ? <IconSun size={13} /> : <IconMoon size={13} />}
            </button>
            <span className="hidden font-mono tabular-nums lg:block">
              {TEST_LIBRARY.length} tests · library v{LIBRARY_VERSION}
            </span>
            <span
              className={clsx(
                'flex items-center gap-1.5 rounded-md border px-2 py-1',
                storageOk === false
                  ? 'border-vuln-500/40 bg-vuln-500/10 text-vuln-400'
                  : storageOk === true
                    ? 'border-safe-500/30 bg-safe-500/5 text-safe-400'
                    : 'border-ink-700 bg-ink-900 text-ink-400',
              )}
              title={
                storageOk === false
                  ? 'IndexedDB is unavailable — private mode or blocked storage. Work will not be saved.'
                  : storageOk === true
                    ? 'Data is stored locally in this browser (IndexedDB). Nothing is sent anywhere.'
                    : 'Checking whether this browser can save assessment data.'
              }
            >
              <span
                aria-hidden="true"
                className={clsx(
                  'h-1.5 w-1.5 rounded-full',
                  storageOk === false
                    ? 'animate-pulse bg-vuln-400'
                    : storageOk === true
                      ? 'bg-safe-400'
                      : 'animate-pulse bg-ink-400',
                )}
              />
              <span className="hidden font-mono sm:inline">
                {storageOk === false
                  ? 'Storage unavailable'
                  : storageOk === true
                    ? 'Saved locally'
                    : 'Checking storage'}
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* Main column — pushed right of the rail on wide screens. */}
      <div className="app-main-column flex min-h-full flex-col lg:pl-60">
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-5 sm:px-6 sm:py-6">
          {storageOk === false && (
            <InlineAlert
              tone="error"
              icon={<IconAlert size={18} />}
              title="This browser is not saving your work"
              className="mb-5"
            >
              {STORAGE_ADVICE[storage?.problem ?? 'unknown']}
              {storage?.detail && (
                <span className="mt-1 block font-mono text-micro text-ink-400">{storage.detail}</span>
              )}
            </InlineAlert>
          )}
          {/* Route-level crossfade: 120 ms fade keyed by path, off under reduced motion. */}
          <div key={location.pathname} className="animate-page">
            {children}
          </div>
        </main>

        <footer className="no-print mt-8 px-4 pt-4 pb-6 sm:px-6">
          <div aria-hidden="true" className="brand-edge mb-4 h-px opacity-70" />
          <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-2 text-center">
            <span className="flex items-center gap-1.5 font-mono text-micro tracking-wide text-ink-500">
              <IconShield size={11} aria-hidden="true" className="text-brand-500/70" />
              VAPT Checklist — Assessment Tracker
            </span>
            <span className="font-mono text-micro tracking-wide text-ink-500">
              Fully client-side · no backend, no telemetry · engagement data never leaves this browser
            </span>
          </div>
        </footer>
      </div>

      {/* The command layer: Ctrl/⌘-K from anywhere in the console. */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} engagements={engagements} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
