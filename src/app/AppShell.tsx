import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { IconBook, IconGrid, IconSettings, IconShield } from '../ui/icons';
import { requestPersistentStorage, storageAvailable } from '../persistence/db';
import { LIBRARY_VERSION, TEST_LIBRARY } from '../data/library';

const NAV = [
  { to: '/', label: 'Engagements', icon: IconGrid, end: true },
  { to: '/library', label: 'Test Library', icon: IconBook, end: false },
  { to: '/settings', label: 'Data & Settings', icon: IconSettings, end: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [storageOk, setStorageOk] = useState(true);

  useEffect(() => {
    void (async () => {
      const ok = await storageAvailable();
      setStorageOk(ok);
      if (ok) void requestPersistentStorage();
    })();
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-500/40 bg-brand-500/10 text-brand-400">
              <IconShield size={18} />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight text-ink-50">
                VAPT Checklist
              </span>
              <span className="block text-[10px] tracking-widest text-ink-500 uppercase">
                Assessment Tracker
              </span>
            </span>
          </NavLink>

          <nav className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => {
              const active = end
                ? location.pathname === to
                : location.pathname.startsWith(to) && to !== '/';
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-ink-800 text-ink-50'
                      : 'text-ink-400 hover:bg-ink-900 hover:text-ink-100',
                  )}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-[11px] text-ink-500">
            <span className="hidden md:inline">
              {TEST_LIBRARY.length} tests · library v{LIBRARY_VERSION}
            </span>
            <span
              className={clsx(
                'flex items-center gap-1.5 rounded-md border px-2 py-1',
                storageOk
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                  : 'border-rose-500/30 bg-rose-500/5 text-rose-400',
              )}
              title={
                storageOk
                  ? 'Data is stored locally in this browser (IndexedDB). Nothing is sent anywhere.'
                  : 'IndexedDB is unavailable — private mode or blocked storage. Work will not persist.'
              }
            >
              <span
                className={clsx(
                  'h-1.5 w-1.5 rounded-full',
                  storageOk ? 'bg-emerald-400' : 'bg-rose-400',
                )}
              />
              {storageOk ? 'Local storage active' : 'Storage unavailable'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">{children}</main>

      <footer className="no-print border-t border-ink-800/80 px-4 py-4 text-center text-xs text-ink-600 sm:px-6">
        Fully client-side · no backend, no telemetry · engagement data never leaves this browser
      </footer>
    </div>
  );
}
