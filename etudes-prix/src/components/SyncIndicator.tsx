import clsx from 'clsx';
import { AlertTriangle, CloudOff, Database, HardDrive, Loader2, RefreshCw } from 'lucide-react';
import { useStore } from '../state/store';

/** Où sont enregistrées les données et si tout est enregistré (pied du menu). */
export function SyncIndicator() {
  const { storage } = useStore();
  const st = storage.status;
  if (storage.kind === 'local') {
    return <p className="flex items-center gap-1.5 px-3 text-[11px] text-slate-500" title="Données enregistrées dans ce navigateur uniquement"><HardDrive size={12} /> Données : ce navigateur</p>;
  }
  const label = !st || st.state === 'saved' ? 'enregistré' : st.state === 'saving' ? 'enregistrement…' : st.state === 'offline' ? 'serveur injoignable' : 'conflit';
  const Icon = !st || st.state === 'saved' ? Database : st.state === 'saving' ? Loader2 : st.state === 'offline' ? CloudOff : AlertTriangle;
  return (
    <p className={clsx('flex items-center gap-1.5 px-3 text-[11px]', st && (st.state === 'offline' || st.state === 'conflict') ? 'font-semibold text-amber-300' : 'text-slate-500')}
      title={`Données sur le serveur (${st?.database ?? 'base'})`} data-testid="sync-indicator">
      <Icon size={12} className={st?.state === 'saving' ? 'animate-spin' : undefined} /> Serveur{st?.database ? ` (${st.database})` : ''} — {label}
    </p>
  );
}

/** Bandeau : serveur injoignable ou modification concurrente refusée. */
export function SyncBanner() {
  const { storage, getStudy } = useStore();
  const st = storage.status;
  if (storage.kind !== 'server' || !st || (st.state !== 'offline' && st.state !== 'conflict')) return null;
  if (st.state === 'offline') {
    return (
      <div className="no-print flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-sm text-amber-900" role="alert">
        <CloudOff size={16} /> <strong>Serveur injoignable</strong> — {st.pending} modification(s) en attente, nouvel essai automatique. Ne fermez pas la page.
      </div>
    );
  }
  const names = st.conflicts.map((id) => getStudy(id)?.name ?? id).join(', ');
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900" role="alert">
      <AlertTriangle size={16} /> <span><strong>Modifié sur un autre poste :</strong> {names}. Vos dernières modifications de cet élément n’ont pas été enregistrées, pour ne pas écraser celles de votre collègue.</span>
      <button onClick={() => window.location.reload()} className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-red-700 px-2.5 py-1 font-semibold text-white hover:bg-red-800"><RefreshCw size={14} /> Recharger la dernière version</button>
    </div>
  );
}
