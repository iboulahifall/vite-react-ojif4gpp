import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorPlay, Printer } from 'lucide-react';
import { useStore } from '../state/store';
import { isActive } from '../domain/workflow';
import { amountOf, sortByPriority } from '../domain/kpi';
import { versionLabel } from '../domain/validation';
import { formatEuro } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge, StatusBadge } from '../components/ui/Badges';
import { HelpBox } from '../components/ui/Help';

/** Entrée « Rapports » du menu. */
export function ReportsIndexPage() {
  const { studies } = useStore();
  const navigate = useNavigate();
  const rows = useMemo(() => [...sortByPriority(studies), ...studies.filter((s) => !isActive(s))], [studies]);
  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Rapports' }]} icon={<Printer size={24} />} title="Rapports"
        subtitle="Rapport complet, synthèse réunion, exports et mode présentation."
        actions={<Button variant="secondary" icon={<MonitorPlay size={16} />} onClick={() => navigate('/presentation')}>📺 Mode présentation</Button>} />
      <HelpBox><p>Choisissez une étude pour générer son <strong>rapport PDF</strong> (impression, ou « Enregistrer au format PDF »). Le <strong>mode présentation</strong> affiche les études en grand, pour une réunion ou un vidéoprojecteur. La liste des études s’exporte en CSV depuis <strong>Mes études</strong>.</p></HelpBox>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Étude</th><th className="px-3 py-2.5">Étape</th><th className="px-3 py-2.5 text-right">Montant HT</th><th className="px-3 py-2.5">Version</th><th className="px-5 py-2.5 text-right">Documents</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="min-w-[280px] px-5 py-3"><div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.isDemo && <DemoBadge />}</div><div className="text-xs text-slate-500">{s.reference} · {s.client}</div></td>
                  <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-3 py-3 text-right tabular">{formatEuro(amountOf(s))}</td>
                  <td className="px-3 py-3">{s.validation ? <span className="font-semibold text-emerald-700">🔒 {versionLabel(s)} validée</span> : <span className="text-slate-500">{versionLabel(s)} projet</span>}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button size="sm" onClick={() => navigate(`/etudes/${s.id}/rapport`)}>Rapport</Button>
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/presentation/${s.id}`)} aria-label={`Présenter ${s.name}`}>📺</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
