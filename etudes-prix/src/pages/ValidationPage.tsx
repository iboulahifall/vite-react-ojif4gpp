import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, BadgeCheck, CheckCircle2, Lock, LockOpen, OctagonX, Printer, SearchCheck, Send } from 'lucide-react';
import { useStore } from '../state/store';
import { useAuth } from '../state/auth';
import type { Study } from '../domain/types';
import { snapshotOf, validationReadiness, versionLabel, VALIDATION_ITEMS, type ValidationSnapshot } from '../domain/validation';
import { scoreOf } from '../domain/review';
import { formatDate, formatDateTime, formatEuro } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/ui/Badges';
import { GuideBanner, HelpBox } from '../components/ui/Help';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';

export function ValidationPage() {
  const { id = '' } = useParams();
  const study = useStore().getStudy(id);
  if (!study) return <Card className="mx-auto max-w-lg p-8 text-center"><p className="text-lg font-semibold">Étude introuvable</p><Link to="/validation" className="mt-4 inline-block font-medium text-brand-700 underline">Choisir une étude</Link></Card>;
  return <ValidationView study={study} />;
}

/** Lignes du récapitulatif (écran et impression). */
function recapRows(s: Study, snap: ValidationSnapshot): { label: string; value: ReactNode; warn?: boolean; strong?: boolean }[] {
  const priced = snap.salePrice > 0;
  return [
    { label: 'Déboursé sec', value: priced ? formatEuro(snap.dryCost) : '—' },
    { label: 'Prix de revient', value: priced ? formatEuro(snap.costPrice) : '—' },
    { label: 'Prix de vente HT', value: priced ? formatEuro(snap.salePrice) : `${formatEuro(snap.amount)} (montant estimé, pas de chiffrage détaillé)`, strong: true, warn: !priced },
    { label: 'Marge', value: priced ? `${formatEuro(snap.margin)} (${snap.marginPct.toLocaleString('fr-FR')} % du prix de vente)` : '—' },
    { label: 'Risques critiques', value: snap.criticalRisks, warn: snap.criticalRisks > 0 },
    { label: 'Questions ouvertes', value: snap.openQuestions, warn: snap.openQuestions > 0 },
    { label: 'Prix fournisseurs manquants', value: snap.pendingPrices, warn: snap.pendingPrices > 0 },
    { label: 'Lignes sans prix', value: snap.missingPrices, warn: snap.missingPrices > 0 },
    { label: 'Revue de prix', value: snap.reviewScore === null ? 'Non lancée' : `${snap.reviewScore} % — ${snap.reviewBlocking} bloquant(s), ${snap.reviewToCheck} à vérifier`, warn: snap.reviewScore === null || snap.reviewBlocking > 0 },
    { label: 'Date de remise', value: `${formatDate(s.dueDate)} à ${s.dueTime}` },
  ];
}

