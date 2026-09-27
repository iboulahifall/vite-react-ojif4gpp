import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { useStore } from '../state/store';
import { isActive } from '../domain/workflow';
import { sortByPriority } from '../domain/kpi';
import { summarize } from '../domain/analysis/summary';
import { dceSignature } from '../domain/analysis/analyse';
import { formatDateTime } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { DemoBadge, StatusBadge } from '../components/ui/Badges';
import { HelpBox } from '../components/ui/Help';

/** Entrée « Analyse » du menu : état de l'analyse de chaque étude. */
export function AnalyseIndexPage() {
  const { studies } = useStore();
  const navigate = useNavigate();
  const rows = useMemo(() => [...sortByPriority(studies), ...studies.filter((s) => !isActive(s))], [studies]);
  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Analyse' }]} icon={<BarChart3 size={24} />} title="Analyse"
        subtitle="Choisissez une étude pour analyser son DCE ou consulter les résultats." />
      <HelpBox><p>L’analyse compare le CCTP et la DPGF et repère les clauses à risque. Elle nécessite un CCTP (PDF ou Word) et, pour la comparaison, une DPGF au format Excel.</p></HelpBox>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Étude</th><th className="px-3 py-2.5">Étape</th><th className="px-3 py-2.5">Dernière analyse</th><th className="px-3 py-2.5">Résultat</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => {
                const sum = s.analysis ? summarize(s.analysis, s.analysisDecisions) : null;
                const stale = s.analysis && s.analysis.dceSignature !== dceSignature(s.documents);
                const hasCctp = s.documents.some((d) => d.category === 'CCTP');
                return (
                  <tr key={s.id} tabIndex={0} onClick={() => navigate(`/etudes/${s.id}/analyse`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/etudes/${s.id}/analyse`)}
                    className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none">
                    <td className="min-w-[280px] px-5 py-3">
                      <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.isDemo && <DemoBadge />}</div>
                      <div className="text-xs text-slate-500">{s.reference} · {s.client}</div>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-3 text-slate-700">
                      {s.analysis ? formatDateTime(s.analysis.runAt) : hasCctp ? <span className="font-medium text-brand-700">À lancer</span> : <span className="text-slate-400">CCTP non importé</span>}
                      {stale && <div className="text-xs font-medium text-amber-700">DCE modifié depuis</div>}
                    </td>
                    <td className="px-3 py-3">
                      {sum ? (
                        <span className="flex flex-wrap gap-x-3 text-xs">
                          <span className="font-semibold text-red-700">🔴 {sum.critical} critique(s)</span>
                          <span className="text-orange-700">🟠 {sum.toCheck}</span>
                          <span className="text-emerald-700">🟢 {sum.confirmed}</span>
                          <span className="text-sky-700">❓ {sum.questions}</span>
                        </span>
                      ) : <span className="text-slate-400">—</span>}
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
