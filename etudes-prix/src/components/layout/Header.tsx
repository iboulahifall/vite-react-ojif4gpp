import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, ChevronDown, CircleHelp, Compass, Menu, Search, Zap } from 'lucide-react';
import { useStore } from '../../state/store';
import { computeAlerts } from '../../domain/kpi';
import { RiskBadge, StatusBadge } from '../ui/Badges';
import { Modal } from '../ui/Modal';
import { STAGES } from '../../domain/workflow';

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, close]);
  return ref;
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function GlobalSearch() {
  const { studies } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const results = useMemo(() => {
    const n = normalize(q.trim());
    if (!n) return [];
    return studies
      .filter((s) => normalize(`${s.name} ${s.client} ${s.reference} ${s.location}`).includes(n))
      .slice(0, 6);
  }, [q, studies]);

  const go = (path: string) => { setOpen(false); setQ(''); navigate(path); };

  return (
    <div ref={ref} className="relative w-full max-w-xl">
      <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) go(`/etudes?q=${encodeURIComponent(q.trim())}`);
        }}
        placeholder="Rechercher une étude, un client, une référence…"
        aria-label="Recherche globale"
        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
      />
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Aucune étude ne correspond à « {q} ».</p>
          ) : (
            <ul>
              {results.map((s) => (
                <li key={s.id}>
                  <button onClick={() => go(`/etudes/${s.id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 cursor-pointer">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{s.name}</div>
                      <div className="truncate text-xs text-slate-500">{s.reference} · {s.client}</div>
                    </div>
                    <StatusBadge status={s.status} />
                  </button>
                </li>
              ))}
              <li className="border-t border-slate-100">
                <button onClick={() => go(`/etudes?q=${encodeURIComponent(q.trim())}`)} className="w-full px-4 py-2 text-left text-xs font-medium text-brand-700 hover:bg-slate-50 cursor-pointer">
                  Voir tous les résultats dans « Mes études » →
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const { studies } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const alerts = useMemo(() => computeAlerts(studies).filter((a) => a.kind !== 'missing-dce'), [studies]);
  const urgent = alerts.filter((a) => a.level === 'critique').length;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
        aria-label={`Notifications (${alerts.length})`}
        aria-expanded={open}
      >
        <Bell size={20} />
        {alerts.length > 0 && (
          <span className={clsx('absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white', urgent ? 'bg-red-600' : 'bg-brand-600')}>
            {alerts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Notifications</div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {alerts.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Rien à signaler 🎉</li>}
            {alerts.map((a, i) => (
              <li key={i}>
                <Link to={`/etudes/${a.studyId}`} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                  <RiskBadge level={a.level} compact />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{a.message}</div>
                    <div className="truncate text-xs text-slate-500">{a.studyName}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Comment utiliser l’application ?" size="lg">
      <div className="space-y-4 text-sm text-slate-700">
        <p>
          Une <strong>étude de prix</strong> suit toujours le même parcours. Chaque étude affiche son étape actuelle
          et la <strong>prochaine action</strong> à mener.
        </p>
        <ol className="grid gap-2 sm:grid-cols-2">
          {STAGES.map((s, i) => (
            <li key={s.id} className="flex gap-3 rounded-lg border border-slate-200 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{i + 1}</span>
              <div><div className="font-semibold text-slate-900">{s.label}</div><div className="text-xs text-slate-600">{s.todo}</div></div>
            </li>
          ))}
        </ol>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="font-semibold text-slate-900">Pour bien démarrer</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Ouvrez le <strong>PROJET DÉMONSTRATION — IMMEUBLE TERTIAIRE</strong> depuis le tableau de bord pour découvrir une étude complète.</li>
            <li>Cliquez sur <strong>+ Nouvelle étude</strong> pour créer votre premier appel d’offres avec l’assistant pas à pas.</li>
            <li>Le <strong>mode guidé</strong> affiche des explications sur chaque écran ; le <strong>mode expert</strong> les masque.</li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">Version 1.1 : tableau de bord, navigation et création d’étude. Les modules DCE, métré, consultations, chiffrage, risques, questions, revue et rapports arrivent dans les versions suivantes (voir la version indiquée dans le menu).</p>
      </div>
    </Modal>
  );
}

function UserMenu() {
  const { settings, updateSettings } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const initials = settings.userName.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 cursor-pointer" aria-expanded={open}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{initials}</span>
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-sm font-medium text-slate-900">{settings.userName}</span>
          <span className="block text-[11px] text-slate-500">Resp. études de prix</span>
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Mode d’affichage</p>
          {[
            { guided: true, icon: <Compass size={18} />, label: 'Mode guidé', desc: 'Explications et étapes affichées' },
            { guided: false, icon: <Zap size={18} />, label: 'Mode expert', desc: 'Accès direct, sans explications' },
          ].map((m) => (
            <button
              key={m.label}
              onClick={() => { updateSettings({ guidedMode: m.guided }); setOpen(false); }}
              className={clsx('flex w-full items-start gap-3 rounded-lg p-2 text-left cursor-pointer', settings.guidedMode === m.guided ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50')}
              aria-pressed={settings.guidedMode === m.guided}
            >
              <span className="mt-0.5 text-brand-700">{m.icon}</span>
              <span><span className="block text-sm font-medium">{m.label}</span><span className="block text-xs text-slate-500">{m.desc}</span></span>
            </button>
          ))}
          <Link to="/parametres" onClick={() => setOpen(false)} className="mt-1 block rounded-lg border-t border-slate-100 px-2 pt-2 pb-1 text-sm text-slate-700 hover:text-brand-700">
            Paramètres →
          </Link>
        </div>
      )}
    </div>
  );
}

export function Header({ onMenu }: { onMenu: () => void }) {
  const [help, setHelp] = useState(false);
  const { settings } = useStore();
  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer" aria-label="Ouvrir le menu">
        <Menu size={20} />
      </button>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1">
        <span
          className={clsx('hidden md:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
            settings.guidedMode ? 'bg-brand-50 text-brand-800' : 'bg-slate-100 text-slate-700')}
          title="Changer de mode depuis le menu utilisateur"
        >
          {settings.guidedMode ? <><Compass size={13} /> Guidé</> : <><Zap size={13} /> Expert</>}
        </span>
        <Notifications />
        <button onClick={() => setHelp(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer" aria-label="Aide">
          <CircleHelp size={20} />
        </button>
        <UserMenu />
      </div>
      <HelpModal open={help} onClose={() => setHelp(false)} />
    </header>
  );
}
