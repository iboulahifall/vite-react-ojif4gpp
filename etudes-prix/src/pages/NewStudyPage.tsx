import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Check, FileText, ListTree, Plus, Rocket, ScanSearch, CalendarRange, ClipboardList, RotateCcw } from 'lucide-react';
import { useStore } from '../state/store';
import type { Lot, StudyDraft } from '../domain/types';
import { emptyDraft, nextReference, validateProjectStep, type DraftErrors } from '../domain/studyFactory';
import { familiesOfLots, MARKET_LABELS, RISK_LABELS, missingDocs } from '../domain/catalog';
import { preAnalyse } from '../domain/preAnalysis';
import { generatePlan, isPlanTight } from '../domain/planning';
import { formatDate, formatEuro } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { GuideBanner, HelpBox } from '../components/ui/Help';
import { RiskBadge } from '../components/ui/Badges';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { ProjectFields } from '../components/study/ProjectFields';
import { DceChecklist } from '../components/study/DceChecklist';
import { FamilyTree } from '../components/study/FamilyTree';
import { PlanEditor } from '../components/study/PlanEditor';

const STEPS = [
  { key: 'projet', label: 'Projet', icon: ClipboardList, title: 'Informations générales',
    guide: 'Renseignez l’identité de l’appel d’offres. Les champs marqués * sont obligatoires.' },
  { key: 'dce', label: 'DCE', icon: FileText, title: 'Pièces du DCE',
    guide: 'Cochez les pièces du dossier de consultation que vous avez reçues. Les pièces manquantes seront signalées.' },
  { key: 'analyse', label: 'Analyse', icon: ScanSearch, title: 'Analyse du dossier',
    guide: 'L’application contrôle la cohérence du dossier déclaré et liste les points à traiter en priorité.' },
  { key: 'postes', label: 'Postes', icon: ListTree, title: 'Validation des postes',
    guide: 'Décochez les familles de postes qui ne font pas partie de votre périmètre.' },
  { key: 'travail', label: 'Travail', icon: CalendarRange, title: 'Plan de travail',
    guide: 'Un rétro-planning a été calculé à partir de la date de remise. Ajustez les dates si besoin.' },
  { key: 'etude', label: 'Étude', icon: Rocket, title: 'Démarrage de l’étude',
    guide: 'Vérifiez le récapitulatif puis cliquez sur « Démarrer l’étude ».' },
] as const;

