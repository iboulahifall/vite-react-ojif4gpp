import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Factory, Hourglass, Plus, Printer, Send } from 'lucide-react';
import { useStore } from '../state/store';
import type { Study } from '../domain/types';
import {
  compareOffers, consultationState, consultationSummary, isLate, offerTotal, uncoveredFamilies, STATUS_LABELS, type Consultation,
} from '../domain/consultations';
import { FAMILIES } from '../domain/catalog';
import { formatDate, formatEuro } from '../domain/format';
import { daysUntil } from '../domain/dates';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/ui/Badges';
import { GuideBanner, HelpBox } from '../components/ui/Help';
import { useToast } from '../components/ui/Toast';
import { KpiCard } from '../components/KpiCard';
import { RequestStatusBadge } from '../components/consultations/RequestStatusBadge';
import { ConsultationFormModal } from '../components/consultations/ConsultationFormModal';
import { useRequestActions } from '../components/consultations/useRequestActions';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';

export function ConsultationsPage() {
  const { id = '' } = useParams();
  const { getStudy } = useStore();
  const study = getStudy(id);
  if (!study) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <p className="text-lg font-semibold">Étude introuvable</p>
        <Link to="/consultations" className="mt-4 inline-block font-medium text-brand-700 underline">Choisir une étude</Link>
      </Card>
    );
  }
  return <ConsultationsView study={study} />;
}

const TONE = {
  danger: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-900',
  info: 'bg-sky-100 text-sky-800',
  success: 'bg-emerald-100 text-emerald-800',
};

