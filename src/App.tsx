import { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { ErrorBoundary } from './app/ErrorBoundary';
import { RoutedErrorBoundary } from './app/RoutedErrorBoundary';
import { Toaster } from './ui/toast';
import { ThemeProvider } from './ui/theme';
import { LoadingPanel } from './ui/primitives';
import LandingPage from './features/landing/LandingPage';

/**
 * Route-level code splitting: the landing page (the default route) ships in
 * the entry chunk; every other screen loads on first navigation. The shared
 * shell, design system and test library stay eager because the command
 * palette and the shell itself need them before any route can render.
 */
const EngagementsPage = lazy(() => import('./features/engagements/EngagementsPage'));
const NewEngagementPage = lazy(() => import('./features/engagements/NewEngagementPage'));
const EngagementLayout = lazy(() => import('./features/engagements/EngagementLayout'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const WorkspacePage = lazy(() => import('./features/workspace/WorkspacePage'));
const ContextPage = lazy(() => import('./features/context/ContextPage'));
const ExportPage = lazy(() => import('./features/export/ExportPage'));
const LibraryPage = lazy(() => import('./features/library/LibraryPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));

function LegacyChecklistRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '../workspace', search }} replace />;
}

/**
 * HashRouter is used deliberately: GitHub Pages serves static files only and
 * has no rewrite rule, so a BrowserRouter deep link (/e/abc/checklist) would
 * 404 on refresh. Hash routing works identically at `/` and at `/<repo>/`.
 */
export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
      <AppShell>
        <RoutedErrorBoundary>
        <Suspense
          fallback={
            <div className="mx-auto w-full max-w-3xl px-4 py-10">
              <LoadingPanel label="Loading screen" />
            </div>
          }
        >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/engagements" element={<EngagementsPage />} />
          <Route path="/engagements/new" element={<NewEngagementPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/e/:engagementId" element={<EngagementLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="workspace" element={<WorkspacePage />} />
            {/* Older links used /checklist; keep them (and their query) working. */}
            <Route path="checklist" element={<LegacyChecklistRedirect />} />
            <Route path="context" element={<ContextPage />} />
            <Route path="export" element={<ExportPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </RoutedErrorBoundary>
      </AppShell>
      </ThemeProvider>
      <Toaster />
    </HashRouter>
  );
}

/** Root-level guard: catches a failure in the shell itself. */
export function AppWithBoundary() {
  return (
    <ErrorBoundary area="application">
      <App />
    </ErrorBoundary>
  );
}
