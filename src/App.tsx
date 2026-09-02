import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { Toaster } from './ui/toast';
import EngagementsPage from './features/engagements/EngagementsPage';
import NewEngagementPage from './features/engagements/NewEngagementPage';
import EngagementLayout from './features/engagements/EngagementLayout';
import DashboardPage from './features/dashboard/DashboardPage';
import ChecklistPage from './features/checklist/ChecklistPage';
import ContextPage from './features/context/ContextPage';
import ExportPage from './features/export/ExportPage';
import LibraryPage from './features/library/LibraryPage';
import SettingsPage from './features/settings/SettingsPage';

/**
 * HashRouter is used deliberately: GitHub Pages serves static files only and
 * has no rewrite rule, so a BrowserRouter deep link (/e/abc/checklist) would
 * 404 on refresh. Hash routing works identically at `/` and at `/<repo>/`.
 */
export default function App() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<EngagementsPage />} />
          <Route path="/engagements/new" element={<NewEngagementPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/e/:engagementId" element={<EngagementLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="checklist" element={<ChecklistPage />} />
            <Route path="context" element={<ContextPage />} />
            <Route path="export" element={<ExportPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
      <Toaster />
    </HashRouter>
  );
}
