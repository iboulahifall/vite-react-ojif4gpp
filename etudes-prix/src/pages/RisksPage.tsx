import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertOctagon, AlertTriangle, Eye, Euro, FileSearch, Pencil, Plus, Printer, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import type { Study } from '../domain/types';
import { isRiskActive, riskCode, riskSummary, RISK_CATEGORY_LABELS, RISK_LEVEL_LABELS, RISK_STATUS_LABELS, type Risk, type RiskLevel3, type RiskStatus } from '../domain/risks';
import { buildUp } from '../domain/chiffrage';
import { findingStatus } from '../domain/analysis/summary';
import { formatEuro } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/ui/Badges';
import { GuideBanner, HelpBox } from '../components/ui/Help';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { KpiCard } from '../components/KpiCard';
import { RiskFormModal } from '../components/followup/RiskFormModal';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';

export function RisksPage() {
  const { id = '' } = useParams();
  const study = useStore().getStudy(id);
  if (!study) return <Card className="mx-auto max-w-lg p-8 text-center"><p className="text-lg font-semibold">Étude introuvable</p><Link to="/risques" className="mt-4 inline-block font-medium text-brand-700 underline">Choisir une étude</Link></Card>;
  return <RisksView study={study} />;
}

const LANES: { level: RiskLevel3; title: string; cls: string; Icon: typeof AlertOctagon }[] = [
  { level: 'critique', title: '🔴 Critique', cls: 'border-red-200 bg-red-50/50', Icon: AlertOctagon },
  { level: 'important', title: '🟠 Important', cls: 'border-orange-200 bg-orange-50/50', Icon: AlertTriangle },
  { level: 'surveiller', title: '🟡 À surveiller', cls: 'border-yellow-200 bg-yellow-50/50', Icon: Eye },
];

const STATUS_CLS: Record<RiskStatus, string> = {
  ouvert: 'bg-red-100 text-red-800', 'en-cours': 'bg-sky-100 text-sky-800', maitrise: 'bg-emerald-100 text-emerald-800', clos: 'bg-slate-200 text-slate-600',
};

