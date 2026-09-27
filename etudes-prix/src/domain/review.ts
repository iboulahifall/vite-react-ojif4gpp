import type { Study } from './types';
import { daysUntil } from './dates';
import { dceCompleteness, dceStatus } from './documents';
import { FAMILIES } from './catalog';
import { findingStatus } from './analysis/summary';
import { dceSignature } from './analysis/analyse';
import { hash } from './analysis/text';
import { effectiveQty, formatQty, gapOf, metreSummary, type MetreLine } from './metre';
import { consultationSummary, isExpired } from './consultations';
import { buildUp, isPriced, lineCost, type PriceLine } from './chiffrage';
import { baseLineFor } from './priceBase';
import { isQuestionLate, isQuestionOpen, isRiskActive, questionCode, riskCode, riskSummary } from './risks';
import { formatDate, formatEuro } from './format';

/**
 * Revue de prix (V1.8) : contrôles de cohérence de l'étude avant validation.
 * Chaque contrôle est réussi, à vérifier, bloquant ou sans objet ; il indique où corriger.
 * Le score résume l'état des contrôles effectués par l'application : ce n'est pas une
 * garantie de conformité de l'offre.
 */

export type CheckStatus = 'ok' | 'verifier' | 'bloquant' | 'na';
export type CheckGroup = 'cctp' | 'dpgf' | 'pieces' | 'quantites' | 'prix' | 'risques';

export const GROUPS: { id: CheckGroup; label: string }[] = [
  { id: 'cctp', label: 'Analyse CCTP' },
  { id: 'dpgf', label: 'Analyse DPGF' },
  { id: 'pieces', label: 'Pièces et plans' },
  { id: 'quantites', label: 'Contrôle quantités' },
  { id: 'prix', label: 'Contrôle prix' },
  { id: 'risques', label: 'Contrôle risques' },
];

export interface CheckItem {
  label: string;
  to?: string;
}

export interface ReviewCheck {
  id: string;
  group: CheckGroup;
  label: string;
  status: CheckStatus;
  /** Constat (ce qui a été trouvé), ou ce qui a été vérifié si le contrôle est réussi. */
  detail: string;
  /** Éléments concernés (lignes, prix, risques…), chacun menant à la page où le corriger. */
  items: CheckItem[];
  /** Page où corriger l'ensemble. */
  to: string;
}

export interface ReviewJustification {
  reason: string;
  by: string;
  at: string;
  /** Constat justifié : si le constat change, la justification ne s'applique plus. */
  detail: string;
}

export interface ReviewRecord {
  runAt: string;
  runBy: string;
  /** Empreinte des données contrôlées, pour détecter une revue périmée. */
  signature: string;
  checks: ReviewCheck[];
}

export interface ReviewScore {
  /** Contrôles réussis + justifiés, en % des contrôles applicables. */
  score: number;
  passed: number;
  justified: number;
  toCheck: number;
  blocking: number;
  applicable: number;
  na: number;
}

/** Seuils des contrôles (affichés dans l'aide de la page). */
export const THRESHOLDS = {
  /** Marge (% du prix de vente) en deçà de laquelle elle est jugée faible. */
  marginLow: 3,
  marginHigh: 25,
  hourlyRateMin: 30,
  hourlyRateMax: 75,
  /** Écart entre prix de vente et montant estimé de l'étude. */
  estimateGap: 0.25,
  /** Rapport déboursé unitaire / base indicative au-delà duquel un prix est jugé anormal. */
  priceRatio: 3,
} as const;

const pct = (n: number) => `${Math.round(n * 100)} %`;

/** Empreinte des données de l'étude contrôlées par la revue. */
export function reviewSignature(s: Study): string {
  return hash(JSON.stringify([
    s.dueDate, s.lots, s.families, s.estimatedAmount,
    s.documents.map((d) => [d.id, d.category]), s.dceDocs,
    s.analysis?.runAt ?? null, s.analysisDecisions,
    s.metre, s.consultations, s.chiffrage, s.risks, s.questions,
  ]));
}

function lineLabel(m: MetreLine): string {
  return `${m.ref ? `${m.ref} ` : ''}${m.designation}`;
}

