import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { FlaskConical, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useStore } from '../../state/store';
import { LockBanner } from '../LockBanner';

export function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const { hasDemo } = useStore();
  const location = useLocation();
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [location.pathname]);

  return (
    <div className="min-h-full lg:pl-64">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar />
      </aside>
      {drawer && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-2xl">
            <button onClick={() => setDrawer(false)} className="absolute right-3 top-5 z-10 rounded p-1 text-slate-300 hover:text-white cursor-pointer" aria-label="Fermer le menu"><X size={20} /></button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <Header onMenu={() => setDrawer(true)} />
      {hasDemo && (
        <div className="no-print flex items-center justify-center gap-2 bg-fuchsia-50 px-4 py-1.5 text-center text-xs font-medium text-fuchsia-900 border-b border-fuchsia-100">
          <FlaskConical size={14} aria-hidden />
          <span><strong>DONNÉES DE DÉMONSTRATION</strong> — les études marquées « Démo » sont fictives.</span>
          <Link to="/parametres" className="underline hover:no-underline">Gérer</Link>
        </div>
      )}
      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
        <LockBanner />
        <Outlet />
      </main>
    </div>
  );
}
