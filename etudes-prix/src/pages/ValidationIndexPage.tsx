import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import { useStore } from '../state/store';
import { isActive } from '../domain/workflow';
import { sortByPriority, amountOf, isReadyToValidate } from '../domain/kpi';
import { isReviewStale, scoreOf } from '../domain/review';
import { formatDateShort, formatEuro } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { DemoBadge, StatusBadge } from '../components/ui/Badges';
import { HelpBox } from '../components/ui/Help';

/** Entrée « Validation » du menu : quelle étude est prête à être validée ? */
export function ValidationIndexPage() {
  const { studies } = useStore();
  const navigate = useNavigate();
  const rows = useMemo(() => [...sortByPriority(studies), ...studies.filter((s) => !isActive(s))], [studies]);
  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Validation' }]} icon={<BadgeCheck size={24} />} title="Validation" subtitle="Quelle étude est prête à être validée ? Choisissez une étude." />
      <HelpBox><p>Une étude est <strong>prête</strong> quand sa revue de prix est à jour et ne comporte aucun contrôle bloquant. Une étude <strong>validée</strong> est verrouillée jusqu’à son déverrouillage.</p></HelpBox>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Étude</th><th className="px-3 py-2.5">Étape</th><th className="px-3 py-2.5">Remise</th><th className="px-3 py-2.5 text-right">Prix de vente</th><th className="px-3 py-2.5 text-right">Revue</th><th className="px-5 py-2.5">Validation</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => {
                const sc = s.review ? scoreOf(s.review.checks, s.reviewJustifications) : null;
                const ready = isReadyToValidate(s);
                return (
                  <tr key={s.id} tabIndex={0} onClick={() => navigate(`/etudes/${s.id}/validation`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/etudes/${s.id}/validation`)} className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none">
                    <td className="min-w-[280px] px-5 py-3"><div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.isDemo && <DemoBadge />}</div><div className="text-xs text-slate-500">{s.reference} · {s.client}</div></td>
                    <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-3 tabular">{formatDateShort(s.dueDate)}</td>
                    <td className="px-3 py-3 text-right tabular">{formatEuro(amountOf(s))}</td>
                    <td className="px-3 py-3 text-right tabular">{sc ? <>{sc.score} %{sc.blocking > 0 && <span className="ml-1 font-semibold text-red-700">· {sc.blocking} 🔴</span>}{isReviewStale(s) && <span className="ml-1 text-orange-700">· à relancer</span>}</> : '—'}</td>
                    <td className="px-5 py-3">
                      {s.validation ? <span className="font-semibold text-emerald-700">🔒 Validée V{s.validation.version}{s.validation.withReserves ? ' (réserves)' : ''}</span>
                        : s.status === 'remise' ? <span className="text-slate-500">Remise</span>
                          : ready ? <span className="font-semibold text-emerald-700">🟢 Prête à valider</span> : <span className="text-slate-500">Pas encore</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