function ValidationView({ study }: { study: Study }) {
  const store = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const v = study.validation;
  const snap = v?.snapshot ?? snapshotOf(study);
  const ready = validationReadiness(study);
  const [checked, setChecked] = useState<string[]>([]);
  const [approver, setApprover] = useState('');
  const [comment, setComment] = useState('');
  const [reserves, setReserves] = useState(false);
  const [pending, setPending] = useState<'validate' | 'unlock' | 'submit' | null>(null);
  const done = study.status === 'remise';
  const auth = useAuth();
  const roleBlocked = !auth.canValidate;
  const allChecked = VALIDATION_ITEMS.every((i) => checked.includes(i.id));
  const canValidate = !v && !done && !roleBlocked && ready.reviewOk && allChecked && !!approver.trim() && (ready.blocking === 0 || reserves);
  const missing = [
    roleBlocked && `validation réservée à la direction (votre rôle : ${auth.user?.roleLabel})`,
    !ready.reviewOk && ready.reason,
    !allChecked && `${VALIDATION_ITEMS.length - checked.length} case(s) à cocher`,
    !approver.trim() && 'nom de la personne ayant validé le prix',
    ready.reviewOk && ready.blocking > 0 && !reserves && 'confirmer la validation avec réserves',
  ].filter(Boolean) as string[];
  const rows = recapRows(study, snap);
  const review = study.review ? scoreOf(study.review.checks, study.reviewJustifications) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Mes études', to: '/etudes' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'Validation' }]}
        icon={<BadgeCheck size={24} />}
        title={<span className="flex flex-wrap items-center gap-2">Validation — {study.name} {study.isDemo && <DemoBadge />}</span>}
        subtitle="Synthèse avant remise, validation humaine et verrouillage de l’étude."
        actions={<Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer la fiche</Button>}
      />

      <GuideBanner step="Étape 6/7" title="Validation : la décision reste humaine">
        {v ? <>L’étude est <strong>validée et verrouillée</strong>. Générez le dossier final, puis marquez l’offre comme remise. Pour la modifier, déverrouillez-la (motif obligatoire) : elle devra être revalidée.</>
          : <>Relisez le <strong>récapitulatif</strong>, cochez chaque point de contrôle, indiquez qui a validé le prix, puis cliquez sur <strong>Valider l’étude</strong>. L’étude sera verrouillée.</>}
      </GuideBanner>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader title="Récapitulatif de l’étude" subtitle={v ? `Chiffres figés à la validation ${versionLabel(study)} du ${formatDateTime(v.validatedAt)}` : 'Chiffres actuels de l’étude'} />
          <dl className="divide-y divide-slate-100 text-sm">
            {[{ label: 'Projet', value: study.name }, { label: 'Client', value: study.client }, { label: 'Référence', value: study.reference }].map((r) => (
              <div key={r.label} className="flex justify-between gap-4 px-5 py-2"><dt className="text-slate-500">{r.label}</dt><dd className="text-right font-medium text-slate-900">{r.value}</dd></div>
            ))}
            {rows.map((r) => (
              <div key={r.label} className={clsx('flex justify-between gap-4 px-5 py-2', r.strong && 'bg-brand-50/60')}>
                <dt className="text-slate-500">{r.label}</dt>
                <dd className={clsx('text-right tabular', r.strong ? 'text-lg font-bold text-slate-900' : 'font-semibold', r.warn ? 'text-orange-700' : 'text-slate-900')}>{r.warn && '⚠ '}{r.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="space-y-5">
          {!v && !done && (
            <Card className={clsx('no-print border-l-4 p-4', !ready.reviewOk ? 'border-l-orange-400' : ready.blocking ? 'border-l-red-500' : 'border-l-emerald-500')}>
              <div className="flex flex-wrap items-center gap-3">
                {!ready.reviewOk ? <AlertTriangle size={20} className="text-orange-600" /> : ready.blocking ? <OctagonX size={20} className="text-red-600" /> : <CheckCircle2 size={20} className="text-emerald-600" />}
                <p className="flex-1 text-sm text-slate-700">
                  {!ready.reviewOk ? ready.reason
                    : ready.blocking ? <>La revue de prix ({review?.score} %) comporte <strong>{ready.blocking} contrôle(s) bloquant(s)</strong>. Corrigez-les, ou validez « avec réserves » en connaissance de cause.</>
                      : <>Revue de prix à jour : <strong>{review?.score} %</strong>, aucun contrôle bloquant{review?.toCheck ? `, ${review.toCheck} point(s) à vérifier` : ''}.</>}
                </p>
                <Button size="sm" variant="secondary" icon={<SearchCheck size={14} />} onClick={() => navigate(`/etudes/${study.id}/revue`)}>{study.review ? 'Voir la revue' : 'Lancer la revue'}</Button>
              </div>
            </Card>
          )}

          {!v && !done && roleBlocked && (
            <Card className="no-print border-l-4 border-l-sky-400 p-4 text-sm text-slate-700">
              🔐 La validation et le déverrouillage sont réservés à la <strong>direction</strong>. Préparez l’étude (revue à jour, points vérifiés), puis demandez la validation à un responsable.
            </Card>
          )}
          {!v && !done && (
            <Card className="no-print">
              <CardHeader icon={<AlertTriangle size={18} className="text-amber-600" />} title="⚠️ Validation humaine" subtitle="Cochez chaque point après l’avoir vérifié vous-même." />
              <div className="space-y-2 p-5">
                {VALIDATION_ITEMS.map((i) => (
                  <label key={i.id} className={clsx('flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 ring-1 ring-inset', checked.includes(i.id) ? 'bg-emerald-50 ring-emerald-200' : 'ring-slate-200 hover:bg-slate-50')}>
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-700" checked={checked.includes(i.id)}
                      onChange={(e) => setChecked((c) => (e.target.checked ? [...c, i.id] : c.filter((x) => x !== i.id)))} />
                    <span className="text-sm text-slate-800">{i.label}</span>
                  </label>
                ))}
                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-800">Prix validé par (direction) <span className="text-red-600">*</span></span>
                    <input value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="Nom et fonction"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-800">Commentaire <span className="font-normal text-slate-500">(réserves, conditions)</span></span>
                    <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ex. : offre avec variante éclairage"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
                  </label>
                </div>
                {ready.reviewOk && ready.blocking > 0 && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-red-50 px-3 py-2 ring-1 ring-inset ring-red-200">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-red-700" checked={reserves} onChange={(e) => setReserves(e.target.checked)} />
                    <span className="text-sm text-red-900">Je valide <strong>malgré {ready.blocking} contrôle(s) bloquant(s)</strong> : validation <strong>avec réserves</strong> (motif obligatoire).</span>
                  </label>
                )}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-3">
                  {!canValidate && missing.length > 0 && <span className="text-xs text-slate-500">Reste : {missing.join(' · ')}</span>}
                  <Button size="lg" disabled={!canValidate} onClick={() => setPending('validate')}>✅ VALIDER L’ÉTUDE</Button>
                </div>
              </div>
            </Card>
          )}

          {v && (
            <Card className="border-l-4 border-l-emerald-500">
              <div className="space-y-3 p-5">
                <p className="flex items-center gap-2 text-lg font-bold text-emerald-800"><Lock size={20} /> Étude validée {versionLabel(study)}{v.withReserves && <span className="rounded bg-red-100 px-2 py-0.5 text-sm text-red-800">avec réserves</span>}</p>
                <p className="text-sm text-slate-700">Le {formatDateTime(v.validatedAt)} par <strong>{v.validatedBy}</strong> · prix validé par <strong>{v.approver}</strong>{v.comment && <> · {v.comment}</>}</p>
                <ul className="space-y-1 text-sm">
                  {VALIDATION_ITEMS.map((i) => <li key={i.id} className="flex gap-2 text-slate-700"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> {i.label}</li>)}
                </ul>
                {!done && (
                  <div className="no-print flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <Button size="lg" onClick={() => navigate(`/etudes/${study.id}/rapport`)}>🖨️ GÉNÉRER LE DOSSIER FINAL</Button>
                    <Button variant="secondary" icon={<Send size={16} />} onClick={() => setPending('submit')}>Marquer l’offre comme remise</Button>
                    <Button variant="ghost" icon={<LockOpen size={16} />} disabled={roleBlocked} title={roleBlocked ? 'Réservé à la direction' : undefined} onClick={() => setPending('unlock')}>Déverrouiller</Button>
                  </div>
                )}
                {done && <p className="no-print text-sm font-semibold text-slate-700">Offre remise — l’étude est terminée. <Link to={`/etudes/${study.id}/rapport`} className="text-brand-700 underline">Voir le dossier final</Link></p>}
              </div>
            </Card>
          )}
          {!v && done && <Card className="p-5 text-sm text-slate-700">Offre remise sans validation enregistrée dans l’application.</Card>}
        </div>
      </div>

      <HelpBox>
        <p>La <strong>validation</strong> est l’engagement de l’entreprise sur le prix. L’application prépare la décision (récapitulatif, revue de prix) ; c’est vous qui la prenez, point par point.</p>
        <p>Une fois validée, l’étude est <strong>verrouillée</strong> : métré, prix, offres, risques et questions ne sont plus modifiables et les chiffres du récapitulatif sont figés. Le <strong>déverrouillage</strong> est tracé et impose une nouvelle validation (version suivante : V2, V3…).</p>
      </HelpBox>

      {pending === 'validate' && (
        <ConfirmDialog open askReason reasonRequired={reserves} title={`Valider l’étude (${versionLabel(study)}) ?`} confirmLabel="Valider et verrouiller"
          message={<>Prix de vente : <strong>{formatEuro(snap.salePrice || snap.amount)} HT</strong>, validé par <strong>{approver}</strong>.{reserves && <> Validation <strong>avec réserves</strong> : {ready.blocking} contrôle(s) bloquant(s).</>}</>}
          impact="L’étude sera verrouillée : plus aucune modification possible sans déverrouillage."
          onCancel={() => setPending(null)}
          onConfirm={(reason) => {
            const rec = store.validateStudy(study.id, { approver: approver.trim(), comment: comment.trim(), checklist: checked, withReserves: ready.blocking > 0 }, reason || 'Validation finale');
            if (rec) toast(`Étude validée V${rec.version} et verrouillée`);
            setPending(null);
          }} />
      )}
      {pending === 'unlock' && (
        <ConfirmDialog open danger askReason reasonRequired title="Déverrouiller l’étude ?" confirmLabel="Déverrouiller"
          message={<>La validation {versionLabel(study)} sera annulée. L’étude redevient modifiable et devra être <strong>revalidée</strong> (version V{(study.validationCount ?? 0) + 1}).</>}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => { store.unlockStudy(study.id, reason); toast('Étude déverrouillée'); setPending(null); }} />
      )}
      {pending === 'submit' && (
        <ConfirmDialog open askReason title="Marquer l’offre comme remise ?" confirmLabel="Offre remise"
          message={<>L’étude passera à l’étape <strong>Remise</strong> et sera terminée.</>}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => { store.setStatus(study.id, 'remise', reason || 'Offre remise au client'); toast('Offre remise — étude terminée'); setPending(null); }} />
      )}

      <PrintDocument title="Fiche de validation" reference={study.reference} version={versionLabel(study)} demo={study.isDemo}>
        <div className="mb-3 text-[13pt] font-bold">{study.name}</div>
        <PrintSection title="Récapitulatif de l’étude">
          <PrintTable head={['Élément', 'Valeur']} align={['left', 'right']}
            rows={[['Client', study.client], ['Référence', study.reference], ...rows.map((r) => [r.label, r.value])]} />
        </PrintSection>
        <PrintSection title="Validation humaine">
          <PrintTable head={['Point de contrôle', 'Vérifié']} align={['left', 'center']}
            rows={VALIDATION_ITEMS.map((i) => [i.label, v ? '☑' : '☐'])} />
          {v ? <p className="mt-2 text-[10pt]">Validée {versionLabel(study)}{v.withReserves ? ' AVEC RÉSERVES' : ''} le {formatDateTime(v.validatedAt)} par {v.validatedBy} — prix validé par {v.approver}.{v.comment && ` ${v.comment}`}</p>
            : <p className="mt-2 text-[10pt] italic">Étude non validée à la date d’impression.</p>}
        </PrintSection>
        <div className="print-avoid-break mt-6 grid grid-cols-2 gap-6 text-[10pt]">
          <div className="h-28 border border-slate-500 p-2">Responsable études de prix<br />Nom, date, signature</div>
          <div className="h-28 border border-slate-500 p-2">Direction<br />Nom, date, signature</div>
        </div>
      </PrintDocument>
    </div>
  );
}