function RiskCard({ study, r, onEdit, onStatus, onDelete }: { study: Study; r: Risk; onEdit: () => void; onStatus: (s: RiskStatus) => void; onDelete: () => void }) {
  const locked = study.status === 'remise';
  return (
    <article className={clsx('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', !isRiskActive(r) && 'opacity-70')}>
      <div className="flex items-start gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold tabular text-slate-700">{riskCode(r)}</span>
        <h3 className="min-w-0 flex-1 font-semibold text-slate-900">{r.title}</h3>
        <span className={clsx('whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold', STATUS_CLS[r.status])}>{RISK_STATUS_LABELS[r.status]}</span>
      </div>
      {r.description && <p className="mt-1.5 text-sm text-slate-700">{r.description}</p>}
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div><dt className="text-slate-500">Source</dt><dd className="font-medium text-slate-800">
          {r.source.docId ? <Link to={`/etudes/${study.id}/dce?doc=${encodeURIComponent(r.source.docId)}${r.source.page ? `&page=${r.source.page}` : ''}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><FileSearch size={12} /> {r.source.label}</Link> : r.source.label || '—'}
        </dd></div>
        <div><dt className="text-slate-500">Montant potentiel</dt><dd className="font-semibold tabular text-slate-900">{r.amount !== null ? formatEuro(r.amount) : '—'}</dd></div>
        <div className="col-span-2"><dt className="text-slate-500">Impact</dt><dd className="text-slate-800">{r.impact || '—'}</dd></div>
        <div><dt className="text-slate-500">Responsable</dt><dd className="text-slate-800">{r.owner || '—'}</dd></div>
        <div><dt className="text-slate-500">Nature</dt><dd className="text-slate-800">{RISK_CATEGORY_LABELS[r.category]}</dd></div>
        <div className="col-span-2"><dt className="text-slate-500">Action</dt><dd className={clsx(r.action ? 'text-slate-800' : 'font-semibold text-red-700')}>{r.action || '⚠ Aucune action définie'}</dd></div>
      </dl>
      {!locked && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
          <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={onEdit}>Modifier</Button>
          {r.status === 'ouvert' && <Button size="sm" variant="secondary" onClick={() => onStatus('en-cours')}>Action lancée</Button>}
          {isRiskActive(r) && <Button size="sm" variant="secondary" onClick={() => onStatus('maitrise')}>Maîtrisé</Button>}
          {!isRiskActive(r) && <Button size="sm" variant="ghost" onClick={() => onStatus('ouvert')}>Rouvrir</Button>}
          <span className="flex-1" />
          <button onClick={onDelete} className="rounded p-1 text-slate-400 hover:text-red-700 cursor-pointer" aria-label={`Supprimer ${riskCode(r)}`}><Trash2 size={14} /></button>
        </div>
      )}
    </article>
  );
}

function RisksView({ study }: { study: Study }) {
  const store = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState<Risk | 'new' | null>(null);
  const [pending, setPending] = useState<{ kind: 'status'; r: Risk; status: RiskStatus } | { kind: 'delete'; r: Risk } | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const locked = study.status === 'remise';
  const sum = riskSummary(study.risks);
  const provision = study.chiffrage.lines.length ? buildUp(study.metre, study.chiffrage).risk : null;
  const suggestions = useMemo(() => (study.analysis?.findings ?? []).filter((f) =>
    f.level === 'critique' && findingStatus(f, study.analysisDecisions) === 'ouvert' && f.category !== 'document' && !study.risks.some((r) => r.source.findingId === f.id)), [study]);
  const visible = study.risks.filter((r) => showClosed || isRiskActive(r));

  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'Risques' }]} icon={<ShieldAlert size={24} />}
        title={<span className="flex flex-wrap items-center gap-2">Risques — {study.name} {study.isDemo && <DemoBadge />}</span>}
        subtitle="Risques techniques, financiers, planning et contractuels de l’offre."
        actions={<>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer</Button>
          <Button icon={<Plus size={16} />} disabled={locked} onClick={() => setEditing('new')}>Nouveau risque</Button>
        </>} />

      <GuideBanner title="Risques : identifier ce qui peut coûter cher">
        Recensez chaque risque avec son <strong>impact</strong>, son <strong>montant potentiel</strong> et l’<strong>action</strong> prévue (question, provision, réserve).
        Un risque <strong>critique</strong> doit toujours avoir une action. Comparez l’exposition totale avec la provision pour aléas du chiffrage.
      </GuideBanner>

      <div className="no-print grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Critiques" value={sum.critical} icon={<AlertOctagon size={18} />} tone="red" hint={sum.withoutAction ? `⚠ ${sum.withoutAction} sans action` : 'Tous ont une action'} />
        <KpiCard label="Importants" value={sum.important} icon={<AlertTriangle size={18} />} tone="amber" hint={`${sum.watch} à surveiller`} />
        <KpiCard label="Exposition" value={formatEuro(sum.exposure)} icon={<Euro size={18} />} tone="violet" hint="Montants potentiels des risques actifs"
          help="Somme des montants potentiels des risques ouverts ou en cours. Ce n’est pas une prévision : c’est l’ordre de grandeur de ce qui est en jeu." />
        <KpiCard label="Provision aléas" value={provision !== null ? formatEuro(provision) : '—'} icon={<ShieldAlert size={18} />} tone="emerald"
          hint={provision === null ? 'Chiffrage non commencé' : sum.exposure > provision ? `⚠ Inférieure à l’exposition (${Math.round((provision / (sum.exposure || 1)) * 100)} %)` : 'Couvre l’exposition'}
          help="Montant « aléas » du chiffrage (V1.6). S’il est très inférieur à l’exposition, augmentez le taux d’aléas ou traitez les risques." />
      </div>

      {suggestions.length > 0 && !locked && (
        <div className="no-print rounded-xl border border-violet-200 bg-violet-50 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-violet-900"><Sparkles size={16} /> {suggestions.length} point(s) critique(s) de l’analyse non repris en risque</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.slice(0, 8).map((f) => (
              <Button key={f.id} size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => { const r = store.riskFromFinding(study.id, f.id); if (r) { toast(`${riskCode(r)} créé`); setEditing(r); } }}>{f.title}</Button>
            ))}
          </div>
        </div>
      )}

      <div className="no-print flex justify-end">
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Afficher les risques maîtrisés et clos ({sum.closed})</label>
      </div>

      <div className="no-print grid gap-4 lg:grid-cols-3">
        {LANES.map((lane) => {
          const items = visible.filter((r) => r.level === lane.level).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
          return (
            <section key={lane.level} className={clsx('rounded-2xl border p-3', lane.cls)}>
              <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-bold uppercase tracking-wide text-slate-700">
                {lane.title} <span className="rounded-full bg-white px-2 text-xs tabular">{items.length}</span>
              </h2>
              <div className="space-y-3">
                {items.map((r) => <RiskCard key={r.id} study={study} r={r} onEdit={() => setEditing(r)} onStatus={(s) => setPending({ kind: 'status', r, status: s })} onDelete={() => setPending({ kind: 'delete', r })} />)}
                {items.length === 0 && <p className="px-1 py-4 text-center text-sm text-slate-500">Aucun risque {RISK_LEVEL_LABELS[lane.level].toLowerCase()}.</p>}
              </div>
            </section>
          );
        })}
      </div>

      <HelpBox>
        <p>Un <strong>risque</strong> est un événement qui peut dégrader le résultat de l’affaire : hypothèse non confirmée, clause pénalisante, quantité incertaine, délai tendu…</p>
        <p>🔴 <strong>Critique</strong> : peut rendre l’offre déficitaire ou non conforme — action obligatoire. 🟠 <strong>Important</strong> : impact notable à maîtriser. 🟡 <strong>À surveiller</strong> : impact limité.</p>
        <p>Les points critiques de l’analyse du DCE peuvent être repris en risque en un clic. Chaque modification est tracée dans l’historique de l’étude.</p>
      </HelpBox>

      {editing && <RiskFormModal risk={editing === 'new' ? undefined : editing} owner={store.settings.userName} onClose={() => setEditing(null)}
        onSave={(f) => { const r = store.saveRisk(study.id, f, editing === 'new' ? 'Nouveau risque' : 'Modification du risque'); setEditing(null); if (r) toast(`${riskCode(r)} enregistré`); }} />}
      {pending && (
        <ConfirmDialog open askReason danger={pending.kind === 'delete'} reasonRequired={pending.kind === 'delete' || (pending.kind === 'status' && pending.status === 'maitrise' && pending.r.level === 'critique')}
          title={pending.kind === 'delete' ? `Supprimer ${riskCode(pending.r)} ?` : `${riskCode(pending.r)} : ${RISK_STATUS_LABELS[pending.status]} ?`}
          message={<><strong>{pending.r.title}</strong>{pending.kind === 'status' && pending.status === 'maitrise' ? ' — indiquez comment le risque est maîtrisé.' : ''}</>}
          confirmLabel={pending.kind === 'delete' ? 'Supprimer' : 'Confirmer'}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => {
            if (pending.kind === 'delete') { store.deleteRisk(study.id, pending.r.id, reason); toast('Risque supprimé'); }
            else { store.saveRisk(study.id, { ...pending.r, status: pending.status }, reason || RISK_STATUS_LABELS[pending.status]); toast('Statut mis à jour'); }
            setPending(null);
          }} />
      )}

      <PrintDocument title="Registre des risques" reference={study.reference} demo={study.isDemo}>
        <div className="mb-3 text-[13pt] font-bold">{study.name}</div>
        <PrintSection title="Synthèse">
          <PrintTable head={['Critiques', 'Importants', 'À surveiller', 'Exposition', 'Provision aléas']} align={['center', 'center', 'center', 'right', 'right']}
            rows={[[sum.critical, sum.important, sum.watch, formatEuro(sum.exposure), provision !== null ? formatEuro(provision) : '—']]} />
        </PrintSection>
        <PrintSection title="Risques">
          <PrintTable head={['N°', 'Niveau', 'Risque', 'Source', 'Impact', 'Montant', 'Responsable', 'Action', 'Statut']} align={['left', 'left', 'left', 'left', 'left', 'right', 'left', 'left', 'left']}
            rows={[...study.risks].sort((a, b) => ['critique', 'important', 'surveiller'].indexOf(a.level) - ['critique', 'important', 'surveiller'].indexOf(b.level)).map((r) => [
              riskCode(r), RISK_LEVEL_LABELS[r.level], <><strong>{r.title}</strong>{r.description && <><br />{r.description}</>}</>, r.source.label || '—', r.impact || '—',
              r.amount !== null ? formatEuro(r.amount) : '—', r.owner, r.action || 'AUCUNE', RISK_STATUS_LABELS[r.status]])} />
        </PrintSection>
      </PrintDocument>
    </div>
  );
}