/** Lignes chiffrées d'après une offre forfaitaire (le prix unitaire n'est pas comparable). */
function isLumpSum(s: Study, p: PriceLine): boolean {
  if (p.source.kind !== 'offre') return false;
  const c = s.consultations.find((x) => x.id === p.source.consultationId);
  const r = c?.requests.find((x) => x.id === p.source.requestId);
  return !!r?.offer && !r.offer.lines.some((l) => l.unitPrice !== null);
}

/** Exécute tous les contrôles de la revue sur l'état actuel de l'étude. */
export function runChecks(s: Study, today = new Date()): ReviewCheck[] {
  const base = `/etudes/${s.id}`;
  const out: ReviewCheck[] = [];
  const add = (c: Omit<ReviewCheck, 'items' | 'to'> & { items?: CheckItem[]; to?: string }) => out.push({ items: [], to: base, ...c });

  // ---- Analyse CCTP ------------------------------------------------------------------------
  const hasCctp = s.documents.some((d) => d.category === 'CCTP');
  const a = s.analysis;
  add({
    id: 'analyse-faite', group: 'cctp', label: 'Le DCE a été analysé', to: `${base}/analyse`,
    status: a ? 'ok' : 'verifier',
    detail: a ? `Analyse du ${formatDate(a.runAt.slice(0, 10))} : ${a.prestations.length} prestation(s) détectée(s) au CCTP.`
      : hasCctp ? 'Le CCTP est importé mais l’analyse n’a pas été lancée.' : 'Aucun CCTP importé : les prestations n’ont pas été comparées à la DPGF.',
  });
  if (a) {
    const stale = a.dceSignature !== dceSignature(s.documents);
    add({ id: 'analyse-a-jour', group: 'cctp', label: 'L’analyse porte sur le DCE actuel', to: `${base}/analyse`,
      status: stale ? 'verifier' : 'ok', detail: stale ? 'Des pièces ont été ajoutées, retirées ou reclassées depuis l’analyse : relancez-la.' : 'Aucune pièce modifiée depuis l’analyse.' });
    const open = a.findings.filter((f) => findingStatus(f, s.analysisDecisions) === 'ouvert');
    const crit = open.filter((f) => f.level === 'critique');
    add({ id: 'analyse-critiques', group: 'cctp', label: 'Points critiques de l’analyse traités', to: `${base}/analyse?filtre=critique`,
      status: crit.length ? 'bloquant' : 'ok',
      detail: crit.length ? `${crit.length} point(s) critique(s) ni traité(s) ni écarté(s) : écarts CCTP / DPGF, hypothèses à confirmer, clauses à risque.` : 'Tous les points critiques ont été traités ou écartés avec un motif.',
      items: crit.map((f) => ({ label: f.title, to: `${base}/analyse?filtre=critique` })) });
    const toCheck = open.filter((f) => f.level === 'verifier');
    add({ id: 'analyse-a-verifier', group: 'cctp', label: 'Points « à vérifier » de l’analyse examinés', to: `${base}/analyse?filtre=verifier`,
      status: toCheck.length ? 'verifier' : 'ok',
      detail: toCheck.length ? `${toCheck.length} point(s) à vérifier encore ouvert(s).` : 'Tous les points à vérifier ont été examinés.',
      items: toCheck.map((f) => ({ label: f.title, to: `${base}/analyse?filtre=verifier` })) });
    const unasked = open.filter((f) => f.question && !s.questions.some((q) => q.source.findingId === f.id));
    add({ id: 'questions-proposees', group: 'cctp', label: 'Questions proposées par l’analyse posées', to: `${base}/analyse`,
      status: unasked.length ? 'verifier' : 'ok',
      detail: unasked.length ? `${unasked.length} question(s) proposée(s) sur des points ouverts n’ont pas été reprises dans les questions au maître d’ouvrage.` : 'Aucune question proposée en suspens.',
      items: unasked.map((f) => ({ label: f.title, to: `${base}/analyse` })) });
  }

  // ---- Analyse DPGF / métré ------------------------------------------------------------------
  const active = s.metre.filter((m) => !m.removedFromDpgf);
  const hasDpgf = s.documents.some((d) => d.category === 'DPGF');
  add({ id: 'metre-existe', group: 'dpgf', label: 'Un métré est établi', to: `${base}/metre`,
    status: active.length ? 'ok' : 'bloquant',
    detail: active.length ? `${active.length} ligne(s) au métré${hasDpgf ? ', issues de la DPGF et des ajouts' : ''}.`
      : hasDpgf ? 'Le métré n’a pas été créé à partir de la DPGF : aucune quantité ne peut être contrôlée.' : 'Aucune DPGF ni aucun métré dans l’application : aucune quantité ne peut être contrôlée.' });
  if (active.length) {
    const orphans = active.filter((m) => !m.familyId);
    add({ id: 'lignes-rattachees', group: 'dpgf', label: 'Chaque ligne est rattachée à une famille', to: `${base}/metre`,
      status: orphans.length ? 'verifier' : 'ok',
      detail: orphans.length ? `${orphans.length} ligne(s) « à rattacher » : elles n’apparaissent dans aucun sous-total de famille.` : 'Toutes les lignes sont rattachées.',
      items: orphans.map((m) => ({ label: lineLabel(m), to: `${base}/metre` })) });
    const outOfScope = active.filter((m) => m.familyId && !s.families.includes(m.familyId));
    add({ id: 'lignes-perimetre', group: 'dpgf', label: 'Les lignes sont dans le périmètre retenu', to: `${base}/metre`,
      status: outOfScope.length ? 'verifier' : 'ok',
      detail: outOfScope.length ? `${outOfScope.length} ligne(s) d’une famille exclue du périmètre de l’étude : à retirer, ou périmètre à élargir.` : 'Aucune ligne hors périmètre.',
      items: outOfScope.map((m) => ({ label: `${lineLabel(m)} — ${FAMILIES.find((f) => f.id === m.familyId)?.label ?? ''}`, to: `${base}/metre` })) });
    const empty = s.families.filter((fid) => !active.some((m) => m.familyId === fid));
    add({ id: 'familles-couvertes', group: 'dpgf', label: 'Chaque famille du périmètre a des lignes', to: `${base}/metre`,
      status: empty.length ? 'verifier' : 'ok',
      detail: empty.length ? `${empty.length} famille(s) retenue(s) sans aucune ligne au métré : oubli possible.` : `Les ${s.families.length} famille(s) du périmètre ont des lignes.`,
      items: empty.map((fid) => ({ label: FAMILIES.find((f) => f.id === fid)?.label ?? fid, to: `${base}/metre` })) });
  }

  // ---- Pièces et plans -----------------------------------------------------------------------
  const dce = dceCompleteness(s);
  const essential = dce.missing.filter((m) => m.essential);
  add({ id: 'dce-pieces', group: 'pieces', label: 'Pièces du DCE reçues', to: `${base}/dce`,
    status: essential.length ? 'bloquant' : dce.missing.length ? 'verifier' : 'ok',
    detail: dce.missing.length ? `Manquante(s) : ${dce.missing.map((m) => m.label).join(', ')}.` : `Les ${dce.expected} pièce(s) attendue(s) sont reçues.`,
    items: dce.missing.map((m) => ({ label: m.label, to: `${base}/dce` })) });
  // Plans déclarés reçus mais pas importés (les plans manquants sont déjà comptés ci-dessus).
  const states = dceStatus(s);
  const plans = s.lots.map((lot) => ({ lot, n: s.documents.filter((d) => d.category === `PLANS_${lot}`).length, state: states.find((x) => x.category === `PLANS_${lot}`)?.state }));
  const notImported = plans.filter((p) => p.state === 'declared');
  const missingPlans = plans.filter((p) => p.state === 'missing');
  add({ id: 'plans-importes', group: 'pieces', label: 'Plans de chaque lot disponibles dans l’application', to: `${base}/dce`,
    status: notImported.length ? 'verifier' : 'ok',
    detail: notImported.length ? `Plans ${notImported.map((p) => p.lot).join(' / ')} reçus mais non importés : les quantités de ce lot ne peuvent pas être contrôlées sur plan dans l’application.`
      : `${plans.filter((p) => p.n).map((p) => `${p.n} plan(s) ${p.lot}`).join(', ') || 'Aucun plan importé'}${missingPlans.length ? ` — plans ${missingPlans.map((p) => p.lot).join(' / ')} manquants (voir « Pièces du DCE reçues »)` : ''}. Les quantités ne sont pas mesurées automatiquement sur les plans.` });
  add({ id: 'pieces-classees', group: 'pieces', label: 'Tous les fichiers sont classés', to: `${base}/dce`,
    status: dce.unclassified ? 'verifier' : 'ok',
    detail: dce.unclassified ? `${dce.unclassified} fichier(s) « à classer » : ils ne sont pas pris en compte par l’analyse.` : `${s.documents.length} fichier(s), tous classés.` });

  // ---- Quantités -------------------------------------------------------------------------------
  if (active.length) {
    const ms = metreSummary(s.metre);
    const missing = active.filter((m) => effectiveQty(m) === null);
    add({ id: 'qte-etablies', group: 'quantites', label: 'Toutes les quantités sont établies', to: `${base}/metre?filtre=a-etablir`,
      status: missing.length ? 'bloquant' : 'ok',
      detail: missing.length ? `${missing.length} ligne(s) sans aucune quantité (ni DPGF, ni calculée, ni retenue).` : 'Chaque ligne a une quantité retenue.',
      items: missing.map((m) => ({ label: lineLabel(m), to: `${base}/metre?filtre=a-etablir` })) });
    const unvalidated = active.filter((m) => !m.validated);
    add({ id: 'qte-validees', group: 'quantites', label: 'Les quantités sont validées', to: `${base}/metre?filtre=a-valider`,
      status: unvalidated.length ? 'verifier' : 'ok',
      detail: unvalidated.length ? `${unvalidated.length} ligne(s) sur ${ms.total} non validée(s).` : `Les ${ms.total} ligne(s) sont validées.`,
      items: unvalidated.map((m) => ({ label: lineLabel(m), to: `${base}/metre?filtre=a-valider` })) });
    const gaps = active.filter((m) => gapOf(m).level === 'important' && !m.comment.trim());
    add({ id: 'qte-ecarts', group: 'quantites', label: 'Écarts > 10 % avec la DPGF justifiés', to: `${base}/metre?filtre=ecarts`,
      status: gaps.length ? 'verifier' : 'ok',
      detail: gaps.length ? `${gaps.length} écart(s) important(s) sans commentaire : à justifier ou à signaler au maître d’ouvrage.` : `${ms.majorGaps ? `${ms.majorGaps} écart(s) important(s), tous commentés.` : 'Aucun écart important avec la DPGF.'}`,
      items: gaps.map((m) => ({ label: `${lineLabel(m)} : DPGF ${formatQty(m.dpgfQty)}, retenu ${formatQty(effectiveQty(m))} ${m.unit}`, to: `${base}/metre?filtre=ecarts` })) });
    const zero = active.filter((m) => effectiveQty(m) === 0);
    add({ id: 'qte-nulles', group: 'quantites', label: 'Aucune quantité nulle', to: `${base}/metre`,
      status: zero.length ? 'verifier' : 'ok',
      detail: zero.length ? `${zero.length} ligne(s) à 0 : prestation non chiffrée (pour mémoire ?) — à confirmer.` : 'Aucune ligne à quantité nulle.',
      items: zero.map((m) => ({ label: lineLabel(m), to: `${base}/metre` })) });
  }

  // ---- Prix --------------------------------------------------------------------------------------
  const ch = s.chiffrage;
  if (!active.length) {
    // Sans métré, rien à chiffrer : le contrôle « métré » est déjà bloquant.
  } else if (!ch.lines.length) {
    add({ id: 'prix-manquants', group: 'prix', label: 'Toutes les lignes ont un prix', to: `${base}/chiffrage`, status: 'bloquant', detail: 'Le chiffrage n’est pas commencé.' });
  } else {
    const b = buildUp(s.metre, ch);
    const priceOf = (m: MetreLine) => ch.lines.find((l) => l.metreLineId === m.id);
    const unpriced = active.filter((m) => !isPriced(priceOf(m)));
    add({ id: 'prix-manquants', group: 'prix', label: 'Toutes les lignes ont un prix', to: `${base}/chiffrage`,
      status: unpriced.length ? 'bloquant' : 'ok',
      detail: unpriced.length ? `${unpriced.length} ligne(s) sans aucun prix : le prix de vente est sous-évalué.` : `Les ${b.lines} ligne(s) sont chiffrées.`,
      items: unpriced.map((m) => ({ label: lineLabel(m), to: `${base}/chiffrage` })) });

    const estimated = active.filter((m) => { const p = priceOf(m); return isPriced(p) && p!.source.status === 'estime'; });
    const estAmount = estimated.reduce((t, m) => t + lineCost(m, priceOf(m), ch.params).total, 0);
    add({ id: 'prix-estimes', group: 'prix', label: 'Prix estimés remplacés par des prix confirmés', to: `${base}/chiffrage`,
      status: estimated.length ? 'verifier' : 'ok',
      detail: estimated.length ? `${estimated.length} prix estimé(s) (base indicative ou estimation) : ${formatEuro(estAmount)}, soit ${pct(b.dryCost ? estAmount / b.dryCost : 0)} du déboursé sec.` : 'Aucun prix estimé.',
      items: estimated.map((m) => ({ label: `${lineLabel(m)} — ${formatEuro(lineCost(m, priceOf(m), ch.params).total)}`, to: `${base}/chiffrage` })) });

    const toConfirm = active.filter((m) => { const p = priceOf(m); return isPriced(p) && p!.source.status === 'a-confirmer'; });
    add({ id: 'prix-a-confirmer', group: 'prix', label: 'Prix « à confirmer » confirmés', to: `${base}/chiffrage`,
      status: toConfirm.length ? 'verifier' : 'ok',
      detail: toConfirm.length ? `${toConfirm.length} prix encore à confirmer.` : 'Aucun prix en attente de confirmation.',
      items: toConfirm.map((m) => ({ label: lineLabel(m), to: `${base}/chiffrage` })) });

    const abnormal: CheckItem[] = [];
    for (const m of active) {
      const p = priceOf(m);
      if (!p || !isPriced(p) || p.source.kind === 'base' || isLumpSum(s, p)) continue;
      const ref = baseLineFor(m);
      const c = lineCost(m, p, ch.params);
      if (!ref || c.unitCost === null || c.unitCost <= 0) continue;
      const refUnit = (ref.materialUnit ?? 0) + (ref.laborHoursUnit ?? 0) * ch.params.hourlyRate;
      const ratio = c.unitCost / refUnit;
      if (ratio > THRESHOLDS.priceRatio || ratio < 1 / THRESHOLDS.priceRatio) {
        abnormal.push({ label: `${lineLabel(m)} : ${formatEuro(c.unitCost)} / ${m.unit} (base indicative ≈ ${formatEuro(refUnit)}, ×${ratio.toLocaleString('fr-FR', { maximumFractionDigits: 1 })})`, to: `${base}/chiffrage` });
      }
    }
    add({ id: 'prix-anormaux', group: 'prix', label: 'Prix unitaires dans les ordres de grandeur', to: `${base}/chiffrage`,
      status: abnormal.length ? 'verifier' : 'ok',
      detail: abnormal.length ? `${abnormal.length} déboursé(s) unitaire(s) plus de ${THRESHOLDS.priceRatio} fois au-dessus ou en dessous de la base indicative : erreur d’unité ou de saisie ?` : 'Aucun déboursé unitaire très éloigné de la base indicative.',
      items: abnormal });

    const noLabor = active.filter((m) => {
      const p = priceOf(m);
      return !!p && (p.materialUnit ?? 0) > 0 && !p.laborHoursUnit && !p.subcontractUnit && !isLumpSum(s, p);
    });
    add({ id: 'pose-chiffree', group: 'prix', label: 'La pose est chiffrée', to: `${base}/chiffrage`,
      status: noLabor.length ? 'verifier' : 'ok',
      detail: noLabor.length ? `${noLabor.length} ligne(s) avec fourniture mais sans main-d’œuvre ni sous-traitance.` : 'Chaque fourniture a sa main-d’œuvre ou sa sous-traitance.',
      items: noLabor.map((m) => ({ label: lineLabel(m), to: `${base}/chiffrage` })) });

    const margin = ch.params.marginPct;
    add({ id: 'marge', group: 'prix', label: 'Marge dans la fourchette habituelle', to: `${base}/chiffrage`,
      status: margin < 0 ? 'bloquant' : margin < THRESHOLDS.marginLow || margin > THRESHOLDS.marginHigh ? 'verifier' : 'ok',
      detail: `Marge ${margin.toLocaleString('fr-FR')} % (${formatEuro(b.margin)}), coefficient de vente ${b.coefficient?.toLocaleString('fr-FR') ?? '—'}${margin < 0 ? ' : offre vendue à perte.' : margin < THRESHOLDS.marginLow ? ' : marge très faible.' : margin > THRESHOLDS.marginHigh ? ' : marge inhabituellement élevée.' : '.'}` });

    const rate = ch.params.hourlyRate;
    add({ id: 'taux-horaire', group: 'prix', label: 'Taux horaire plausible', to: `${base}/chiffrage`,
      status: rate < THRESHOLDS.hourlyRateMin || rate > THRESHOLDS.hourlyRateMax ? 'verifier' : 'ok',
      detail: `Taux horaire ${formatEuro(rate)} / h pour ${b.laborHours.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} h de main-d’œuvre (plage attendue : ${THRESHOLDS.hourlyRateMin} à ${THRESHOLDS.hourlyRateMax} € / h).` });

    if (s.estimatedAmount > 0 && b.salePrice > 0) {
      const gap = (b.salePrice - s.estimatedAmount) / s.estimatedAmount;
      add({ id: 'ecart-estimation', group: 'prix', label: 'Prix de vente cohérent avec le montant estimé', to: `${base}/chiffrage`,
        status: Math.abs(gap) > THRESHOLDS.estimateGap ? 'verifier' : 'ok',
        detail: `Prix de vente ${formatEuro(b.salePrice)} pour un montant estimé de ${formatEuro(s.estimatedAmount)} (${gap >= 0 ? '+' : ''}${pct(gap)}).` });
    }
  }

  // ---- Offres fournisseurs (contrôle prix) -----------------------------------------------------------
  if (s.consultations.length) {
    const cs = consultationSummary(s.consultations, today);
    const waiting = cs.waiting + cs.toSend;
    add({ id: 'offres-recues', group: 'prix', label: 'Offres fournisseurs reçues', to: `${base}/consultations`,
      status: waiting ? 'verifier' : 'ok',
      detail: waiting ? `${waiting} demande(s) de prix sans réponse${cs.late ? `, dont ${cs.late} en retard` : ''}.` : `${cs.received} offre(s) reçue(s), aucune demande en attente.` });
    const notImported: CheckItem[] = [];
    const expiring: CheckItem[] = [];
    for (const c of s.consultations) {
      const r = c.requests.find((x) => x.id === c.retainedRequestId);
      if (!r?.offer) continue;
      const lines = c.metreLineIds.filter((id) => active.some((m) => m.id === id));
      const reported = lines.filter((id) => ch.lines.find((l) => l.metreLineId === id)?.source.requestId === r.id);
      if (lines.length && !reported.length) notImported.push({ label: c.label, to: `${base}/consultations/${c.id}` });
      if (isExpired(r.offer, today) || (r.offer.validUntil && r.offer.validUntil < s.dueDate)) {
        expiring.push({ label: `${c.label} : offre valable jusqu’au ${formatDate(r.offer.validUntil)}`, to: `${base}/consultations/${c.id}` });
      }
    }
    const retained = s.consultations.filter((c) => c.retainedRequestId).length;
    add({ id: 'offres-reportees', group: 'prix', label: 'Offres retenues reportées au chiffrage', to: `${base}/chiffrage`,
      status: notImported.length ? 'verifier' : 'ok',
      detail: notImported.length ? `${notImported.length} offre(s) retenue(s) dont aucun prix n’est repris dans le chiffrage.` : retained ? `Les ${retained} offre(s) retenue(s) sont reprises au chiffrage.` : 'Aucune offre retenue pour le moment.',
      items: notImported });
    add({ id: 'offres-validite', group: 'prix', label: 'Offres retenues valables à la date de remise', to: `${base}/consultations`,
      status: expiring.length ? 'verifier' : 'ok',
      detail: expiring.length ? `${expiring.length} offre(s) retenue(s) expirée(s) ou expirant avant la remise du ${formatDate(s.dueDate)} : demander une prolongation.` : 'Toutes les offres retenues sont valables à la date de remise.',
      items: expiring });
  }

  // ---- Risques, questions, délai ------------------------------------------------------------------------
  const rs = riskSummary(s.risks);
  const critical = s.risks.filter((r) => isRiskActive(r) && r.level === 'critique');
  add({ id: 'risques-critiques', group: 'risques', label: 'Aucun risque critique actif', to: `${base}/risques`,
    status: critical.length ? 'bloquant' : 'ok',
    detail: critical.length ? `${critical.length} risque(s) critique(s) ouvert(s) ou en cours : à maîtriser, provisionner ou porter en réserve.` : s.risks.length ? 'Aucun risque critique actif.' : 'Aucun risque enregistré (registre vide).',
    items: critical.map((r) => ({ label: `${riskCode(r)} ${r.title}${r.action ? '' : ' — sans action'}`, to: `${base}/risques` })) });
  const noAction = s.risks.filter((r) => isRiskActive(r) && r.level === 'important' && !r.action.trim());
  add({ id: 'risques-actions', group: 'risques', label: 'Chaque risque important a une action', to: `${base}/risques`,
    status: noAction.length ? 'verifier' : 'ok',
    detail: noAction.length ? `${noAction.length} risque(s) important(s) sans action définie.` : 'Tous les risques importants ont une action.',
    items: noAction.map((r) => ({ label: `${riskCode(r)} ${r.title}`, to: `${base}/risques` })) });
  if (rs.exposure > 0 && ch.lines.length) {
    const provision = buildUp(s.metre, ch).risk;
    add({ id: 'provision', group: 'risques', label: 'Provision pour aléas en rapport avec l’exposition', to: `${base}/chiffrage`,
      status: provision < rs.exposure ? 'verifier' : 'ok',
      detail: `Provision ${formatEuro(provision)} pour une exposition de ${formatEuro(rs.exposure)} (${pct(provision / rs.exposure)}).` });
  }
  const openQ = s.questions.filter(isQuestionOpen);
  const blocking = openQ.filter((q) => q.blocking);
  add({ id: 'questions-bloquantes', group: 'risques', label: 'Questions bloquantes répondues', to: `${base}/questions`,
    status: blocking.length ? 'bloquant' : 'ok',
    detail: blocking.length ? `${blocking.length} question(s) bloquante(s) sans réponse : le prix repose sur une hypothèse.` : 'Aucune question bloquante en attente.',
    items: blocking.map((q) => ({ label: `${questionCode(q)} ${q.subject}${isQuestionLate(q, today) ? ' — en retard' : ''}`, to: `${base}/questions` })) });
  const otherQ = openQ.filter((q) => !q.blocking);
  add({ id: 'questions-ouvertes', group: 'risques', label: 'Questions ouvertes traitées', to: `${base}/questions`,
    status: otherQ.length ? 'verifier' : 'ok',
    detail: otherQ.length ? `${otherQ.length} question(s) sans réponse : hypothèses à mentionner dans l’offre.` : 'Aucune autre question ouverte.',
    items: otherQ.map((q) => ({ label: `${questionCode(q)} ${q.subject}`, to: `${base}/questions` })) });
  const days = daysUntil(s.dueDate, today);
  add({ id: 'echeance', group: 'risques', label: 'Délai de remise tenable', to: base,
    status: days < 0 ? 'bloquant' : days <= 1 ? 'verifier' : 'ok',
    detail: days < 0 ? `Date de remise dépassée de ${-days} jour(s).` : `Remise le ${formatDate(s.dueDate)} à ${s.dueTime} (${days === 0 ? 'aujourd’hui' : days === 1 ? 'demain' : `dans ${days} jours`}).` });

  return out;
}

