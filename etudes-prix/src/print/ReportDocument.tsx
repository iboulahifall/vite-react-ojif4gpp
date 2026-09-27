import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import type { Study } from '../domain/types';
import { FAMILIES, MARKET_LABELS } from '../domain/catalog';
import { dceStatus } from '../domain/documents';
import { findingStatus, summarize } from '../domain/analysis/summary';
import { sourceLabel } from '../domain/analysis/analyse';
import { effectiveQty, formatGap, formatQty, gapOf, metreSummary } from '../domain/metre';
import { compareOffers, consultationState, consultationSummary, STATUS_LABELS as REQUEST_LABELS } from '../domain/consultations';
import { buildUp, lineCost, lineSalePrice, SOURCE_LABELS, STATUS_LABELS as PRICE_STATUS } from '../domain/chiffrage';
import { isQuestionOpen, isRiskActive, questionCode, questionSummary, QUESTION_STATUS_LABELS, riskCode, riskSummary, RISK_LEVEL_LABELS, RISK_STATUS_LABELS } from '../domain/risks';
import { CHECK_STATUS_LABELS, GROUPS, isJustified, isReviewStale, scoreOf } from '../domain/review';
import { snapshotOf, VALIDATION_ITEMS, versionLabel } from '../domain/validation';
import { studyBlockers } from '../domain/blockers';
import { nextAction, stageOf } from '../domain/workflow';
import { amountOf } from '../domain/kpi';
import { daysUntil } from '../domain/dates';
import { formatDate, formatDateTime, formatEuro } from '../domain/format';
import { PrintSection, PrintTable } from './PrintDocument';

export type ReportKind = 'complet' | 'synthese';

export const REPORT_SECTIONS = [
  { id: 'synthese', label: 'Synthèse' },
  { id: 'perimetre', label: 'Périmètre' },
  { id: 'analyse', label: 'Analyse DCE' },
  { id: 'metre', label: 'Métrés' },
  { id: 'consultations', label: 'Consultations' },
  { id: 'chiffrage', label: 'Chiffrage' },
  { id: 'risques', label: 'Risques' },
  { id: 'questions', label: 'Questions' },
  { id: 'controles', label: 'Contrôles' },
  { id: 'validation', label: 'Validation' },
] as const;
export type ReportSectionId = (typeof REPORT_SECTIONS)[number]['id'];

const famLabel = (id: string | null) => FAMILIES.find((f) => f.id === id)?.label ?? 'À rattacher';
const pct = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

