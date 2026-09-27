import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useStore } from '../state/store';
import { dceCompleteness } from '../domain/documents';
import { isActive } from '../domain/workflow';
import { sortByPriority } from '../domain/kpi';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { DemoBadge, StatusBadge } from '../components/ui/Badges';
import { HelpBox } from '../components/ui/Help';
import { DueDate } from '../components/DueDate';

/** Entrée « DCE » du menu : choisir l'étude dont on veut ouvrir le dossier. */
export function DceIndexPage() {
  const { studies } = useStore();
  const navigate = useNavigate();
  const rows = useMemo(() => [...sortByPriority(studies), ...studies.filter((s) => !isActive(s))], [studies]);
  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'DCE' }]} icon={<FileText size={24} />} title="DCE"
        subtitle="Choisissez une étude pour ouvrir son dossier de consultation." />
      <HelpBox><p>Chaque étude a son propre DCE. La colonne <strong>Pièces</strong> indique combien de pièces attendues sont importées et lesquelles manquent.</p></HelpBox>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Étude</th><th className="px-3 py-2.5">Remise</th><th className="px-3 py-2.5">Étape</th><th className="px-3 py-2.5">Pièces</th><th className="px-5 py-2.5">Fichiers</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => {
                const c = dceCompleteness(s);
                return (
                  <tr key={s.id} tabIndex={0} onClick={() => navigate(`/etudes/${s.id}/dce`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/etudes/${s.id}/dce`)}
                    className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none">
                    <td className="min-w-[280px] px-5 py-3">
                      <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.isDemo && <DemoBadge />}</div>
                      <div className="text-xs text-slate-500">{s.reference} · {s.client}</div>
                    </td>
                    <td className="px-3 py-3"><DueDate iso={s.dueDate} done={!isActive(s)} /></td>
                    <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-3">
                      <div className="font-semibold tabular">{c.imported}/{c.expected} importées</div>
                      {c.missing.length > 0
                        ? <div className="text-xs font-medium text-red-700">⚠ Manquant : {c.missing.map((m) => m.label).join(', ')}</div>
                        : <div className="text-xs text-emerald-700">✓ Rien de manquant</div>}
                    </td>
                    <td className="px-5 py-3 tabular">{s.documents.length}</td>
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