/** La justification s'applique si le constat n'a pas changé depuis. */
export function isJustified(c: ReviewCheck, j: Record<string, ReviewJustification>): boolean {
  return c.status === 'verifier' && j[c.id]?.detail === c.detail;
}

export function scoreOf(checks: ReviewCheck[], j: Record<string, ReviewJustification> = {}): ReviewScore {
  const passed = checks.filter((c) => c.status === 'ok').length;
  const justified = checks.filter((c) => isJustified(c, j)).length;
  const toCheck = checks.filter((c) => c.status === 'verifier').length - justified;
  const blocking = checks.filter((c) => c.status === 'bloquant').length;
  const na = checks.filter((c) => c.status === 'na').length;
  const applicable = checks.length - na;
  return { score: applicable ? Math.round(((passed + justified) / applicable) * 100) : 0, passed, justified, toCheck, blocking, applicable, na };
}

export function runReview(s: Study, user: string, today = new Date()): ReviewRecord {
  return { runAt: today.toISOString(), runBy: user, signature: reviewSignature(s), checks: runChecks(s, today) };
}

/** L'étude a-t-elle changé depuis la dernière revue ? */
export function isReviewStale(s: Study): boolean {
  return !!s.review && s.review.signature !== reviewSignature(s);
}

export const CHECK_STATUS_LABELS: Record<CheckStatus, string> = { ok: 'Réussi', verifier: 'À vérifier', bloquant: 'Bloquant', na: 'Sans objet' };
