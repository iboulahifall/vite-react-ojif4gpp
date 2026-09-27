import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ruler } from 'lucide-react';
import { useStore } from '../state/store';
import { isActive } from '../domain/workflow';
import { sortByPriority } from '../domain/kpi';
import { metreSummary } from '../domain/metre';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { DemoBadge, StatusBadge } from '../components/ui/Badges';
import { HelpBox } from '../components/ui/Help';
import { ProgressBar } from '../components/ui/ProgressBar';

/** Entrée « Métré » du menu : avancement du métré de chaque étude. */
export function MetreIndexPage() {
  const { studies } = useStore();
  const navigate = useNavigate();
  const rows = useMemo(() => [...sortByPriority(studies), ...studies.filter((s) => !isActive(s))], [studies]);
  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Métré' }]} icon={<Ruler size={24} />} title="Métré"
        subtitle="Choisissez une étude pour établir ou contrôler ses quantités." />
      <HelpBox><p>Le métré de chaque étude se crée à partir de sa DPGF. La colonne <strong>Validé</strong> indique la part des quantités contrôlées.</p></HelpBox>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Étude</th><th className="px-3 py-2.5">Étape</th><th className="px-3 py-2.5">Lignes</th><th className="w-48 px-3 py-2.5">Validé</th><th className="px-3 py-2.5">Points d’attention</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => {
                const m = metreSummary(s.metre);
                const hasDpgf = s.documents.some((d) => d.category === 'DPGF');
                return (
                  <tr key={s.id} tabIndex={0} onClick={() => navigate(`/etudes/${s.id}/metre`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/etudes/${s.id}/metre`)}
                    className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none">
                    <td className="min-w-[280px] px-5 py-3">
                      <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.isDemo && <DemoBadge />}</div>
                      <div className="text-xs text-slate-500">{s.reference} · {s.client}</div>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-3 tabular">{m.total || (hasDpgf ? <span className="font-medium text-brand-700">À créer</span> : <span className="text-slate-400">DPGF absente</span>)}</td>
                    <td className="px-3 py-3">{m.total ? <ProgressBar value={(m.validated / m.total) * 100} size="sm" /> : '—'}</td>
                    <td className="px-3 py-3 text-xs">
                      {m.total ? (
                        <span className="flex flex-wrap gap-x-3">
                          {m.majorGaps > 0 && <span className="font-semibold text-red-700">▲ {m.majorGaps} écart(s) &gt; 10 %</span>}
                          {m.toEstablish > 0 && <span className="text-orange-700">⚠ {m.toEstablish} à établir</span>}
                          {!m.majorGaps && !m.toEstablish && <span className="text-emerald-700">✓ Aucun</span>}
                        </span>
                      ) : '—'}
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
