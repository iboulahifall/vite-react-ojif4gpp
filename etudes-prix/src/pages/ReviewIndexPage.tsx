import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchCheck } from 'lucide-react';
import { useStore } from '../state/store';
import { isActive } from '../domain/workflow';
import { sortByPriority } from '../domain/kpi';
import { isReviewStale, scoreOf } from '../domain/review';
import { formatDateTime } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { DemoBadge, StatusBadge } from '../components/ui/Badges';
import { HelpBox } from '../components/ui/Help';

/** Entrée « Revue de prix » du menu. */
export function ReviewIndexPage() {
  const { studies } = useStore();
  const navigate = useNavigate();
  const rows = useMemo(() => [...sortByPriority(studies), ...studies.filter((s) => !isActive(s))], [studies]);
  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Revue de prix' }]} icon={<SearchCheck size={24} />} title="Revue de prix" subtitle="Choisissez une étude pour lancer ou consulter sa revue." />
      <HelpBox><p>La revue contrôle la cohérence de chaque étude avant validation. Le <strong>score</strong> résume l’état des contrôles de l’application : ce n’est pas une garantie de conformité.</p></HelpBox>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Étude</th><th className="px-3 py-2.5">Étape</th><th className="px-3 py-2.5">Dernière revue</th><th className="px-3 py-2.5 text-right">Score</th><th className="px-3 py-2.5 text-right">🔴 Bloquants</th><th className="px-5 py-2.5 text-right">🟠 À vérifier</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => {
                const sc = s.review ? scoreOf(s.review.checks, s.reviewJustifications) : null;
                const stale = isReviewStale(s);
                return (
                  <tr key={s.id} tabIndex={0} onClick={() => navigate(`/etudes/${s.id}/revue`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/etudes/${s.id}/revue`)} className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none">
                    <td className="min-w-[280px] px-5 py-3"><div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.isDemo && <DemoBadge />}</div><div className="text-xs text-slate-500">{s.reference} · {s.client}</div></td>
                    <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-3 text-slate-700">{s.review ? <>{formatDateTime(s.review.runAt)}{stale && <span className="ml-1 font-semibold text-orange-700">· à relancer</span>}</> : <span className="text-slate-400">Jamais lancée</span>}</td>
                    <td className="px-3 py-3 text-right font-bold tabular">{sc ? `${sc.score} %` : '—'}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular text-red-700">{sc ? sc.blocking : '—'}</td>
                    <td className="px-5 py-3 text-right tabular text-orange-700">{sc ? sc.toCheck : '—'}</td>
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