function WizardSteps({ step, maxVisited, onGo }: { step: number; maxVisited: number; onGo: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2" aria-label="Étapes de création">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        const reachable = i <= maxVisited;
        return (
          <li key={s.key} className="flex items-center">
            {i > 0 && <span aria-hidden className={clsx('mx-1.5 h-0.5 w-4 sm:w-8', i <= step ? 'bg-brand-600' : 'bg-slate-200')} />}
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onGo(i)}
              aria-current={active ? 'step' : undefined}
              className={clsx('flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition',
                active ? 'bg-brand-700 text-white shadow' : done ? 'bg-brand-50 text-brand-800 hover:bg-brand-100' : 'text-slate-400',
                reachable && !active && 'cursor-pointer')}
            >
              <span className={clsx('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                active ? 'bg-white text-brand-700' : done ? 'bg-brand-700 text-white' : 'border border-slate-300')}>
                {done ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              {s.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Summary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

export function NewStudyPage() {
  const { studies, settings, createStudy } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [draft, setDraft] = useState<StudyDraft>(() => emptyDraft(settings.userName, nextReference(studies.map((s) => s.reference))));
  const [planDueDate, setPlanDueDate] = useState(draft.dueDate);
  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [cancelOpen, setCancelOpen] = useState(false);

  const patch = (p: Partial<StudyDraft>) => {
    setDraft((d) => {
      const next = { ...d, ...p };
      if (p.lots) {
        // Ajout d'un lot : ses familles sont cochées ; retrait : elles sont retirées.
        const added = p.lots.filter((l) => !d.lots.includes(l));
        const keep = next.families.filter((id) => familiesOfLots(p.lots as Lot[]).some((f) => f.id === id));
        next.families = [...keep, ...familiesOfLots(added).map((f) => f.id)];
      }
      return next;
    });
    if (Object.keys(errors).length) setErrors({});
  };

  const findings = useMemo(() => preAnalyse(draft), [draft]);
  const missing = missingDocs(draft.dceDocs, draft.lots);

  const goTo = (i: number) => {
    if (i > step && step === 0) {
      const e = validateProjectStep(draft);
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    // Plan recalculé si la date de remise a changé depuis son calcul.
    if (i >= 4 && planDueDate !== draft.dueDate) {
      setDraft((d) => ({ ...d, plan: generatePlan(d.dueDate) }));
      setPlanDueDate(draft.dueDate);
    }
    setStep(i);
    setMaxVisited((m) => Math.max(m, i));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const start = () => {
    const e = validateProjectStep(draft);
    if (Object.keys(e).length) { setErrors(e); setStep(0); return; }
    const study = createStudy(draft);
    toast(`Étude « ${study.name} » créée`);
    navigate(`/etudes/${study.id}`);
  };

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Mes études', to: '/etudes' }, { label: 'Nouvelle étude' }]}
        icon={<Plus size={24} />}
        title="Nouvelle étude"
        subtitle="Un assistant en 6 étapes pour créer et préparer votre appel d’offres."
      />

      <Card className="px-4 py-3"><WizardSteps step={step} maxVisited={maxVisited} onGo={goTo} /></Card>

      <GuideBanner step={`Étape ${step + 1}/${STEPS.length}`} title={current.title}>{current.guide}</GuideBanner>

      <Card>
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <span className="rounded-lg bg-brand-50 p-2 text-brand-700"><Icon size={20} /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Étape {step + 1} sur {STEPS.length}</p>
            <h2 className="text-lg font-semibold text-slate-900">{current.title}</h2>
          </div>
        </div>

        <div className="px-6 py-6">
          {step === 0 && <ProjectFields value={draft} errors={errors} onChange={patch} />}

          {step === 1 && (
            <div className="space-y-4">
              <DceChecklist docs={draft.dceDocs} lots={draft.lots}
                onToggle={(t) => patch({ dceDocs: draft.dceDocs.map((d) => (d.type === t ? { ...d, received: !d.received } : d)) })} />
              <p className={clsx('rounded-lg px-3 py-2 text-sm', missing.length ? 'bg-orange-50 text-orange-900' : 'bg-emerald-50 text-emerald-900')}>
                {missing.length ? `⚠ ${missing.length} pièce(s) manquante(s) : vous pourrez continuer et les compléter plus tard.` : '✓ Toutes les pièces attendues sont déclarées reçues.'}
              </p>
              <p className="text-xs text-slate-500">📎 L’import et la visualisation des fichiers (PDF, Excel, Word) arrivent avec le module DCE (V1.2). Ici, vous déclarez les pièces reçues.</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <ul className="space-y-2">
                {findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <RiskBadge level={f.level} label={f.level === 'ok' ? 'OK' : undefined} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{f.title}</p>
                      <p className="text-sm text-slate-600">{f.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500">🔎 L’analyse automatique du contenu (CCTP, DPGF, comparaison CCTP / DPGF) arrive en V1.3. Cette pré-analyse porte sur les pièces déclarées, les lots et le délai.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <FamilyTree lots={draft.lots} selected={draft.families} onChange={(families) => patch({ families })} />
              <p className="text-xs text-slate-500">Le détail des lignes de chaque famille (métré) sera disponible en V1.4.</p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {isPlanTight(draft.dueDate) && (
                <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900">⚠ Délai court : moins de 10 jours avant la remise. Lancez les consultations fournisseurs au plus tôt.</p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">Remise prévue le <strong>{formatDate(draft.dueDate)}</strong> à {draft.dueTime}.</p>
                <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={() => patch({ plan: generatePlan(draft.dueDate) })}>Recalculer le plan</Button>
              </div>
              <PlanEditor plan={draft.plan} onChange={(plan) => patch({ plan })} />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{draft.name}</h3>
                <p className="text-sm text-slate-600">{draft.client}{draft.location && ` · ${draft.location}`}</p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Summary label="Référence">{draft.reference}</Summary>
                <Summary label="Remise">{formatDate(draft.dueDate)} à {draft.dueTime}</Summary>
                <Summary label="Montant estimé">{formatEuro(draft.estimatedAmount)} HT</Summary>
                <Summary label="Responsable">{draft.owner}</Summary>
                <Summary label="Marché">{MARKET_LABELS[draft.marketType]}</Summary>
                <Summary label="Lots">{draft.lots.join(' + ')}</Summary>
                <Summary label="Familles retenues">{draft.families.length} / {familiesOfLots(draft.lots).length}</Summary>
                <Summary label="Risque pressenti">{RISK_LABELS[draft.riskLevel]}</Summary>
              </dl>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-900">Points d’attention</p>
                <ul className="space-y-1.5">
                  {findings.map((f, i) => <li key={i} className="flex items-center gap-2 text-sm"><RiskBadge level={f.level} compact /> {f.title}</li>)}
                </ul>
              </div>
              <p className="text-sm text-slate-600">L’étude démarrera à l’étape <strong>1 · Analyse DCE</strong>. Vous pourrez modifier toutes ces informations ensuite.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 rounded-b-xl">
          <Button variant="ghost" onClick={() => setCancelOpen(true)}>Annuler</Button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => goTo(step - 1)}>Précédent</Button>}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => goTo(step + 1)}>Continuer <ArrowRight size={16} /></Button>
            ) : (
              <Button variant="success" size="lg" icon={<Rocket size={18} />} onClick={start}>Démarrer l’étude</Button>
            )}
          </div>
        </div>
      </Card>

      <HelpBox>
        <p>L’assistant prépare votre étude en 6 étapes : <strong>projet → DCE → analyse → postes → plan de travail → démarrage</strong>.</p>
        <p>Rien n’est enregistré avant le clic sur « Démarrer l’étude ». Vous pouvez revenir sur une étape déjà vue en cliquant dessus dans la barre d’étapes.</p>
      </HelpBox>

      <ConfirmDialog
        open={cancelOpen}
        title="Abandonner la création ?"
        message="Les informations saisies dans l’assistant seront perdues."
        confirmLabel="Abandonner"
        danger
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => navigate('/')}
      />
    </div>
  );
}
