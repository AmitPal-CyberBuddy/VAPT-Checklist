import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { ErrorBoundary } from './app/ErrorBoundary';
import { RoutedErrorBoundary } from './app/RoutedErrorBoundary';
import { Toaster } from './ui/toast';
import EngagementsPage from './features/engagements/EngagementsPage';
import NewEngagementPage from './features/engagements/NewEngagementPage';
import EngagementLayout from './features/engagements/EngagementLayout';
import DashboardPage from './features/dashboard/DashboardPage';
import WorkspacePage from './features/workspace/WorkspacePage';
import ContextPage from './features/context/ContextPage';
import ExportPage from './features/export/ExportPage';
import LibraryPage from './features/library/LibraryPage';
import SettingsPage from './features/settings/SettingsPage';

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
      <AppShell>
        <RoutedErrorBoundary>
        <Routes>
          <Route path="/" element={<EngagementsPage />} />
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
        </RoutedErrorBoundary>
      </AppShell>
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
