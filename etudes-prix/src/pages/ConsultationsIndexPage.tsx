import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory } from 'lucide-react';
import { useStore } from '../state/store';
import { isActive } from '../domain/workflow';
import { sortByPriority } from '../domain/kpi';
import { consultationSummary } from '../domain/consultations';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { DemoBadge, StatusBadge } from '../components/ui/Badges';
import { HelpBox } from '../components/ui/Help';

/** Entrée « Consultations » du menu : suivi des demandes de prix par étude. */
export function ConsultationsIndexPage() {
  const { studies } = useStore();
  const navigate = useNavigate();
  const rows = useMemo(() => [...sortByPriority(studies), ...studies.filter((s) => !isActive(s))], [studies]);
  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Consultations' }]} icon={<Factory size={24} />} title="Consultations"
        subtitle="Choisissez une étude pour suivre ses demandes de prix." />
      <HelpBox><p>Vue d’ensemble des consultations fournisseurs de toutes vos études. La colonne <strong>À relancer</strong> compte les demandes dont la date de réponse est dépassée.</p></HelpBox>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Étude</th><th className="px-3 py-2.5">Étape</th><th className="px-3 py-2.5 text-right">Consultations</th><th className="px-3 py-2.5 text-right">Offres reçues</th><th className="px-3 py-2.5 text-right">En attente</th><th className="px-5 py-2.5 text-right">À relancer</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => {
                const m = consultationSummary(s.consultations);
                return (
                  <tr key={s.id} tabIndex={0} onClick={() => navigate(`/etudes/${s.id}/consultations`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/etudes/${s.id}/consultations`)}
                    className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none">
                    <td className="min-w-[280px] px-5 py-3">
                      <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.isDemo && <DemoBadge />}</div>
                      <div className="text-xs text-slate-500">{s.reference} · {s.client}</div>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-3 text-right tabular">{m.consultations || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-3 text-right tabular">{m.requests ? `${m.received} / ${m.requests}` : '—'}</td>
                    <td className="px-3 py-3 text-right tabular">{m.requests ? m.waiting + m.toSend : s.indicators.pendingPrices ? <span title="Saisie manuelle">{s.indicators.pendingPrices}*</span> : '—'}</td>
                    <td className="px-5 py-3 text-right tabular">{m.late ? <span className="font-semibold text-red-700">⏳ {m.late}</span> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">* Prix en attente saisis manuellement (étude sans consultation dans l’application).</p>
      </Card>
    </div>
  );
}