function KeyFigures({ s }: { s: Study }) {
  const b = s.chiffrage.lines.length ? buildUp(s.metre, s.chiffrage) : null;
  const snap = s.validation?.snapshot;
  const cells: [string, string][] = b ? [
    ['Montant estimé', formatEuro(s.estimatedAmount)],
    ['Déboursé sec', formatEuro(snap?.dryCost ?? b.dryCost)],
    ['Prix de revient', formatEuro(snap?.costPrice ?? b.costPrice)],
    ['Prix de vente HT', formatEuro(snap?.salePrice ?? b.salePrice)],
    ['Marge', `${formatEuro(snap?.margin ?? b.margin)} (${pct(snap?.marginPct ?? s.chiffrage.params.marginPct)})`],
  ] : [['Montant estimé', formatEuro(s.estimatedAmount)], ['Chiffrage détaillé', 'Non réalisé dans l’application']];
  return (
    <div className="print-avoid-break grid grid-cols-5 gap-2">
      {cells.map(([k, v], i) => (
        <div key={k} className={`rounded border px-2 py-1.5 ${i === 3 ? 'border-slate-800 bg-slate-100' : 'border-slate-300'}`}>
          <div className="text-[8pt] uppercase tracking-wide text-slate-600">{k}</div>
          <div className={`tabular ${i === 3 ? 'text-[12pt] font-bold' : 'text-[10.5pt] font-semibold'}`}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function Cover({ s }: { s: Study }) {
  const { settings } = useStore();
  const rows: [string, ReactNode][] = [
    ['Projet', s.name], ['Client', s.client], ['Lieu', s.location || '—'], ['Référence', s.reference],
    ['Marché', MARKET_LABELS[s.marketType]], ['Date de remise', `${formatDate(s.dueDate)} à ${s.dueTime}`],
    ['Date du document', new Date().toLocaleDateString('fr-FR')], ['Version', `${versionLabel(s)}${s.validation ? ' — validée' : ' — projet'}`], ['Responsable', s.owner],
  ];
  return (
    <section className="report-cover flex flex-col">
      <div className="flex items-center gap-4">
        {settings.logo ? <img src={settings.logo} alt="" className="h-16 max-w-[200px] object-contain" /> : <div className="rounded border-2 border-slate-800 px-3 py-2 text-[11pt] font-bold uppercase">{settings.companyName}</div>}
        {settings.logo && <div className="text-[11pt] font-semibold">{settings.companyName}</div>}
      </div>
      <div className="mt-[35%]">
        <div className="text-[11pt] uppercase tracking-[0.3em] text-slate-600">Lots électricité CFO / CFA</div>
        <h1 className="mt-2 border-b-4 border-slate-800 pb-3 text-[30pt] font-extrabold leading-tight">ÉTUDE DE PRIX</h1>
        <div className="mt-3 text-[16pt] font-bold">{s.name}</div>
      </div>
      <table className="mt-10 w-full text-[11pt]">
        <tbody>
          {rows.map(([k, v]) => <tr key={k}><td className="w-48 py-1 text-slate-600">{k}</td><td className="py-1 font-semibold">{v}</td></tr>)}
        </tbody>
      </table>
      {s.isDemo && <div className="mt-8 border-2 border-fuchsia-500 px-3 py-2 text-center text-[11pt] font-bold uppercase text-fuchsia-800">Données de démonstration — document fictif</div>}
    </section>
  );
}

function Synthese({ s, short }: { s: Study; short?: boolean }) {
  const b = s.chiffrage.lines.length ? buildUp(s.metre, s.chiffrage) : null;
  const na = nextAction(s);
  const blockers = studyBlockers(s).slice(0, 8);
  const r = riskSummary(s.risks);
  const q = questionSummary(s.questions);
  const days = daysUntil(s.dueDate);
  return (
    <PrintSection title="Synthèse">
      <KeyFigures s={s} />
      <div className="mt-3 grid grid-cols-2 gap-4">
        <PrintTable head={['État de l’étude', '']} rows={[
          ['Étape', `${stageOf(s.status).label} — avancement ${s.progress} %`],
          ['Remise', `${formatDate(s.dueDate)} à ${s.dueTime}${s.status !== 'remise' ? ` (${days < 0 ? `dépassée de ${-days} j` : days === 0 ? 'aujourd’hui' : `J-${days}`})` : ''}`],
          ['Prochaine action', `${na.label} — ${na.reason}`],
          ['Validation', s.validation ? `Validée ${versionLabel(s)} le ${formatDateTime(s.validation.validatedAt)}${s.validation.withReserves ? ' (avec réserves)' : ''}` : 'Non validée'],
        ]} />
        <PrintTable head={['Indicateurs', '']} align={['left', 'right']} rows={[
          ['Risques critiques / importants', s.risks.length ? `${r.critical} / ${r.important}` : `${s.indicators.criticalRisks} / —`],
          ['Exposition aux risques', s.risks.length ? formatEuro(r.exposure) : '—'],
          ['Questions ouvertes (dont bloquantes)', s.questions.length ? `${q.open} (${q.blocking})` : String(s.indicators.openQuestions)],
          ['Lignes chiffrées / sans prix', b ? `${b.lines - b.missing} / ${b.missing}` : '—'],
          ['Prix estimés / à confirmer', b ? `${b.estimated} / ${b.toConfirm}` : '—'],
          ['Revue de prix', s.review ? `${scoreOf(s.review.checks, s.reviewJustifications).score} %${isReviewStale(s) ? ' (à relancer)' : ''}` : 'Non lancée'],
        ]} />
      </div>
      {blockers.length > 0 && (
        <div className="mt-3">
          <PrintTable head={['Ce qui bloque', 'Détail']} rows={blockers.map((x) => [<strong key="l">{x.level === 'critique' ? '🔴' : '🟠'} {x.label}</strong>, x.detail])} />
        </div>
      )}
      {short && (
        <>
          {s.risks.some((x) => isRiskActive(x) && x.level !== 'surveiller') && (
            <div className="mt-3"><PrintTable head={['Risque', 'Niveau', 'Montant', 'Action']} align={['left', 'left', 'right', 'left']}
              rows={s.risks.filter((x) => isRiskActive(x) && x.level !== 'surveiller').map((x) => [`${riskCode(x)} ${x.title}`, RISK_LEVEL_LABELS[x.level], x.amount !== null ? formatEuro(x.amount) : '—', x.action || 'AUCUNE'])} /></div>
          )}
          {s.questions.some(isQuestionOpen) && (
            <div className="mt-3"><PrintTable head={['Question ouverte', 'Bloquante', 'Statut']}
              rows={s.questions.filter(isQuestionOpen).map((x) => [`${questionCode(x)} ${x.subject}`, x.blocking ? 'Oui' : 'Non', QUESTION_STATUS_LABELS[x.status]])} /></div>
          )}
          {s.plan.some((t) => !t.done) && (
            <div className="mt-3"><PrintTable head={['Prochaines tâches', 'Échéance']}
              rows={s.plan.filter((t) => !t.done).sort((a, c) => a.dueDate.localeCompare(c.dueDate)).slice(0, 6).map((t) => [t.label, formatDate(t.dueDate)])} /></div>
          )}
        </>
      )}
    </PrintSection>
  );
}

function Perimetre({ s }: { s: Study }) {
  const fams = FAMILIES.filter((f) => s.lots.includes(f.lot));
  const st = dceStatus(s).filter((x) => x.state !== 'na');
  const STATE: Record<string, string> = { imported: 'Importée', declared: 'Reçue, non importée', missing: 'MANQUANTE' };
  return (
    <PrintSection title="Périmètre" breakBefore>
      <p className="mb-2">Lots chiffrés : <strong>{s.lots.join(' + ')}</strong> · marché {MARKET_LABELS[s.marketType].toLowerCase()} · {s.families.length} famille(s) de postes retenue(s) sur {fams.length}.</p>
      <PrintTable head={['Lot', 'Famille', 'Contenu', 'Retenue']} align={['left', 'left', 'left', 'center']}
        rows={fams.map((f) => [f.lot, f.label, f.description, s.families.includes(f.id) ? 'Oui' : 'Exclue'])} />
      <div className="mt-3">
        <PrintTable head={['Pièce du DCE', 'État', 'Fichier(s)']} rows={st.map((x) => [x.label, STATE[x.state], x.files.map((f) => f.name).join(', ') || '—'])} />
      </div>
    </PrintSection>
  );
}

function Analyse({ s }: { s: Study }) {
  const a = s.analysis;
  if (!a) return <PrintSection title="Analyse DCE"><p>L’analyse automatique du DCE n’a pas été lancée pour cette étude.</p></PrintSection>;
  const sum = summarize(a, s.analysisDecisions);
  const DEC: Record<string, string> = { ouvert: 'Ouvert', traite: 'Traité', ecarte: 'Écarté' };
  const findings = [...a.findings].sort((x, y) => (x.level === y.level ? 0 : x.level === 'critique' ? -1 : 1));
  return (
    <PrintSection title="Analyse DCE" breakBefore>
      <p className="mb-2">Analyse du {formatDateTime(a.runAt)} par {a.runBy} — {a.cctp ? `CCTP ${a.cctp.pages} p.` : 'sans CCTP'}, {a.dpgf ? `DPGF ${a.dpgf.lines} lignes` : 'sans DPGF'} · {a.prestations.length} prestation(s) détectée(s) ·
        {' '}<strong>{sum.critical} critique(s)</strong> et {sum.toCheck} à vérifier encore ouverts, {sum.treated} traité(s), {sum.dismissed} écarté(s). Analyse par règles métier : elle ne remplace pas la lecture du dossier.</p>
      <PrintTable head={['Niveau', 'Constat', 'Source', 'Décision']}
        rows={findings.map((f) => {
          const d = s.analysisDecisions[f.id];
          return [f.level === 'critique' ? 'Critique' : 'À vérifier', <><strong>{f.title}</strong><br />{f.detail}</>, sourceLabel(f.source) || '—',
            `${DEC[findingStatus(f, s.analysisDecisions)]}${d?.comment ? ` — ${d.comment}` : ''}`];
        })} />
    </PrintSection>
  );
}

function Metre({ s }: { s: Study }) {
  const lines = s.metre.filter((l) => !l.removedFromDpgf);
  if (!lines.length) return <PrintSection title="Métrés"><p>Aucun métré établi dans l’application.</p></PrintSection>;
  const m = metreSummary(s.metre);
  const fams = [...new Set(lines.map((l) => l.familyId))];
  return (
    <PrintSection title="Métrés" breakBefore>
      <p className="mb-2">{m.total} ligne(s), {m.validated} validée(s) · {m.majorGaps} écart(s) &gt; 10 % avec la DPGF · {m.toEstablish} quantité(s) à établir.</p>
      {fams.map((fid) => (
        <div key={fid ?? 'x'} className="mb-3">
          <div className="mb-1 font-bold" style={{ breakAfter: 'avoid' }}>{famLabel(fid)}</div>
          <PrintTable head={['Poste', 'Désignation', 'U', 'DPGF', 'Retenu', 'Écart', 'Validée']} align={['left', 'left', 'center', 'right', 'right', 'right', 'center']}
            rows={lines.filter((l) => l.familyId === fid).map((l) => [l.ref, <>{l.designation}{l.comment && <><br /><em>{l.comment}</em></>}</>, l.unit, formatQty(l.dpgfQty), formatQty(effectiveQty(l)), formatGap(gapOf(l)), l.validated ? 'Oui' : 'Non'])} />
        </div>
      ))}
    </PrintSection>
  );
}

function Consultations({ s }: { s: Study }) {
  const { suppliers } = useStore();
  const name = (id: string) => suppliers.find((x) => x.id === id)?.name ?? '—';
  if (!s.consultations.length) return <PrintSection title="Consultations"><p>Aucune consultation fournisseur enregistrée.</p></PrintSection>;
  const cs = consultationSummary(s.consultations);
  return (
    <PrintSection title="Consultations" breakBefore>
      <p className="mb-2">{cs.consultations} consultation(s), {cs.requests} demande(s) de prix, {cs.received} offre(s) reçue(s), {cs.waiting} en attente, {cs.retained} offre(s) retenue(s).</p>
      {s.consultations.map((c) => {
        const cmp = compareOffers(c, s.metre);
        return (
          <div key={c.id} className="print-avoid-break mb-3">
            <div className="mb-1 font-bold">{c.label} <span className="font-normal">— {consultationState(c).label} · réponse attendue le {formatDate(c.dueDate)}</span></div>
            <PrintTable head={['Fournisseur', 'Statut', 'Offre', 'Rang', 'Écart', 'Retenue']} align={['left', 'left', 'right', 'center', 'right', 'center']}
              rows={c.requests.map((r) => {
                const k = cmp.find((x) => x.requestId === r.id);
                return [name(r.supplierId), REQUEST_LABELS[r.status], k?.total != null ? formatEuro(k.total) : '—', k?.rank ?? '—',
                  k?.gapToBest ? `+${pct(k.gapToBest * 100)}` : k?.rank === 1 ? 'moins-disant' : '—', c.retainedRequestId === r.id ? 'Oui' : ''];
              })} />
          </div>
        );
      })}
    </PrintSection>
  );
}

function Chiffrage({ s }: { s: Study }) {
  const { suppliers } = useStore();
  if (!s.chiffrage.lines.length) return <PrintSection title="Chiffrage"><p>Chiffrage détaillé non réalisé dans l’application. Montant estimé : {formatEuro(s.estimatedAmount)} HT.</p></PrintSection>;
  const b = buildUp(s.metre, s.chiffrage);
  const p = s.chiffrage.params;
  const lines = s.metre.filter((l) => !l.removedFromDpgf);
  const fams = [...new Set(lines.map((l) => l.familyId))];
  return (
    <PrintSection title="Chiffrage" breakBefore>
      <PrintTable head={['Du déboursé sec au prix de vente', 'Base', 'Montant HT']} align={['left', 'left', 'right']}
        rows={[
          ['Matériel', '', formatEuro(b.material)],
          ['Main-d’œuvre', `${b.laborHours.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} h × ${formatEuro(p.hourlyRate)}`, formatEuro(b.labor)],
          ['Sous-traitance', '', formatEuro(b.subcontract)],
          [<strong key="ds">Déboursé sec</strong>, '', <strong key="v">{formatEuro(b.dryCost)}</strong>],
          ['Frais de chantier', `${pct(p.siteCostsPct)} du DS`, formatEuro(b.siteCosts)],
          ['Frais généraux', `${pct(p.overheadPct)} de DS + FC`, formatEuro(b.overhead)],
          ['Aléas', `${pct(p.riskPct)} du DS`, formatEuro(b.risk)],
          [<strong key="pr">Prix de revient</strong>, '', <strong key="v">{formatEuro(b.costPrice)}</strong>],
          ['Marge', `${pct(p.marginPct)} du prix de vente`, formatEuro(b.margin)],
        ]}
        foot={['Prix de vente HT', `coefficient ${b.coefficient?.toLocaleString('fr-FR') ?? '—'}`, formatEuro(b.salePrice)]} />
      {fams.map((fid) => {
        const rows = lines.filter((l) => l.familyId === fid).map((m) => {
          const pl = s.chiffrage.lines.find((x) => x.metreLineId === m.id);
          const c = lineCost(m, pl, p);
          return { m, pl, c, pv: lineSalePrice(c, b) ?? 0 };
        });
        return (
          <div key={fid ?? 'x'} className="mt-3">
            <div className="mb-1 font-bold" style={{ breakAfter: 'avoid' }}>{famLabel(fid)}</div>
            <PrintTable head={['Poste', 'Désignation', 'Qté', 'DS unit.', 'Déboursé sec', 'Prix de vente', 'Origine du prix']} align={['left', 'left', 'right', 'right', 'right', 'right', 'left']}
              rows={rows.map(({ m, pl, c, pv }) => [m.ref, m.designation, `${formatQty(c.qty)} ${m.unit}`, c.unitCost !== null ? formatEuro(c.unitCost) : '—', formatEuro(c.total), formatEuro(pv),
                c.missing ? 'MANQUANT' : `${SOURCE_LABELS[pl!.source.kind]} — ${PRICE_STATUS[pl!.source.status]}${pl!.source.supplierId ? ` (${suppliers.find((x) => x.id === pl!.source.supplierId)?.name ?? ''})` : ''}`])}
              foot={['', 'Sous-total', '', '', formatEuro(rows.reduce((t, x) => t + x.c.total, 0)), formatEuro(rows.reduce((t, x) => t + x.pv, 0)), '']} />
          </div>
        );
      })}
    </PrintSection>
  );
}

function Risques({ s }: { s: Study }) {
  if (!s.risks.length) return <PrintSection title="Risques"><p>Aucun risque enregistré dans le registre.</p></PrintSection>;
  const r = riskSummary(s.risks);
  const b = s.chiffrage.lines.length ? buildUp(s.metre, s.chiffrage) : null;
  const order = ['critique', 'important', 'surveiller'];
  return (
    <PrintSection title="Risques" breakBefore>
      <p className="mb-2">{r.critical} critique(s), {r.important} important(s), {r.watch} à surveiller · exposition {formatEuro(r.exposure)}{b ? ` · provision pour aléas ${formatEuro(b.risk)}` : ''}.</p>
      <PrintTable head={['N°', 'Niveau', 'Risque', 'Impact', 'Montant', 'Action', 'Statut']} align={['left', 'left', 'left', 'left', 'right', 'left', 'left']}
        rows={[...s.risks].sort((x, y) => order.indexOf(x.level) - order.indexOf(y.level)).map((x) => [riskCode(x), RISK_LEVEL_LABELS[x.level],
          <><strong>{x.title}</strong>{x.source.label && <><br />Source : {x.source.label}</>}</>, x.impact || '—', x.amount !== null ? formatEuro(x.amount) : '—', x.action || 'AUCUNE', RISK_STATUS_LABELS[x.status]])} />
    </PrintSection>
  );
}

function Questions({ s }: { s: Study }) {
  if (!s.questions.length) return <PrintSection title="Questions"><p>Aucune question au maître d’ouvrage.</p></PrintSection>;
  return (
    <PrintSection title="Questions" breakBefore>
      <PrintTable head={['N°', 'Sujet / question', 'Source', 'Bloquante', 'Statut', 'Réponse']}
        rows={s.questions.map((x) => [questionCode(x), <><strong>{x.subject}</strong><br />{x.text}</>, x.source.label || '—', x.blocking ? 'Oui' : 'Non',
          `${QUESTION_STATUS_LABELS[x.status]}${x.sentAt ? ` (envoyée le ${formatDate(x.sentAt)})` : ''}`, x.answer ? `${x.answer.text} (${formatDate(x.answer.date)})` : '—'])} />
    </PrintSection>
  );
}

function Controles({ s }: { s: Study }) {
  const r = s.review;
  if (!r) return <PrintSection title="Contrôles"><p>La revue de prix n’a pas été lancée.</p></PrintSection>;
  const sc = scoreOf(r.checks, s.reviewJustifications);
  const j = s.reviewJustifications;
  return (
    <PrintSection title="Contrôles" breakBefore>
      <p className="mb-2">Revue du {formatDateTime(r.runAt)} par {r.runBy}{isReviewStale(s) ? ' — l’étude a été modifiée depuis' : ''} : <strong>score {sc.score} %</strong> — {sc.passed} réussi(s), {sc.justified} justifié(s), {sc.toCheck} à vérifier, {sc.blocking} bloquant(s).
        {' '}<em>Ce score indique uniquement l’état des contrôles effectués par l’application ; ce n’est pas une garantie de conformité.</em></p>
      <PrintTable head={['Famille', 'Contrôle', 'Résultat', 'Constat / justification']}
        rows={r.checks.filter((c) => c.status !== 'na').map((c) => [GROUPS.find((g) => g.id === c.group)?.label, c.label,
          <strong key="s">{isJustified(c, j) ? 'Justifié' : CHECK_STATUS_LABELS[c.status]}</strong>, isJustified(c, j) ? `${c.detail} — Justification : ${j[c.id].reason}` : c.detail])} />
    </PrintSection>
  );
}

function Validation({ s }: { s: Study }) {
  const v = s.validation;
  const snap = v?.snapshot ?? snapshotOf(s);
  return (
    <PrintSection title="Validation" breakBefore>
      <PrintTable head={['Récapitulatif', '']} align={['left', 'right']} rows={[
        ['Déboursé sec', snap.salePrice ? formatEuro(snap.dryCost) : '—'], ['Prix de revient', snap.salePrice ? formatEuro(snap.costPrice) : '—'],
        ['Prix de vente HT', formatEuro(snap.salePrice || snap.amount)], ['Marge', snap.salePrice ? `${formatEuro(snap.margin)} (${pct(snap.marginPct)})` : '—'],
        ['Risques critiques', snap.criticalRisks], ['Questions ouvertes', snap.openQuestions], ['Prix fournisseurs manquants', snap.pendingPrices],
      ]} />
      <div className="mt-3">
        <PrintTable head={['Point de contrôle', 'Vérifié']} align={['left', 'center']} rows={VALIDATION_ITEMS.map((i) => [i.label, v?.checklist.includes(i.id) ? '☑' : '☐'])} />
      </div>
      <p className="mt-2">{v ? <>Étude <strong>validée {versionLabel(s)}</strong>{v.withReserves ? <strong> avec réserves</strong> : ''} le {formatDateTime(v.validatedAt)} par {v.validatedBy} — prix validé par {v.approver}.{v.comment && ` ${v.comment}`}</> : <em>Étude non validée à la date du document.</em>}</p>
      <div className="print-avoid-break mt-6 grid grid-cols-2 gap-6">
        <div className="h-28 border border-slate-500 p-2">Responsable études de prix<br />Nom, date, signature</div>
        <div className="h-28 border border-slate-500 p-2">Direction<br />Nom, date, signature</div>
      </div>
    </PrintSection>
  );
}

const RENDER: Record<ReportSectionId, (p: { s: Study }) => ReactNode> = {
  synthese: ({ s }) => <Synthese s={s} />, perimetre: Perimetre, analyse: Analyse, metre: Metre, consultations: Consultations,
  chiffrage: Chiffrage, risques: Risques, questions: Questions, controles: Controles, validation: Validation,
};

/**
 * Rapport de l'étude : complet (page de garde + sections choisies) ou synthèse courte pour réunion.
 * Visible à l'écran (aperçu) et à l'impression ; en-tête et pied de page répétés sur chaque page.
 */
export function ReportDocument({ study: s, kind, sections }: { study: Study; kind: ReportKind; sections: ReportSectionId[] }) {
  const { settings } = useStore();
  const title = kind === 'complet' ? 'Étude de prix — rapport complet' : 'Synthèse de l’étude — réunion';
  return (
    <div className="report-sheet text-[10pt] text-black">
      {kind === 'complet' && <Cover s={s} />}
      <table className={`w-full border-collapse ${kind === 'complet' ? 'print-break-before report-page-break' : ''}`}>
        <thead>
          <tr><td>
            <div className="mb-4 flex items-end justify-between gap-4 border-b-2 border-slate-800 pb-2">
              <div className="flex items-center gap-3">
                {settings.logo && <img src={settings.logo} alt="" className="h-8 max-w-[120px] object-contain" />}
                <div>
                  <div className="text-[8.5pt] uppercase tracking-wider text-slate-600">{settings.companyName}</div>
                  <div className="text-[12pt] font-bold">{title}</div>
                </div>
              </div>
              <div className="text-right text-[8.5pt] text-slate-700">
                <div className="font-semibold">{s.name}</div>
                <div>Réf. affaire : <strong>{s.reference}</strong> · Version : {versionLabel(s)}</div>
              </div>
            </div>
            {s.isDemo && <div className="mb-3 border border-fuchsia-400 px-2 py-0.5 text-center text-[8.5pt] font-bold uppercase text-fuchsia-800">Données de démonstration — document fictif</div>}
          </td></tr>
        </thead>
        <tfoot>
          <tr><td>
            <div className="mt-4 flex justify-between border-t border-slate-400 pt-1.5 text-[8pt] text-slate-600">
              <span>Édité le {new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} par {settings.userName}</span>
              <span>{s.reference} · {versionLabel(s)}{s.validation ? ' validée' : ' (projet)'}</span>
            </div>
          </td></tr>
        </tfoot>
        <tbody>
          <tr><td>
            {kind === 'synthese' ? (
              <>
                <div className="mb-3 text-[13pt] font-bold">{s.name} <span className="text-[10pt] font-normal">— {s.client} · {formatEuro(amountOf(s))} HT</span></div>
                <Synthese s={s} short />
              </>
            ) : (
              REPORT_SECTIONS.filter((x) => sections.includes(x.id)).map((x, i) => {
                const C = RENDER[x.id];
                return <div key={x.id} className={i === 0 ? 'report-first' : undefined}><C s={s} /></div>;
              })
            )}
          </td></tr>
        </tbody>
      </table>
    </div>
  );
}
