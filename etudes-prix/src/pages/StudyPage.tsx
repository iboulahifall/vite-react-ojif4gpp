import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  AlertOctagon, ArrowRight, BarChart3, Calendar, Factory, FolderOpen, Ruler, CalendarRange, Euro, FileText, HelpCircle, History, Hourglass, ListTree, Minus,
  Pencil, Plus, Printer, SkipBack, Target, Trash2, User,
} from 'lucide-react';
import { useStore, type TrackedChange } from '../state/store';
import type { Study, StudyIndicators, StudyStatus } from '../domain/types';
import { STAGES, nextAction, nextStatus, previousStatus, stageIndex, stageOf } from '../domain/workflow';
import { daysUntil } from '../domain/dates';
import { dceDocInfo, familiesOfLots, FAMILIES, isDocRelevant, MARKET_LABELS, RISK_LABELS } from '../domain/catalog';
import { formatDate, formatDateTime, formatDaysLeft, formatEuro } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge, RiskBadge, StatusBadge, Tag } from '../components/ui/Badges';
import { ProgressBar } from '../components/ui/ProgressBar';
import { GuideBanner, HelpBox, InfoTip } from '../components/ui/Help';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { WorkflowStepper } from '../components/WorkflowStepper';
import { pendingPricesOf } from '../domain/kpi';
import { NextActionPill } from '../components/NextActionPill';
import { PlanEditor } from '../components/study/PlanEditor';
import { FamilyTree } from '../components/study/FamilyTree';
import { DceStatusBadge } from '../components/dce/DceStatusBadge';
import { dceCompleteness, dceStatus } from '../domain/documents';
import { EditStudyModal } from '../components/study/EditStudyModal';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';

type Pending =
  | { kind: 'status'; to: StudyStatus }
  | { kind: 'progress'; to: number }
  | { kind: 'edit'; patch: Partial<Study>; changes: TrackedChange[] }
  | { kind: 'delete' };

type Tab = 'plan' | 'postes' | 'dce' | 'historique';

const INDICATORS: { key: keyof StudyIndicators; label: string; icon: ReactNode; help: string; tone: string }[] = [
  { key: 'criticalRisks', label: 'Risques critiques', icon: <AlertOctagon size={16} />, tone: 'text-red-700 bg-red-50',
    help: 'Risques techniques ou financiers pouvant fortement impacter le prix. Sera alimenté par le module Risques (V1.7).' },
  { key: 'openQuestions', label: 'Questions ouvertes', icon: <HelpCircle size={16} />, tone: 'text-sky-700 bg-sky-50',
    help: 'Questions posées au maître d’ouvrage sans réponse. Sera alimenté par le module Questions (V1.7).' },
  { key: 'pendingPrices', label: 'Prix en attente', icon: <Hourglass size={16} />, tone: 'text-violet-700 bg-violet-50',
    help: 'Prix demandés aux fournisseurs / sous-traitants non encore reçus. Sera alimenté par le module Consultations (V1.5).' },
];

function Info({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-600">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-900">{children}</div>
      </div>
    </div>
  );
}

export function StudyPage() {
  const { id = '' } = useParams();
  const { getStudy, ready } = useStore();
  const study = getStudy(id);
  if (!ready) return null;
  if (!study) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <p className="text-lg font-semibold">Étude introuvable</p>
        <p className="mt-1 text-sm text-slate-600">Elle a peut-être été supprimée.</p>
        <Link to="/etudes" className="mt-4 inline-block font-medium text-brand-700 underline">Retour à mes études</Link>
      </Card>
    );
  }
  return <StudyView study={study} />;
}

