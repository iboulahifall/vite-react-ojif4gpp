import { HashRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './state/store';
import { ToastProvider } from './components/ui/Toast';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { StudiesPage } from './pages/StudiesPage';
import { NewStudyPage } from './pages/NewStudyPage';
import { StudyPage } from './pages/StudyPage';
import { ModulePage } from './pages/ModulePage';
import { DcePage } from './pages/DcePage';
import { DceIndexPage } from './pages/DceIndexPage';
import { AnalysePage } from './pages/AnalysePage';
import { AnalyseIndexPage } from './pages/AnalyseIndexPage';
import { MetrePage } from './pages/MetrePage';
import { MetreIndexPage } from './pages/MetreIndexPage';
import { ConsultationsPage } from './pages/ConsultationsPage';
import { ConsultationPage } from './pages/ConsultationPage';
import { ConsultationsIndexPage } from './pages/ConsultationsIndexPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { SupplierPage } from './pages/SupplierPage';
import { ChiffragePage } from './pages/ChiffragePage';
import { ChiffrageIndexPage } from './pages/ChiffrageIndexPage';
import { RisksPage } from './pages/RisksPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { QuestionsIndexPage, RisksIndexPage } from './pages/FollowUpIndexPages';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

function Routed() {
  const { ready } = useStore();
  if (!ready) return <div className="flex h-full items-center justify-center text-slate-500">Chargement…</div>;
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="etudes" element={<StudiesPage />} />
        <Route path="etudes/:id" element={<StudyPage />} />
        <Route path="etudes/:id/dce" element={<DcePage />} />
        <Route path="dce" element={<DceIndexPage />} />
        <Route path="etudes/:id/analyse" element={<AnalysePage />} />
        <Route path="analyse" element={<AnalyseIndexPage />} />
        <Route path="etudes/:id/metre" element={<MetrePage />} />
        <Route path="metre" element={<MetreIndexPage />} />
        <Route path="etudes/:id/consultations" element={<ConsultationsPage />} />
        <Route path="etudes/:id/consultations/:cid" element={<ConsultationPage />} />
        <Route path="consultations" element={<ConsultationsIndexPage />} />
        <Route path="fournisseurs" element={<SuppliersPage />} />
        <Route path="fournisseurs/:sid" element={<SupplierPage />} />
        <Route path="etudes/:id/chiffrage" element={<ChiffragePage />} />
        <Route path="chiffrage" element={<ChiffrageIndexPage />} />
        <Route path="etudes/:id/risques" element={<RisksPage />} />
        <Route path="etudes/:id/questions" element={<QuestionsPage />} />
        <Route path="risques" element={<RisksIndexPage />} />
        <Route path="questions" element={<QuestionsIndexPage />} />
        <Route path="nouvelle-etude" element={<NewStudyPage />} />
        <Route path="modules/:module" element={<ModulePage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <HashRouter>
          <Routed />
        </HashRouter>
      </ToastProvider>
    </StoreProvider>
  );
}