function ConsultationCard({ study, c, actions }: { study: Study; c: Consultation; actions: ReturnType<typeof useRequestActions> }) {
  const { suppliers } = useStore();
  const navigate = useNavigate();
  const state = consultationState(c);
  const cmp = compareOffers(c, study.metre);
  const due = daysUntil(c.dueDate);
  const locked = study.status === 'remise';
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold uppercase tracking-wide text-slate-900">{c.label}</h3>
          <p className="text-xs text-slate-500">
            {c.kind === 'fournisseur' ? 'Fourniture' : 'Sous-traitance'} · {c.metreLineIds.length} ligne(s) de métré ·{' '}
            réponse attendue le <span className={clsx('font-semibold', due < 0 ? 'text-red-700' : due <= 2 ? 'text-orange-700' : 'text-slate-700')}>{formatDate(c.dueDate)}</span>
          </p>
        </div>
        <span className={clsx('whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold', TONE[state.tone])}>{state.label}</span>
      </div>
      <ul className="flex-1 divide-y divide-slate-100">
        {c.requests.map((r) => {
          const sup = suppliers.find((s) => s.id === r.supplierId);
          const total = r.offer ? offerTotal(r.offer, study.metre) : null;
          const rank = cmp.find((x) => x.requestId === r.id)?.rank;
          const late = isLate(r, c);
          return (
            <li key={r.id} className={clsx('px-4 py-2.5', c.retainedRequestId === r.id && 'bg-emerald-50/60')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                  {c.retainedRequestId === r.id && <CheckCircle2 size={14} className="mr-1 inline text-emerald-600" aria-label="Offre retenue" />}
                  {sup?.name ?? 'Fournisseur supprimé'}
                </span>
                <RequestStatusBadge status={r.status} late={late} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {r.sentAt && <span>Consulté le {formatDate(r.sentAt)}</span>}
                {r.reminders.length > 0 && <span>· {r.reminders.length} relance(s)</span>}
                {total !== null && <span className="font-semibold text-slate-900">· {formatEuro(total)} HT{rank === 1 && cmp.length > 1 ? ' — moins-disant' : ''}</span>}
                <span className="flex-1" />
                {!locked && r.status === 'a-envoyer' && <Button size="sm" variant="secondary" icon={<Send size={12} />} onClick={() => actions.send(c, r)}>Marquer envoyée</Button>}
                {!locked && (r.status === 'envoyee' || r.status === 'relancee') && (
                  <>
                    <Button size="sm" variant={late ? 'danger' : 'secondary'} onClick={() => actions.openRemind(c, r)}>Relancer</Button>
                    <Button size="sm" variant="secondary" onClick={() => actions.openOffer(c, r)}>Saisir l’offre</Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
        {c.requests.length === 0 && <li className="px-4 py-4 text-sm text-slate-500">Aucun fournisseur consulté.</li>}
      </ul>
      <button onClick={() => navigate(`/etudes/${study.id}/consultations/${c.id}`)}
        className="flex items-center justify-between rounded-b-xl border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 cursor-pointer">
        {cmp.length >= 2 ? `Comparer les ${cmp.length} offres` : 'Ouvrir la consultation'} <ArrowRight size={16} />
      </button>
    </Card>
  );
}

function ConsultationsView({ study }: { study: Study }) {
  const { createConsultation, suppliers } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const actions = useRequestActions(study);
  const [creating, setCreating] = useState<string | false>(false);
  const summary = useMemo(() => consultationSummary(study.consultations), [study.consultations]);
  const uncovered = uncoveredFamilies(study.families, study.consultations);
  const locked = study.status === 'remise';
  const sorted = useMemo(() => [...study.consultations].sort((a, b) => {
    const order = { danger: 0, warning: 1, info: 2, success: 3 };
    return order[consultationState(a).tone] - order[consultationState(b).tone] || a.dueDate.localeCompare(b.dueDate);
  }), [study.consultations]);

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Mes études', to: '/etudes' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'Consultations' }]}
        icon={<Factory size={24} />}
        title={<span className="flex flex-wrap items-center gap-2">Consultations — {study.name} {study.isDemo && <DemoBadge />}</span>}
        subtitle="Demandes de prix aux fournisseurs et sous-traitants : envoi, relances, offres et comparaison."
        actions={
          <>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer</Button>
            <Button icon={<Plus size={16} />} disabled={locked} onClick={() => setCreating('')}>Nouvelle consultation</Button>
          </>
        }
      />

      <GuideBanner step="Étape 3/7" title="Consultations : obtenir les prix">
        Créez une consultation par poste (TGBT, éclairage, SSI…) et choisissez les fournisseurs. Suivez les réponses, <strong>relancez</strong> les retardataires,
        saisissez les offres puis <strong>comparez</strong>-les pour retenir la meilleure.
      </GuideBanner>

      <div className="no-print grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Consultations" value={summary.consultations} icon={<Factory size={18} />} tone="brand" hint={`${summary.retained} offre(s) retenue(s)`} />
        <KpiCard label="Offres reçues" value={`${summary.received} / ${summary.requests}`} icon={<CheckCircle2 size={18} />} tone="emerald" hint="Réponses / demandes" />
        <KpiCard label="Prix en attente" value={summary.waiting + summary.toSend} icon={<Hourglass size={18} />} tone="violet" hint={summary.toSend ? `dont ${summary.toSend} demande(s) à envoyer` : 'Demandes envoyées sans réponse'} />
        <KpiCard label="À relancer" value={summary.late} icon={<Clock size={18} />} tone="red" hint="Réponse attendue dépassée" />
      </div>

      {uncovered.length > 0 && !locked && (
        <div className="no-print rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><AlertTriangle size={16} /> {uncovered.length} famille(s) du périmètre sans consultation</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {uncovered.map((fid) => {
              const f = FAMILIES.find((x) => x.id === fid)!;
              return <Button key={fid} size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setCreating(fid)}>{f.lot} · {f.label}</Button>;
            })}
          </div>
          <p className="mt-1 text-xs text-amber-800">Ces postes seront chiffrés avec vos prix de base si aucun fournisseur n’est consulté.</p>
        </div>
      )}

      {study.consultations.length === 0 ? (
        <Card className="p-8 text-center">
          <Factory size={36} className="mx-auto text-slate-300" />
          <p className="mt-3 font-semibold text-slate-800">Aucune consultation</p>
          <p className="text-sm text-slate-500">Commencez par les postes les plus importants (TGBT, éclairage, SSI…).</p>
          <Button className="mt-4" icon={<Plus size={16} />} disabled={locked} onClick={() => setCreating('')}>Nouvelle consultation</Button>
        </Card>
      ) : (
        <div className="no-print grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {sorted.map((c) => <ConsultationCard key={c.id} study={study} c={c} actions={actions} />)}
        </div>
      )}

      <HelpBox>
        <p>Une <strong>consultation</strong> regroupe les demandes de prix envoyées à plusieurs fournisseurs pour un même poste. Quand elle est liée aux lignes du <strong>métré</strong>, chaque fournisseur répond avec des prix unitaires sur les mêmes quantités : la comparaison est juste.</p>
        <p>Une demande est <strong>en retard</strong> quand la date de réponse attendue est dépassée : le bouton « Relancer » passe au rouge. Chaque relance est tracée (date, auteur, note).</p>
        <p>L’annuaire des fournisseurs est accessible depuis le menu <Link to="/fournisseurs" className="font-medium underline">Fournisseurs</Link>.</p>
      </HelpBox>

      {actions.modals}
      {creating !== false && (
        <ConsultationFormModal study={study} initialFamily={creating || undefined} onClose={() => setCreating(false)} onCreate={(f) => {
          const c = createConsultation(study.id, f);
          setCreating(false);
          toast(`Consultation « ${c.label} » créée`);
          navigate(`/etudes/${study.id}/consultations/${c.id}`);
        }} />
      )}

      <PrintDocument title="Suivi des consultations" reference={study.reference} demo={study.isDemo}>
        <div className="mb-3 text-[13pt] font-bold">{study.name}</div>
        <PrintSection title="Synthèse">
          <PrintTable head={['Consultations', 'Demandes', 'Offres reçues', 'En attente', 'À relancer', 'Offres retenues']} align={['center', 'center', 'center', 'center', 'center', 'center']}
            rows={[[summary.consultations, summary.requests, summary.received, summary.waiting + summary.toSend, summary.late, summary.retained]]} />
        </PrintSection>
        {study.consultations.map((c) => (
          <PrintSection key={c.id} title={`${c.label} — réponse attendue le ${formatDate(c.dueDate)}`}>
            <PrintTable head={['Fournisseur', 'Statut', 'Consulté le', 'Relances', 'Montant HT', 'Délai', 'Validité', 'Exclusions']}
              align={['left', 'left', 'left', 'center', 'right', 'left', 'left', 'left']}
              rows={c.requests.map((r) => {
                const t = r.offer ? offerTotal(r.offer, study.metre) : null;
                return [<>{suppliers.find((s) => s.id === r.supplierId)?.name ?? '—'}{c.retainedRequestId === r.id && <strong> (retenue)</strong>}</>,
                  isLate(r, c) ? 'EN RETARD' : STATUS_LABELS[r.status], r.sentAt ? formatDate(r.sentAt) : '—', r.reminders.length,
                  t !== null ? formatEuro(t) : '—', r.offer?.delay || '—', r.offer?.validUntil ? formatDate(r.offer.validUntil) : '—', r.offer?.exclusions || '—'];
              })} />
          </PrintSection>
        ))}
        {uncovered.length > 0 && <p className="text-[9pt]">Familles sans consultation : {uncovered.map((f) => FAMILIES.find((x) => x.id === f)?.label).join(', ')}.</p>}
      </PrintDocument>
    </div>
  );
}

