import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlarmClock, AlertOctagon, BarChart3, CheckCircle2, Euro, Flame, FolderOpen, Hourglass, ListChecks, Plus, Printer } from 'lucide-react';
import { useStore } from '../state/store';
import { computeAlerts, computeKpis, countByStatus, sortByPriority } from '../domain/kpi';
import { formatEuro, formatEuroCompact } from '../domain/format';
import { nextAction, stageOf } from '../domain/workflow';
import { KpiCard } from '../components/KpiCard';
import { StatusChart } from '../components/StatusChart';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge, RiskBadge, StatusBadge } from '../components/ui/Badges';
import { ProgressBar } from '../components/ui/ProgressBar';
import { GuideBanner, HelpBox } from '../components/ui/Help';
import { PageHeader } from '../components/ui/PageHeader';
import { NextActionPill } from '../components/NextActionPill';
import { DueDate } from '../components/DueDate';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';
import { formatDate } from '../domain/format';
import { RISK_LABELS } from '../domain/catalog';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
}

export function DashboardPage() {
  const { studies, settings } = useStore();
  const navigate = useNavigate();
  const kpis = useMemo(() => computeKpis(studies), [studies]);
  const byStatus = useMemo(() => countByStatus(studies), [studies]);
  const priorities = useMemo(() => sortByPriority(studies), [studies]);
  const alerts = useMemo(() => computeAlerts(studies).filter((a) => a.kind !== 'due-soon'), [studies]);
  const demo = studies.find((s) => s.isDemo && s.id === 'demo-1');
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord' }]}
        title={`${greeting()} ${settings.userName}`}
        subtitle={<span className="inline-block first-letter:uppercase">{today}</span>}
        actions={
          <>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer</Button>
            <Button size="lg" icon={<Plus size={18} />} onClick={() => navigate('/nouvelle-etude')}>Nouvelle étude</Button>
          </>
        }
      />

      <GuideBanner
        title="Bienvenue ! Ce tableau de bord résume toutes vos études en cours."
        action={demo && <Button size="sm" onClick={() => navigate(`/etudes/${demo.id}`)}>Ouvrir le projet démo</Button>}
      >
        Regardez d’abord les <strong>chiffres clés</strong>, puis la liste <strong>🔥 Priorités</strong> : chaque ligne indique la
        prochaine action. Pour découvrir une étude complète, ouvrez le projet de démonstration.
      </GuideBanner>

      <div className="no-print grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Études en cours" value={kpis.activeCount} icon={<FolderOpen size={18} />} tone="brand" to="/etudes?statut=en-cours"
          hint={`${kpis.readyToValidate} prête(s) à valider`} />
        <KpiCard label="Échéances < 7 jours" value={kpis.dueSoonCount} icon={<AlarmClock size={18} />} tone="amber" to="/etudes?filtre=echeance"
          hint={kpis.overdueCount > 0 ? <span className="font-semibold text-red-700">⛔ {kpis.overdueCount} en retard</span> : 'Aucune en retard'} />
        <KpiCard label="Montant estimé" value={formatEuroCompact(kpis.activeAmount)} icon={<Euro size={18} />} tone="emerald" to="/etudes?statut=en-cours"
          hint="Total HT des études en cours"
          help="Somme des montants estimés (HT) des études non encore remises. Le montant réellement chiffré sera calculé par le module Chiffrage (V1.6)." />
        <KpiCard label="Risques critiques" value={kpis.criticalRisks} icon={<AlertOctagon size={18} />} tone="red" to="/etudes?filtre=risque"
          hint="Sur l’ensemble des études"
          help="Nombre de risques jugés critiques (financiers ou techniques). En V1.1, ce nombre est saisi sur chaque étude ; il sera alimenté par le module Risques (V1.7)." />
        <KpiCard label="Prix en attente" value={kpis.pendingPrices} icon={<Hourglass size={18} />} tone="violet" to="/etudes?filtre=prix"
          hint="Réponses fournisseurs attendues"
          help="Nombre de prix demandés aux fournisseurs ou sous-traitants et pas encore reçus. Sera alimenté par le module Consultations (V1.5)." />
      </div>

      <div className="no-print grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader icon={<BarChart3 size={18} />} title="Études par étape" subtitle="Où en sont vos études ? Cliquez sur une barre pour voir la liste." />
          <div className="px-4 pb-2 pt-4">
            <StatusChart data={byStatus} />
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader icon={<ListChecks size={18} />} title="À traiter" subtitle="Ce qui bloque ou attend une décision" />
          <ul className="max-h-[304px] divide-y divide-slate-100 overflow-y-auto">
            {alerts.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500"><CheckCircle2 className="mx-auto mb-2 text-emerald-500" />Rien de bloquant.</li>}
            {alerts.map((a, i) => (
              <li key={i}>
                <Link to={`/etudes/${a.studyId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
                  <RiskBadge level={a.level} compact />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">{a.message}</div>
                    <div className="truncate text-xs text-slate-500">{a.studyName}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="no-print">
        <CardHeader
          icon={<Flame size={18} className="text-orange-500" />}
          title="Priorités"
          subtitle="Études en cours classées par urgence (échéance, puis risque). Cliquez sur une ligne pour l’ouvrir."
          actions={<Link to="/etudes" className="text-sm font-medium text-brand-700 hover:underline">Toutes les études →</Link>}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Projet</th>
                <th className="px-3 py-2.5">Échéance</th>
                <th className="px-3 py-2.5">Étape</th>
                <th className="px-3 py-2.5 w-44">Avancement</th>
                <th className="px-3 py-2.5">Risque</th>
                <th className="px-5 py-2.5">Prochaine action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {priorities.slice(0, 8).map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/etudes/${s.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/etudes/${s.id}`)}
                  tabIndex={0}
                  className="cursor-pointer transition hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none"
                >
                  <td className="min-w-[300px] px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{s.name}</span>
                      {s.isDemo && <DemoBadge />}
                    </div>
                    <div className="text-xs text-slate-500">{s.reference} · {s.client} · {formatEuro(s.estimatedAmount)}</div>
                  </td>
                  <td className="px-3 py-3"><DueDate iso={s.dueDate} /></td>
                  <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-3 py-3"><ProgressBar value={s.progress} size="sm" /></td>
                  <td className="px-3 py-3"><RiskBadge level={s.riskLevel} /></td>
                  <td className="px-5 py-3"><NextActionPill action={nextAction(s)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {priorities.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              Aucune étude en cours. <Link to="/nouvelle-etude" className="font-medium text-brand-700 underline">Créer une étude</Link>
            </div>
          )}
        </div>
      </Card>

      <HelpBox>
        <p>Le tableau de bord répond en un coup d’œil aux questions du matin : <strong>quelles études sont en cours, laquelle est urgente, où en est chacune, qu’est-ce qui bloque, quels prix manquent, quels risques existent et laquelle est prête à être validée</strong>.</p>
        <p>Les cartes du haut sont cliquables et ouvrent la liste des études correspondantes.</p>
      </HelpBox>

      <PrintDocument title="Tableau de bord — Portefeuille des études" demo={studies.some((s) => s.isDemo)}>
        <PrintSection title="Chiffres clés">
          <PrintTable
            head={['Études en cours', 'Échéances < 7 j', 'En retard', 'Montant estimé HT', 'Risques critiques', 'Prix en attente']}
            align={['center', 'center', 'center', 'center', 'center', 'center']}
            rows={[[kpis.activeCount, kpis.dueSoonCount, kpis.overdueCount, formatEuro(kpis.activeAmount), kpis.criticalRisks, kpis.pendingPrices]]}
          />
        </PrintSection>
        <PrintSection title="Études en cours par priorité">
          <PrintTable
            head={['Réf.', 'Projet / client', 'Remise', 'Étape', 'Av.', 'Risque', 'Montant HT', 'Prochaine action']}
            align={['left', 'left', 'left', 'left', 'right', 'left', 'right', 'left']}
            rows={priorities.map((s) => [
              s.reference,
              <><strong>{s.name}</strong><br />{s.client}</>,
              formatDate(s.dueDate),
              stageOf(s.status).label,
              `${s.progress} %`,
              RISK_LABELS[s.riskLevel],
              formatEuro(s.estimatedAmount),
              nextAction(s).label,
            ])}
            foot={['', 'Total', '', '', '', '', formatEuro(kpis.activeAmount), '']}
          />
        </PrintSection>
      </PrintDocument>
    </div>
  );
}
