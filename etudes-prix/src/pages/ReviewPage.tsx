import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Loader2, OctagonX, Printer, RefreshCw, SearchCheck, ShieldCheck,
} from 'lucide-react';
import { useStore } from '../state/store';
import type { Study } from '../domain/types';
import {
  CHECK_STATUS_LABELS, GROUPS, isJustified, isReviewStale, scoreOf, THRESHOLDS, type ReviewCheck, type ReviewJustification,
} from '../domain/review';
import { stageIndex } from '../domain/workflow';
import { formatDateTime } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/ui/Badges';
import { GuideBanner, HelpBox } from '../components/ui/Help';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';
import { isLocked } from '../domain/validation';

export function ReviewPage() {
  const { id = '' } = useParams();
  const study = useStore().getStudy(id);
  if (!study) return <Card className="mx-auto max-w-lg p-8 text-center"><p className="text-lg font-semibold">Étude introuvable</p><Link to="/revue" className="mt-4 inline-block font-medium text-brand-700 underline">Choisir une étude</Link></Card>;
  return <ReviewView study={study} />;
}

type Filter = 'tous' | 'bloquant' | 'verifier' | 'justifie' | 'ok';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** État affiché d'un contrôle (un point à vérifier justifié est présenté comme tel). */
type Shown = 'ok' | 'verifier' | 'bloquant' | 'justifie' | 'na';
function shownStatus(c: ReviewCheck, j: Record<string, ReviewJustification>): Shown {
  return isJustified(c, j) ? 'justifie' : c.status;
}

const STATUS_UI: Record<Shown, { label: string; Icon: typeof CheckCircle2; cls: string; row: string }> = {
  bloquant: { label: 'Bloquant', Icon: OctagonX, cls: 'text-red-700', row: 'border-l-red-500 bg-red-50/40' },
  verifier: { label: 'À vérifier', Icon: AlertTriangle, cls: 'text-orange-600', row: 'border-l-orange-400 bg-orange-50/30' },
  justifie: { label: 'Justifié', Icon: ShieldCheck, cls: 'text-sky-700', row: 'border-l-sky-400' },
  ok: { label: 'Réussi', Icon: CheckCircle2, cls: 'text-emerald-600', row: 'border-l-emerald-400' },
  na: { label: 'Sans objet', Icon: CheckCircle2, cls: 'text-slate-400', row: 'border-l-slate-200' },
};

