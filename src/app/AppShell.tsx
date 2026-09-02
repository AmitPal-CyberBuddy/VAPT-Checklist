import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { IconAlert, IconBook, IconGrid, IconSettings, IconShield } from '../ui/icons';
import { InlineAlert } from '../ui/primitives';
import { checkStorage, requestPersistentStorage, type StorageStatus } from '../persistence/db';
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
  { to: '/', label: 'Engagements', icon: IconGrid, end: true },
  { to: '/library', label: 'Test Library', icon: IconBook, end: false },
  { to: '/settings', label: 'Data & Settings', icon: IconSettings, end: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [storage, setStorage] = useState<StorageStatus | null>(null);

  useEffect(() => {
    void (async () => {
      const status = await checkStorage();
      setStorage(status);
      if (status.ok) void requestPersistentStorage();
    })();
  }, []);

  const storageOk = storage === null ? null : storage.ok;

  return (
    <div className="flex min-h-full flex-col">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="no-print sticky top-0 z-40 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:gap-6 sm:px-6">
          <NavLink to="/" className="flex shrink-0 items-center gap-2" aria-label="VAPT Checklist — home">
            <span className="flex h-8 w-8 items-center justify-center rounded-[--radius-control] border border-brand-500/40 bg-brand-500/10 text-brand-400">
              <IconShield size={18} />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold tracking-tight text-ink-50">
                VAPT Checklist
              </span>
              <span className="block text-micro tracking-widest text-ink-400 uppercase">
                Assessment Tracker
              </span>
            </span>
          </NavLink>

          <nav aria-label="Primary" className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => {
              const active = end
                ? location.pathname === to
                : location.pathname.startsWith(to) && to !== '/';
              return (
                <NavLink
                  key={to}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'flex items-center gap-2 rounded-[--radius-control] px-2.5 py-1.5 text-sm transition-colors sm:px-3',
                    active
                      ? 'bg-ink-800 text-ink-50'
                      : 'text-ink-300 hover:bg-ink-900 hover:text-ink-100',
                  )}
                >
                  <Icon size={15} aria-hidden="true" />
                  {/* Always in the accessibility tree; visually hidden below md. */}
                  <span className="sr-only md:not-sr-only">{label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-micro text-ink-400">
            <span className="hidden xl:inline">
              {TEST_LIBRARY.length} tests · library v{LIBRARY_VERSION}
            </span>
            <span
              className={clsx(
                'flex items-center gap-1.5 rounded-md border px-2 py-1',
                storageOk === false
                  ? 'border-vuln-500/40 bg-vuln-500/10 text-vuln-400'
                  : 'border-safe-500/30 bg-safe-500/5 text-safe-400',
              )}
              title={
                storageOk === false
                  ? 'IndexedDB is unavailable — private mode or blocked storage. Work will not be saved.'
                  : 'Data is stored locally in this browser (IndexedDB). Nothing is sent anywhere.'
              }
            >
              <span
                aria-hidden="true"
                className={clsx(
                  'h-1.5 w-1.5 rounded-full',
                  storageOk === false ? 'bg-vuln-400' : 'bg-safe-400',
                )}
              />
              <span className="hidden sm:inline">
                {storageOk === false ? 'Storage unavailable' : 'Saved locally'}
              </span>
            </span>
          </div>
        </div>
      </header>

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
        {children}
      </main>

      <footer className="no-print border-t border-ink-800 px-4 py-4 text-center text-xs text-ink-500 sm:px-6">
        Fully client-side · no backend, no telemetry · engagement data never leaves this browser
      </footer>
    </div>
  );
}