function StudyView({ study }: { study: Study }) {
  const { setStatus, setProgress, updateStudy, deleteStudy, settings } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('plan');
  const [progressDraft, setProgressDraft] = useState(study.progress);
  useEffect(() => setProgressDraft(study.progress), [study.progress]);

  const stage = stageOf(study.status);
  const idx = stageIndex(study.status);
  const next = nextStatus(study.status);
  const prev = previousStatus(study.status);
  const action = nextAction(study);
  const days = daysUntil(study.dueDate);
  const families = useMemo(() => FAMILIES.filter((f) => study.families.includes(f.id)), [study.families]);
  const locked = study.status === 'remise';
  const dceSummary = useMemo(() => dceCompleteness(study), [study]);

  const confirm = (reason: string) => {
    if (!pending) return;
    switch (pending.kind) {
      case 'status':
        setStatus(study.id, pending.to, reason);
        toast(`Étape « ${stageOf(pending.to).label} » enregistrée`);
        break;
      case 'progress':
        setProgress(study.id, pending.to, reason);
        toast('Avancement mis à jour');
        break;
      case 'edit':
        updateStudy(study.id, pending.patch, pending.changes, reason);
        setEditing(false);
        toast('Informations enregistrées');
        break;
      case 'delete':
        deleteStudy(study.id);
        toast('Étude supprimée');
        navigate('/etudes');
        break;
    }
    setPending(null);
  };

  const setIndicator = (key: keyof StudyIndicators, value: number) => {
    const v = Math.max(0, value);
    const label = INDICATORS.find((i) => i.key === key)!.label;
    updateStudy(study.id, { indicators: { ...study.indicators, [key]: v } },
      [{ field: label, oldValue: String(study.indicators[key]), newValue: String(v) }], 'Mise à jour manuelle');
  };

  const dialog = (() => {
    if (!pending) return null;
    switch (pending.kind) {
      case 'status': {
        const back = stageIndex(pending.to) < idx;
        return {
          title: back ? 'Revenir à une étape précédente ?' : 'Changer d’étape ?',
          message: <>L’étude passera de <strong>{stage.label}</strong> à <strong>{stageOf(pending.to).label}</strong>.</>,
          impact: pending.to === 'remise'
            ? 'L’étude sera considérée comme remise : elle sortira des études en cours et ses informations seront verrouillées.'
            : back ? 'Le retour en arrière est tracé dans l’historique.' : 'Les tâches du plan de travail de l’étape actuelle seront marquées comme terminées.',
          confirmLabel: pending.to === 'remise' ? 'Confirmer la remise' : 'Confirmer',
        };
      }
      case 'progress':
        return {
          title: 'Modifier l’avancement ?',
          message: <>L’avancement passera de <strong>{study.progress} %</strong> à <strong>{pending.to} %</strong>.</>,
          impact: 'Cette valeur est visible sur le tableau de bord et dans les rapports.',
          confirmLabel: 'Confirmer',
        };
      case 'edit':
        return {
          title: 'Enregistrer les modifications ?',
          message: (
            <ul className="space-y-1">
              {pending.changes.map((c, i) => (
                <li key={i}><strong>{c.field}</strong> : <span className="text-slate-500 line-through">{c.oldValue}</span> → <span className="font-semibold">{c.newValue}</span></li>
              ))}
            </ul>
          ),
          impact: pending.changes.some((c) => c.field === 'Montant estimé' || c.field === 'Date de remise')
            ? 'Le montant ou la date de remise impactent le tableau de bord et les priorités.' : undefined,
          confirmLabel: 'Enregistrer',
        };
      case 'delete':
        return {
          title: 'Supprimer cette étude ?',
          message: <>L’étude <strong>{study.name}</strong> et tout son historique seront définitivement supprimés.</>,
          impact: 'Cette action est irréversible.',
          confirmLabel: 'Supprimer définitivement',
          danger: true,
        };
    }
  })();

  const tabs: { id: Tab; label: string; icon: ReactNode; count?: number }[] = [
    { id: 'plan', label: 'Plan de travail', icon: <CalendarRange size={16} />, count: study.plan.filter((t) => !t.done).length },
    { id: 'postes', label: 'Périmètre / postes', icon: <ListTree size={16} />, count: study.families.length },
    { id: 'dce', label: 'Pièces DCE', icon: <FileText size={16} />, count: dceSummary.missing.length || undefined },
    { id: 'historique', label: 'Historique', icon: <History size={16} />, count: study.history.length },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Mes études', to: '/etudes' }, { label: study.reference }]}
        title={<span className="flex flex-wrap items-center gap-2">{study.name} {study.isDemo && <DemoBadge />}</span>}
        subtitle={<>{study.reference} · {MARKET_LABELS[study.marketType]} · {study.lots.map((l) => <Tag key={l} tone="brand">{l}</Tag>)}</>}
        actions={
          <>
            <Button variant="secondary" icon={<FileText size={16} />} onClick={() => navigate(`/etudes/${study.id}/dce`)}>DCE ({study.documents.length})</Button>
            <Button variant="secondary" icon={<BarChart3 size={16} />} onClick={() => navigate(`/etudes/${study.id}/analyse`)}>Analyse</Button>
            <Button variant="secondary" icon={<Ruler size={16} />} onClick={() => navigate(`/etudes/${study.id}/metre`)}>Métré</Button>
            <Button variant="secondary" icon={<Factory size={16} />} onClick={() => navigate(`/etudes/${study.id}/consultations`)}>Consultations</Button>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer</Button>
            <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditing(true)} disabled={locked}>Modifier</Button>
            <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setPending({ kind: 'delete' })} aria-label="Supprimer l’étude" title="Supprimer l’étude" className="text-red-700 hover:bg-red-50" />
          </>
        }
      />

      <GuideBanner
        step={`Étape ${idx + 1}/${STAGES.length}`}
        title={`${stage.label} — ${locked ? 'étude terminée' : 'que faire maintenant ?'}`}
        action={!locked && (
          <>
            {study.status === 'analyse' && <Button size="sm" variant="secondary" onClick={() => navigate(`/etudes/${study.id}/dce`)}>Ouvrir le DCE</Button>}
            {study.status === 'analyse' && <Button size="sm" variant="secondary" onClick={() => navigate(`/etudes/${study.id}/analyse`)}>Analyser</Button>}
            {study.status === 'metre' && <Button size="sm" variant="secondary" onClick={() => navigate(`/etudes/${study.id}/metre`)}>Ouvrir le métré</Button>}
            {study.status === 'consultation' && <Button size="sm" variant="secondary" onClick={() => navigate(`/etudes/${study.id}/consultations`)}>Ouvrir les consultations</Button>}
            {next && <Button size="sm" onClick={() => setPending({ kind: 'status', to: next })}>Étape suivante <ArrowRight size={14} /></Button>}
          </>
        )}
      >
        {stage.todo}{' '}
        {!locked && <>Une fois l’étape terminée, cliquez sur <strong>Étape suivante</strong>. L’outil dédié à cette étape arrive en {stage.module}.</>}
      </GuideBanner>

      <div className="no-print grid items-start gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Info icon={<User size={16} />} label="Client">{study.client}</Info>
            <Info icon={<Calendar size={16} />} label="Date de remise">
              {formatDate(study.dueDate)} à {study.dueTime}
              {!locked && <span className={clsx('block text-xs', days < 0 ? 'text-red-700' : days < 7 ? 'text-orange-700' : 'text-slate-500')}>{formatDaysLeft(days)}</span>}
            </Info>
            <Info icon={<User size={16} />} label="Responsable">{study.owner}</Info>
            <Info icon={<Euro size={16} />} label="Montant estimé">{formatEuro(study.estimatedAmount)} HT</Info>
          </div>
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">Avancement global</span>
              <span className="flex items-center gap-2 text-sm">Statut : <StatusBadge status={study.status} /> <RiskBadge level={study.riskLevel} /></span>
            </div>
            <ProgressBar value={study.progress} size="lg" />
          </div>
          <div className="border-t border-slate-100 px-5 pb-4 pt-5">
            <WorkflowStepper status={study.status} onSelect={locked ? undefined : (s) => s !== study.status && setPending({ kind: 'status', to: s })} />
            {!locked && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {prev && <Button variant="ghost" size="sm" icon={<SkipBack size={14} />} onClick={() => setPending({ kind: 'status', to: prev })}>Revenir à « {stageOf(prev).short} »</Button>}
                {next && <Button icon={<ArrowRight size={16} />} onClick={() => setPending({ kind: 'status', to: next })}>Passer à l’étape suivante : {stageOf(next).label}</Button>}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={<Target size={18} />} title="Prochaine action" />
            <div className="space-y-2 p-5">
              <NextActionPill action={action} />
              <p className="text-sm text-slate-700">{action.reason}</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Indicateurs" subtitle={study.consultations.length ? 'Prix en attente calculés depuis les consultations' : 'Saisie manuelle'} />
            <ul className="divide-y divide-slate-100">
              {INDICATORS.map((ind) => (
                <li key={ind.key} className="flex items-center gap-3 px-5 py-3">
                  <span className={clsx('rounded-lg p-1.5', ind.tone)}>{ind.icon}</span>
                  <span className="flex-1 text-sm font-medium text-slate-700">{ind.label} <InfoTip text={ind.help} /></span>
                  {ind.key === 'pendingPrices' && study.consultations.length > 0 ? (
                    <Link to={`/etudes/${study.id}/consultations`} className="flex items-center gap-2 text-lg font-bold tabular text-brand-800 hover:underline" title="Calculé depuis les consultations">
                      {pendingPricesOf(study)} <span className="text-xs font-normal text-slate-500">calculé</span>
                    </Link>
                  ) : (
                  <div className="flex items-center gap-1">
                    <button disabled={locked || study.indicators[ind.key] === 0} onClick={() => setIndicator(ind.key, study.indicators[ind.key] - 1)}
                      className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer" aria-label={`Diminuer ${ind.label}`}><Minus size={14} /></button>
                    <span className="w-8 text-center text-lg font-bold tabular">{study.indicators[ind.key]}</span>
                    <button disabled={locked} onClick={() => setIndicator(ind.key, study.indicators[ind.key] + 1)}
                      className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer" aria-label={`Augmenter ${ind.label}`}><Plus size={14} /></button>
                  </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          {!locked && (
            <Card>
              <CardHeader title="Ajuster l’avancement" subtitle={`Étape actuelle : à partir de ${stage.minProgress} %`} />
              <div className="space-y-3 p-5">
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={99} value={progressDraft} onChange={(e) => setProgressDraft(Number(e.target.value))}
                    className="flex-1 accent-brand-700" aria-label="Avancement en pourcentage" />
                  <span className="w-12 text-right font-bold tabular">{progressDraft} %</span>
                </div>
                <Button size="sm" className="w-full" disabled={progressDraft === study.progress}
                  onClick={() => setPending({ kind: 'progress', to: progressDraft })}>Enregistrer l’avancement</Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card className="no-print">
        <div role="tablist" className="flex overflow-x-auto border-b border-slate-200 px-3">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={clsx('flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium cursor-pointer',
                tab === t.id ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800')}>
              {t.icon} {t.label}
              {t.count !== undefined && <span className={clsx('rounded-full px-1.5 text-xs', t.id === 'dce' && dceSummary.missing.length ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600')}>{t.count}</span>}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'plan' && (
            <PlanEditor plan={study.plan} currentStage={locked ? undefined : study.status}
              onChange={locked ? undefined : (plan) => updateStudy(study.id, { plan }, [], '')} />
          )}
          {tab === 'postes' && (
            <FamilyTree lots={study.lots} selected={study.families} readOnly={locked}
              onChange={(ids) => {
                const added = ids.filter((x) => !study.families.includes(x));
                const removed = study.families.filter((x) => !ids.includes(x));
                const name = (fid: string) => FAMILIES.find((f) => f.id === fid)!.label;
                updateStudy(study.id, { families: ids }, [
                  ...added.map((a) => ({ field: 'Périmètre', oldValue: '—', newValue: `${name(a)} ajouté` })),
                  ...removed.map((r) => ({ field: 'Périmètre', oldValue: name(r), newValue: 'retiré' })),
                ], 'Validation des postes');
              }} />
          )}
          {tab === 'dce' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-700">
                  <strong>{dceSummary.imported}/{dceSummary.expected}</strong> pièces importées · {study.documents.length} fichier(s)
                  {dceSummary.missing.length > 0 && <span className="text-red-700"> · ⚠ manquant : {dceSummary.missing.map((m) => m.label).join(', ')}</span>}
                </p>
                <Button icon={<FolderOpen size={16} />} onClick={() => navigate(`/etudes/${study.id}/dce`)}>Ouvrir le DCE</Button>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {dceStatus(study).map((st) => (
                  <li key={st.category} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">📄 {st.label}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {st.files.length ? st.files.map((f) => f.name).join(', ') : dceDocInfo(st.category).role}
                      </span>
                    </span>
                    <DceStatusBadge state={st.state} />
                    {(st.state === 'missing' || st.state === 'declared') && !locked && (
                      <button className="text-xs font-medium text-brand-700 underline cursor-pointer" title="Pièce reçue par un autre moyen (papier, plateforme…)"
                        onClick={() => {
                          const received = st.state === 'missing';
                          updateStudy(study.id, { dceDocs: study.dceDocs.map((d) => (d.type === st.category ? { ...d, received } : d)) },
                            [{ field: `Pièce DCE ${st.label}`, oldValue: received ? 'Manquante' : 'Reçue', newValue: received ? 'Reçue (non importée)' : 'Manquante' }],
                            'Mise à jour des pièces');
                        }}>
                        {st.state === 'missing' ? 'Déclarer reçue' : 'Marquer manquante'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tab === 'historique' && (
            <ol className="space-y-3">
              {study.history.map((h) => (
                <li key={h.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="tabular">{formatDateTime(h.date)}</span>
                    <span>Utilisateur : <strong className="text-slate-700">{h.user}</strong></span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{h.field}</p>
                  <p className="text-sm tabular">
                    <span className="text-slate-500">{STAGES.find((s) => s.id === h.oldValue)?.label ?? h.oldValue}</span>
                    <span className="mx-2 text-slate-400">→</span>
                    <span className="font-medium text-slate-900">{STAGES.find((s) => s.id === h.newValue)?.label ?? h.newValue}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Motif : {h.reason}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      <HelpBox>
        <p>La fiche étude montre <strong>où en est l’étude</strong> (barre d’étapes), <strong>ce qu’il faut faire</strong> (prochaine action) et <strong>ce qui bloque</strong> (indicateurs, pièces manquantes).</p>
        <p>Chaque modification importante (étape, avancement, montant, date) est confirmée puis enregistrée dans l’<strong>historique</strong> avec l’ancienne valeur, la nouvelle, l’utilisateur, la date et le motif.</p>
      </HelpBox>

      {/* La confirmation est rendue après le formulaire pour s'afficher au-dessus. */}
      <EditStudyModal study={study} open={editing} onClose={() => setEditing(false)}
        onSubmit={(patch, changes) => setPending({ kind: 'edit', patch, changes })} />
      {dialog && (
        <ConfirmDialog open title={dialog.title} message={dialog.message} impact={dialog.impact} confirmLabel={dialog.confirmLabel}
          danger={'danger' in dialog ? dialog.danger : false} askReason={pending?.kind !== 'delete'}
          onCancel={() => setPending(null)} onConfirm={confirm} />
      )}

      <PrintDocument title="Fiche étude de prix" reference={study.reference} version={`V1 — ${stage.label}`} demo={study.isDemo}>
        <div className="mb-4">
          <div className="text-[16pt] font-bold">{study.name}</div>
          <div className="text-slate-700">{[study.client, study.location, MARKET_LABELS[study.marketType]].filter(Boolean).join(" · ")}</div>
        </div>
        <PrintSection title="Synthèse">
          <PrintTable head={['Remise', 'Responsable', 'Montant estimé HT', 'Étape', 'Avancement', 'Risque']}
            rows={[[`${formatDate(study.dueDate)} à ${study.dueTime}`, study.owner, formatEuro(study.estimatedAmount), `${idx + 1}/7 · ${stage.label}`, `${study.progress} %`, RISK_LABELS[study.riskLevel]]]} />
          <p className="mt-2"><strong>Prochaine action :</strong> {action.label} — {action.reason}</p>
          <p><strong>Indicateurs :</strong> {study.indicators.criticalRisks} risque(s) critique(s) · {study.indicators.openQuestions} question(s) ouverte(s) · {pendingPricesOf(study)} prix en attente</p>
        </PrintSection>
        <PrintSection title="Plan de travail">
          <PrintTable head={['#', 'Tâche', 'Étape', 'Échéance', 'État']} align={['right', 'left', 'left', 'left', 'left']}
            rows={study.plan.map((t, i) => [i + 1, t.label, stageOf(t.stage).label, formatDate(t.dueDate), t.done ? 'Terminé' : 'À faire'])} />
        </PrintSection>
        <PrintSection title="Pièces du DCE">
          <PrintTable head={['Pièce', 'Rôle', 'État']}
            rows={study.dceDocs.map((d) => [dceDocInfo(d.type).label, dceDocInfo(d.type).role,
              !isDocRelevant(d.type, study.lots) ? 'Sans objet' : d.received ? 'Reçue' : 'MANQUANTE'])} />
        </PrintSection>
        <PrintSection title="Périmètre retenu">
          <PrintTable head={['Lot', 'Famille', 'Contenu']}
            rows={families.map((f) => [f.lot, f.label, f.description])} />
          {familiesOfLots(study.lots).length > families.length && (
            <p className="mt-1 text-[9pt]">Familles exclues : {familiesOfLots(study.lots).filter((f) => !study.families.includes(f.id)).map((f) => f.label).join(', ')}</p>
          )}
        </PrintSection>
        <PrintSection title="Historique des modifications">
          <PrintTable head={['Date', 'Utilisateur', 'Élément', 'Ancienne valeur', 'Nouvelle valeur', 'Motif']}
            rows={study.history.slice(0, 30).map((h) => [formatDateTime(h.date), h.user, h.field,
              STAGES.find((s) => s.id === h.oldValue)?.label ?? h.oldValue, STAGES.find((s) => s.id === h.newValue)?.label ?? h.newValue, h.reason])} />
        </PrintSection>
        {study.notes && <PrintSection title="Notes"><p className="whitespace-pre-wrap">{study.notes}</p></PrintSection>}
        <p className="mt-6 text-[8.5pt] text-slate-600">Document de suivi interne généré par {settings.companyName}. Les indicateurs reflètent l’état des saisies à la date d’impression.</p>
      </PrintDocument>
    </div>
  );
}