function CheckRow({ c, j, locked, onJustify, onUnjustify }: {
  c: ReviewCheck; j: Record<string, ReviewJustification>; locked: boolean; onJustify: () => void; onUnjustify: () => void;
}) {
  const [open, setOpen] = useState(false);
  const st = shownStatus(c, j);
  const { Icon, cls, row, label } = STATUS_UI[st];
  const items = open ? c.items : c.items.slice(0, 3);
  const stale = c.status === 'verifier' && j[c.id] && !isJustified(c, j);
  return (
    <li className={clsx('border-l-4 px-4 py-3', row)}>
      <div className="flex flex-wrap items-start gap-3">
        <Icon size={20} className={clsx('mt-0.5 shrink-0', cls)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-semibold text-slate-900">{c.label}</span>
            <span className={clsx('text-xs font-semibold', cls)}>{label}</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-700">{c.detail}</p>
          {c.items.length > 0 && st !== 'ok' && (
            <ul className="mt-1.5 space-y-0.5 text-sm">
              {items.map((it, i) => (
                <li key={i} className="flex gap-1.5 text-slate-700"><span className="text-slate-400">•</span>
                  {it.to ? <Link to={it.to} className="hover:text-brand-700 hover:underline">{it.label}</Link> : it.label}
                </li>
              ))}
              {c.items.length > 3 && (
                <li><button onClick={() => setOpen(!open)} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                  {open ? <><ChevronUp size={13} /> Réduire</> : <><ChevronDown size={13} /> Voir les {c.items.length} éléments</>}
                </button></li>
              )}
            </ul>
          )}
          {st === 'justifie' && (
            <p className="mt-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-sm text-sky-900 ring-1 ring-inset ring-sky-200">
              <strong>Justification :</strong> {j[c.id].reason} <span className="text-sky-700">— {j[c.id].by}, {formatDateTime(j[c.id].at)}</span>
            </p>
          )}
          {stale && <p className="mt-1.5 text-xs font-medium text-orange-700">Une justification existait, mais le constat a changé depuis : à revoir.</p>}
        </div>
        {st !== 'ok' && st !== 'na' && (
          <div className="no-print flex shrink-0 flex-wrap gap-1.5">
            {st === 'verifier' && !locked && <Button size="sm" variant="ghost" icon={<ShieldCheck size={14} />} onClick={onJustify}>Justifier</Button>}
            {st === 'justifie' && !locked && <Button size="sm" variant="ghost" onClick={onUnjustify}>Retirer la justification</Button>}
            {st !== 'justifie' && <Link to={c.to} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50">Corriger <ArrowRight size={14} /></Link>}
          </div>
        )}
      </div>
    </li>
  );
}

function ReviewView({ study }: { study: Study }) {
  const store = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filtre') as Filter) || 'tous';
  const [running, setRunning] = useState<number | null>(null);
  const [pending, setPending] = useState<{ kind: 'justify' | 'unjustify'; c: ReviewCheck } | { kind: 'validation' } | null>(null);
  const locked = isLocked(study);
  const r = study.review;
  const j = study.reviewJustifications;
  const score = useMemo(() => (r ? scoreOf(r.checks, j) : null), [r, j]);
  const stale = isReviewStale(study);
  const beforeValidation = stageIndex(study.status) < stageIndex('validation');
  const canValidate = !!score && !score.blocking && !stale;

  const setFilter = (f: Filter) => {
    const p = new URLSearchParams(params);
    if (f === 'tous') p.delete('filtre'); else p.set('filtre', f);
    setParams(p, { replace: true });
  };

  const launch = async () => {
    const fast = !store.settings.guidedMode || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setRunning(0);
    for (let i = 1; i <= GROUPS.length; i++) {
      await sleep(fast ? 60 : 320);
      setRunning(i);
    }
    const rec = store.runReview(study.id);
    await sleep(fast ? 60 : 350);
    setRunning(null);
    setFilter('tous');
    if (rec) {
      const sc = scoreOf(rec.checks, j);
      toast(`Revue terminée : ${sc.score} % — ${sc.blocking} bloquant(s), ${sc.toCheck} à vérifier`);
    }
  };

  const visible = (checks: ReviewCheck[]) => checks.filter((c) => {
    const st = shownStatus(c, j);
    return filter === 'tous' ? st !== 'na' : st === filter;
  });

  const tone = !score ? 'slate' : score.blocking ? 'red' : score.toCheck ? 'orange' : 'emerald';
  const toneCls = { red: 'text-red-700 ring-red-200 bg-red-50', orange: 'text-orange-700 ring-orange-200 bg-orange-50', emerald: 'text-emerald-700 ring-emerald-200 bg-emerald-50', slate: 'text-slate-700 ring-slate-200 bg-slate-50' }[tone];

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Mes études', to: '/etudes' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'Revue de prix' }]}
        icon={<SearchCheck size={24} />}
        title={<span className="flex flex-wrap items-center gap-2">Revue de prix — {study.name} {study.isDemo && <DemoBadge />}</span>}
        subtitle="Contrôles de cohérence de l’étude avant validation : DCE, quantités, prix, offres, risques et questions."
        actions={r && (
          <>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer</Button>
            <Button icon={<RefreshCw size={16} />} disabled={running !== null || locked} onClick={() => void launch()}>Relancer la revue</Button>
          </>
        )}
      />

      <GuideBanner step="Étape 5/7" title="Revue de prix : relire avant de valider">
        {r
          ? <>Traitez d’abord les contrôles <strong>bloquants</strong> (bouton <strong>Corriger</strong>), puis les points <strong>à vérifier</strong> : corrigez-les, ou <strong>justifiez-les</strong> avec un motif. Relancez la revue après vos corrections.</>
          : <>L’application contrôle l’ensemble de l’étude — analyse du DCE, métré, prix, offres, risques, questions — et liste les anomalies. Cliquez sur <strong>Lancer la revue</strong>.</>}
      </GuideBanner>

      {running !== null && (
        <Card className="no-print p-8" aria-live="polite">
          <div className="mx-auto max-w-md space-y-2 font-mono text-sm">
            {GROUPS.map((g, i) => (
              <div key={g.id} className={clsx('flex items-center gap-2', i > running && 'text-slate-400')}>
                <span>{g.label}</span>
                <span className="flex-1 translate-y-1 border-b-2 border-dotted border-slate-300" />
                {i < running ? <CheckCircle2 size={16} className="text-emerald-600" aria-label="terminé" />
                  : i === running ? <Loader2 size={16} className="animate-spin text-brand-700" aria-label="en cours" /> : <span className="w-4 text-center">…</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!r && running === null && (
        <Card className="no-print p-10">
          <div className="mx-auto max-w-xl text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><SearchCheck size={32} /></span>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Aucune revue pour cette étude</h2>
            <p className="mt-2 text-sm text-slate-600">Environ 30 contrôles, regroupés en {GROUPS.length} familles : {GROUPS.map((g) => g.label.toLowerCase()).join(', ')}.</p>
            <Button size="lg" className="mt-6 px-8 text-base tracking-wide" icon={<SearchCheck size={20} />} disabled={locked} onClick={() => void launch()}>LANCER LA REVUE</Button>
          </div>
        </Card>
      )}

      {r && score && running === null && (
        <>
          {stale && (
            <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900">
              <AlertTriangle size={18} /> L’étude a été modifiée depuis cette revue (métré, prix, risques, questions ou DCE) : le résultat ci-dessous n’est plus à jour.
              <Button size="sm" onClick={() => void launch()} disabled={locked}>Relancer la revue</Button>
            </div>
          )}

          <div className="no-print grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
            <Card className="flex flex-col items-center justify-center p-6 text-center">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score de contrôle</span>
              <span className={clsx('mt-2 rounded-2xl px-6 py-2 text-5xl font-extrabold tabular ring-1 ring-inset', toneCls)} data-testid="review-score">{score.score} %</span>
              <p className="mt-3 text-xs text-slate-600">Ce score indique uniquement l’état des contrôles effectués par l’application. <strong>Ce n’est pas une garantie de conformité de l’offre.</strong></p>
              <p className="mt-2 text-xs text-slate-500">Revue du {formatDateTime(r.runAt)} par {r.runBy}</p>
            </Card>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                ['ok', 'Contrôles réussis', score.passed, 'text-emerald-700', CheckCircle2],
                ['verifier', 'À vérifier', score.toCheck, 'text-orange-700', AlertTriangle],
                ['bloquant', 'Bloquants', score.blocking, 'text-red-700', OctagonX],
                ['justifie', 'Justifiés', score.justified, 'text-sky-700', ShieldCheck],
              ] as const).map(([f, label, n, cls, Icon]) => (
                <button key={f} onClick={() => setFilter(filter === f ? 'tous' : f)} aria-pressed={filter === f}
                  className={clsx('cursor-pointer rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md', filter === f ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200')}>
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Icon size={14} className={cls} /> {label}</span>
                  <span className={clsx('mt-1 block text-3xl font-bold tabular', cls)}>{n}</span>
                </button>
              ))}
              <div className="col-span-2 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:col-span-4">
                {beforeValidation ? (
                  canValidate ? (
                    <>
                      <CheckCircle2 size={20} className="text-emerald-600" />
                      <span className="flex-1 text-sm text-slate-700">Aucun contrôle bloquant{score.toCheck ? ` — ${score.toCheck} point(s) à vérifier restent ouverts` : ''}. L’étude peut passer à la validation.</span>
                      <Button disabled={locked} onClick={() => setPending({ kind: 'validation' })}>Passer à la validation</Button>
                    </>
                  ) : (
                    <>
                      <OctagonX size={20} className="text-red-600" />
                      <span className="flex-1 text-sm text-slate-700">
                        {stale ? 'Relancez la revue pour tenir compte des dernières modifications.' : <>Passage à la validation impossible : <strong>{score.blocking} contrôle(s) bloquant(s)</strong> à corriger, puis relancez la revue.</>}
                      </span>
                    </>
                  )
                ) : (
                  <span className="text-sm text-slate-700">L’étude est à l’étape <strong>{study.status === 'remise' ? 'Remise' : 'Validation'}</strong>.</span>
                )}
              </div>
            </div>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Afficher :</span>
            {(['tous', 'bloquant', 'verifier', 'justifie', 'ok'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={clsx('cursor-pointer rounded-full px-3 py-1 font-medium ring-1 ring-inset', filter === f ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50')}>
                {f === 'tous' ? 'Tous' : STATUS_UI[f].label}
              </button>
            ))}
          </div>

          <div className="no-print space-y-4">
            {GROUPS.map((g) => {
              const all = r.checks.filter((c) => c.group === g.id);
              const shown = visible(all);
              if (!shown.length) return null;
              const s = scoreOf(all, j);
              return (
                <Card key={g.id}>
                  <h2 className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 font-semibold text-slate-900">
                    {g.label}
                    <span className="ml-auto flex gap-3 text-xs font-medium">
                      {s.blocking > 0 && <span className="text-red-700">{s.blocking} bloquant(s)</span>}
                      {s.toCheck > 0 && <span className="text-orange-700">{s.toCheck} à vérifier</span>}
                      <span className="text-emerald-700">{s.passed + s.justified}/{s.applicable} réussi(s)</span>
                    </span>
                  </h2>
                  <ul className="divide-y divide-slate-100">
                    {shown.map((c) => (
                      <CheckRow key={c.id} c={c} j={j} locked={locked}
                        onJustify={() => setPending({ kind: 'justify', c })} onUnjustify={() => setPending({ kind: 'unjustify', c })} />
                    ))}
                  </ul>
                </Card>
              );
            })}
            {GROUPS.every((g) => !visible(r.checks.filter((c) => c.group === g.id)).length) && (
              <Card className="p-8 text-center text-sm text-slate-500">Aucun contrôle dans cette catégorie.</Card>
            )}
          </div>
        </>
      )}

      <HelpBox>
        <p>La <strong>revue de prix</strong> relit l’étude comme le ferait un second chiffreur : pièces reçues, points de l’analyse, quantités, prix manquants ou estimés, prix hors norme, offres, marge, risques, questions, délai.</p>
        <p>🔴 <strong>Bloquant</strong> : empêche de remettre une offre fiable (prix manquant, quantité à établir, risque critique, question bloquante…). 🟠 <strong>À vérifier</strong> : à corriger ou à justifier avec un motif. Une justification ne vaut que tant que le constat ne change pas.</p>
        <p>Repères utilisés : marge entre {THRESHOLDS.marginLow} % et {THRESHOLDS.marginHigh} %, taux horaire entre {THRESHOLDS.hourlyRateMin} et {THRESHOLDS.hourlyRateMax} € / h, prix de vente à ± {THRESHOLDS.estimateGap * 100} % du montant estimé, déboursé unitaire à moins de ×{THRESHOLDS.priceRatio} de la base de prix indicative. Les contrôles sont des règles : ils ne remplacent pas la relecture du dossier.</p>
      </HelpBox>

      {pending?.kind === 'justify' && (
        <ConfirmDialog open askReason reasonRequired title={`Justifier « ${pending.c.label} » ?`} confirmLabel="Justifier"
          message={<><p>{pending.c.detail}</p><p className="mt-2 text-slate-500">Le point reste visible dans la revue avec votre justification. Si le constat change, il redeviendra « à vérifier ».</p></>}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => { store.justifyCheck(study.id, pending.c.id, reason); toast('Point justifié'); setPending(null); }} />
      )}
      {pending?.kind === 'unjustify' && (
        <ConfirmDialog open title={`Retirer la justification ?`} confirmLabel="Retirer"
          message={<>« {pending.c.label} » redeviendra un point à vérifier.</>}
          onCancel={() => setPending(null)}
          onConfirm={() => { store.justifyCheck(study.id, pending.c.id, null); toast('Justification retirée'); setPending(null); }} />
      )}
      {pending?.kind === 'validation' && score && (
        <ConfirmDialog open askReason title="Passer l’étude à la validation ?" confirmLabel="Passer à la validation"
          message={<>Revue du {r && formatDateTime(r.runAt)} : <strong>{score.score} %</strong>, aucun contrôle bloquant{score.toCheck ? `, ${score.toCheck} point(s) à vérifier non justifié(s)` : ''}.</>}
          impact={score.toCheck ? 'Des points restent à vérifier : ils figureront dans le rapport de revue.' : undefined}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => { store.setStatus(study.id, 'validation', reason || `Revue de prix : ${score.score} %`); toast('Étude passée à l’étape « Validation »'); setPending(null); }} />
      )}

      {r && score && (
        <PrintDocument title="Revue de prix" reference={study.reference} demo={study.isDemo}>
          <div className="mb-3 text-[13pt] font-bold">{study.name}</div>
          <PrintSection title="Synthèse">
            <PrintTable head={['Score', 'Réussis', 'Justifiés', 'À vérifier', 'Bloquants', 'Revue du']} align={['center', 'center', 'center', 'center', 'center', 'left']}
              rows={[[`${score.score} %`, score.passed, score.justified, score.toCheck, score.blocking, `${formatDateTime(r.runAt)} — ${r.runBy}${stale ? ' (données modifiées depuis)' : ''}`]]} />
            <p className="mt-2 text-[9pt] italic">Ce score indique uniquement l’état des contrôles effectués par l’application. Ce n’est pas une garantie de conformité de l’offre.</p>
          </PrintSection>
          {GROUPS.map((g) => {
            const checks = r.checks.filter((c) => c.group === g.id && c.status !== 'na');
            if (!checks.length) return null;
            return (
              <PrintSection key={g.id} title={g.label}>
                <PrintTable head={['Contrôle', 'Résultat', 'Constat', 'Justification']}
                  rows={checks.map((c) => {
                    const st = shownStatus(c, j);
                    return [
                      c.label,
                      <strong key="s">{st === 'justifie' ? 'Justifié' : CHECK_STATUS_LABELS[c.status]}</strong>,
                      <>{c.detail}{st !== 'ok' && c.items.length > 0 && <><br />{c.items.slice(0, 12).map((it) => it.label).join(' · ')}{c.items.length > 12 ? ` · … (${c.items.length} au total)` : ''}</>}</>,
                      st === 'justifie' ? `${j[c.id].reason} (${j[c.id].by})` : '',
                    ];
                  })} />
              </PrintSection>
            );
          })}
        </PrintDocument>
      )}
    </div>
  );
}
