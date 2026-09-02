import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { IconAlert, IconBook, IconGrid, IconSettings, IconShield } from '../ui/icons';
import { InlineAlert } from '../ui/primitives';
import { requestPersistentStorage, storageAvailable } from '../persistence/db';
import { LIBRARY_VERSION, TEST_LIBRARY } from '../data/library';

const NAV = [
  { to: '/', label: 'Engagements', icon: IconGrid, end: true },
  { to: '/library', label: 'Test Library', icon: IconBook, end: false },
  { to: '/settings', label: 'Data & Settings', icon: IconSettings, end: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [storageOk, setStorageOk] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const ok = await storageAvailable();
      setStorageOk(ok);
      if (ok) void requestPersistentStorage();
    })();
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="no-print sticky top-0 z-40 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:gap-6 sm:px-6">
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="VAPT Checklist — home">
            <span className="flex h-8 w-8 items-center justify-center rounded-[--radius-control] border border-brand-500/40 bg-brand-500/10 text-brand-400">
              <IconShield size={18} />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold tracking-tight text-ink-50">
                VAPT Checklist
              </span>
              <span className="block text-[10px] tracking-widest text-ink-400 uppercase">
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

          <div className="ml-auto flex items-center gap-3 text-[11px] text-ink-400">
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
            IndexedDB is blocked or unavailable — most often private browsing, or a browser setting
            that blocks site data. Anything you record now will be lost when the tab closes. Enable
            site data for this origin, or use a normal window, then reload.
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
