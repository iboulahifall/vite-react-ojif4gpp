import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, ShieldAlert } from 'lucide-react';
import { useStore } from '../state/store';
import { isActive } from '../domain/workflow';
import { sortByPriority } from '../domain/kpi';
import { questionSummary, riskSummary } from '../domain/risks';
import { formatEuro } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { DemoBadge, StatusBadge } from '../components/ui/Badges';
import { HelpBox } from '../components/ui/Help';

function useRows() {
  const { studies } = useStore();
  return useMemo(() => [...sortByPriority(studies), ...studies.filter((s) => !isActive(s))], [studies]);
}

/** Entrée « Risques » du menu. */
export function RisksIndexPage() {
  const rows = useRows();
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Risques' }]} icon={<ShieldAlert size={24} />} title="Risques" subtitle="Choisissez une étude pour gérer ses risques." />
      <HelpBox><p>Vue d’ensemble des risques de toutes les études. <strong>Exposition</strong> : somme des montants potentiels des risques actifs.</p></HelpBox>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Étude</th><th className="px-3 py-2.5">Étape</th><th className="px-3 py-2.5 text-right">🔴 Critiques</th><th className="px-3 py-2.5 text-right">🟠 Importants</th><th className="px-3 py-2.5 text-right">🟡 À surveiller</th><th className="px-5 py-2.5 text-right">Exposition</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => {
                const r = riskSummary(s.risks);
                return (
                  <tr key={s.id} tabIndex={0} onClick={() => navigate(`/etudes/${s.id}/risques`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/etudes/${s.id}/risques`)} className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none">
                    <td className="min-w-[280px] px-5 py-3"><div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.isDemo && <DemoBadge />}</div><div className="text-xs text-slate-500">{s.reference} · {s.client}</div></td>
                    <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-3 text-right font-semibold tabular text-red-700">{s.risks.length ? r.critical : s.indicators.criticalRisks ? `${s.indicators.criticalRisks}*` : '—'}</td>
                    <td className="px-3 py-3 text-right tabular">{s.risks.length ? r.important : '—'}</td>
                    <td className="px-3 py-3 text-right tabular">{s.risks.length ? r.watch : '—'}</td>
                    <td className="px-5 py-3 text-right tabular">{s.risks.length ? formatEuro(r.exposure) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">* Nombre saisi manuellement (étude sans registre des risques).</p>
      </Card>
    </div>
  );
}

/** Entrée « Questions » du menu. */
export function QuestionsIndexPage() {
  const rows = useRows();
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Questions' }]} icon={<HelpCircle size={24} />} title="Questions" subtitle="Choisissez une étude pour suivre ses questions au maître d’ouvrage." />
      <HelpBox><p>Vue d’ensemble des questions de toutes les études. Les questions <strong>bloquantes</strong> conditionnent le prix.</p></HelpBox>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Étude</th><th className="px-3 py-2.5">Étape</th><th className="px-3 py-2.5 text-right">Ouvertes</th><th className="px-3 py-2.5 text-right">Bloquantes</th><th className="px-3 py-2.5 text-right">En retard</th><th className="px-5 py-2.5 text-right">Répondues</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => {
                const q = questionSummary(s.questions);
                return (
                  <tr key={s.id} tabIndex={0} onClick={() => navigate(`/etudes/${s.id}/questions`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/etudes/${s.id}/questions`)} className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none">
                    <td className="min-w-[280px] px-5 py-3"><div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.isDemo && <DemoBadge />}</div><div className="text-xs text-slate-500">{s.reference} · {s.client}</div></td>
                    <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-3 text-right tabular">{s.questions.length ? q.open : s.indicators.openQuestions ? `${s.indicators.openQuestions}*` : '—'}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular text-red-700">{s.questions.length ? q.blocking : '—'}</td>
                    <td className="px-3 py-3 text-right tabular">{q.late ? <span className="font-semibold text-orange-700">⏳ {q.late}</span> : '—'}</td>
                    <td className="px-5 py-3 text-right tabular">{s.questions.length ? q.answered : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">* Nombre saisi manuellement (étude sans suivi des questions).</p>
      </Card>
    </div>
  );
}
