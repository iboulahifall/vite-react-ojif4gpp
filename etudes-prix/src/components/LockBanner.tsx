import { Link, useMatch } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useStore } from '../state/store';
import { formatDateTime } from '../domain/format';

/** Bandeau des pages d'une étude validée ou remise : lecture seule. */
export function LockBanner() {
  const m = useMatch('/etudes/:id/*');
  const study = useStore().getStudy(m?.params.id ?? '');
  if (!study || (!study.validation && study.status !== 'remise')) return null;
  const v = study.validation;
  return (
    <div className="no-print mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900" role="status">
      <Lock size={16} aria-hidden />
      <span className="flex-1">
        {study.status === 'remise' ? <><strong>Offre remise</strong> — étude terminée, en lecture seule.</>
          : <><strong>Étude validée V{v!.version}</strong> le {formatDateTime(v!.validatedAt)} par {v!.validatedBy} — <strong>verrouillée</strong> : lecture seule.</>}
      </span>
      {study.status !== 'remise' && <Link to={`/etudes/${study.id}/validation`} className="font-semibold underline hover:no-underline">Validation / déverrouillage</Link>}
    </div>
  );
}
