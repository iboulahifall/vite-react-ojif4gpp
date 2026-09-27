import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import { useStore } from '../state/store';
import { isActive } from '../domain/workflow';
import { sortByPriority } from '../domain/kpi';
import { buildUp } from '../domain/chiffrage';
import { formatEuro } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { DemoBadge, StatusBadge } from '../components/ui/Badges';
import { HelpBox } from '../components/ui/Help';

/** Entrée « Chiffrage » du menu : état du chiffrage de chaque étude. */
export function ChiffrageIndexPage() {
  const { studies } = useStore();
  const navigate = useNavigate();
  const rows = useMemo(() => [...sortByPriority(studies), ...studies.filter((s) => !isActive(s))], [studies]);
  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Chiffrage' }]} icon={<Calculator size={24} />} title="Chiffrage"
        subtitle="Choisissez une étude pour chiffrer ses postes." />
      <HelpBox><p>Le chiffrage d’une étude s’appuie sur son métré. La colonne <strong>Prix manquants</strong> compte les lignes encore sans prix ; les prix <strong>estimés</strong> viennent de la base indicative et restent à confirmer.</p></HelpBox>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Étude</th><th className="px-3 py-2.5">Étape</th><th className="px-3 py-2.5 text-right">Déboursé sec</th><th className="px-3 py-2.5 text-right">Prix de vente</th><th className="px-3 py-2.5 text-right">Prix manquants</th><th className="px-5 py-2.5 text-right">À confirmer / estimés</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => {
                const b = s.chiffrage.lines.length ? buildUp(s.metre, s.chiffrage) : null;
                return (
                  <tr key={s.id} tabIndex={0} onClick={() => navigate(`/etudes/${s.id}/chiffrage`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/etudes/${s.id}/chiffrage`)}
                    className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none">
                    <td className="min-w-[280px] px-5 py-3">
                      <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.isDemo && <DemoBadge />}</div>
                      <div className="text-xs text-slate-500">{s.reference} · {s.client}</div>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-3 text-right tabular">{b ? formatEuro(b.dryCost) : <span className="text-slate-400">{s.metre.length ? 'À chiffrer' : 'Métré à créer'}</span>}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular">{b ? formatEuro(b.salePrice) : '—'}</td>
                    <td className="px-3 py-3 text-right tabular">{b ? (b.missing ? <span className="font-semibold text-red-700">🔴 {b.missing}</span> : '✓ 0') : '—'}</td>
                    <td className="px-5 py-3 text-right tabular">{b ? `${b.toConfirm} / ${b.estimated}` : '—'}</td>
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
