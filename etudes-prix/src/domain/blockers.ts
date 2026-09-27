import type { Study } from './types';
import { daysUntil } from './dates';
import { dceCompleteness } from './documents';
import { summarize } from './analysis/summary';
import { dceSignature } from './analysis/analyse';
import { metreSummary } from './metre';
import { consultationSummary } from './consultations';
import { buildUp } from './chiffrage';
import { isReviewStale, scoreOf } from './review';
import { isQuestionLate, isQuestionOpen, isRiskActive, questionCode, riskCode } from './risks';

export interface Blocker {
  id: string;
  level: 'critique' | 'important';
  label: string;
  detail: string;
  /** Page où traiter le blocage. */
  to: string;
}

/**
 * « Qu'est-ce qui bloque ? » : ce qui empêche de remettre une offre fiable,
 * rassemblé depuis tous les modules de l'étude, du plus grave au moins grave.
 */
export function studyBlockers(s: Study, today = new Date()): Blocker[] {
  if (s.status === 'remise') return [];
  const out: Blocker[] = [];
  const base = `/etudes/${s.id}`;
  const days = daysUntil(s.dueDate, today);
  if (days < 0) out.push({ id: 'echeance', level: 'critique', label: 'Échéance dépassée', detail: `La date de remise est passée de ${-days} jour(s).`, to: base });

  const dce = dceCompleteness(s);
  const essentialMissing = dce.missing.filter((m) => m.essential);
  if (essentialMissing.length) {
    out.push({ id: 'dce', level: 'critique', label: 'Pièces du DCE manquantes', detail: essentialMissing.map((m) => m.label).join(', '), to: `${base}/dce` });
  }

  if (s.analysis) {
    const a = summarize(s.analysis, s.analysisDecisions);
    if (a.critical) out.push({ id: 'analyse', level: 'critique', label: `${a.critical} point(s) critique(s) de l’analyse non traité(s)`, detail: 'Écarts CCTP / DPGF, hypothèses à confirmer, clauses à risque.', to: `${base}/analyse?filtre=critique` });
    if (s.analysis.dceSignature !== dceSignature(s.documents)) out.push({ id: 'analyse-perimee', level: 'important', label: 'Analyse à relancer', detail: 'Le DCE a changé depuis la dernière analyse.', to: `${base}/analyse` });
  }

  const m = metreSummary(s.metre);
  if (m.total) {
    if (m.majorGaps) out.push({ id: 'metre-ecarts', level: 'important', label: `${m.majorGaps} écart(s) de quantité > 10 %`, detail: 'Quantités à justifier ou à signaler au maître d’ouvrage.', to: `${base}/metre?filtre=ecarts` });
    if (m.toEstablish) out.push({ id: 'metre-a-etablir', level: 'important', label: `${m.toEstablish} quantité(s) à établir`, detail: 'Lignes du métré sans aucune quantité.', to: `${base}/metre?filtre=a-etablir` });
  }

  const c = consultationSummary(s.consultations, today);
  if (c.late) out.push({ id: 'relances', level: 'important', label: `${c.late} fournisseur(s) à relancer`, detail: 'Réponse attendue dépassée.', to: `${base}/consultations` });

  if (s.chiffrage.lines.length) {
    const b = buildUp(s.metre, s.chiffrage);
    if (b.missing) out.push({ id: 'prix', level: 'critique', label: `${b.missing} prix manquant(s)`, detail: 'Lignes du métré sans aucun prix.', to: `${base}/chiffrage` });
  }

  // Risques critiques : détaillés s'il n'y en a qu'un, regroupés sinon.
  const critical = s.risks.filter((x) => isRiskActive(x) && x.level === 'critique');
  if (critical.length === 1) {
    const r = critical[0];
    out.push({ id: 'risques-critiques', level: 'critique', label: `Risque critique ${riskCode(r)} : ${r.title}`,
      detail: r.action.trim() ? `Action : ${r.action}` : 'Aucune action définie.', to: `${base}/risques` });
  } else if (critical.length > 1) {
    out.push({ id: 'risques-critiques', level: 'critique', label: `${critical.length} risques critiques actifs`,
      detail: critical.map((r) => `${riskCode(r)} ${r.title}`).join(' · '), to: `${base}/risques` });
  }

  // Questions bloquantes sans réponse, regroupées ; critique si l'une est en retard.
  const blocking = s.questions.filter((x) => isQuestionOpen(x) && x.blocking);
  if (blocking.length) {
    const late = blocking.filter((q) => isQuestionLate(q, today));
    const toSend = blocking.filter((q) => q.status === 'a-envoyer').length;
    out.push({
      id: 'questions-bloquantes', level: late.length ? 'critique' : 'important',
      label: blocking.length === 1 ? `Question bloquante ${questionCode(blocking[0])} : ${blocking[0].subject}` : `${blocking.length} questions bloquantes sans réponse`,
      detail: [late.length ? `${late.map(questionCode).join(', ')} en retard — à relancer` : '', toSend ? `${toSend} à envoyer` : '', `${blocking.map(questionCode).join(', ')}`]
        .filter(Boolean).join(' · '),
      to: `${base}/questions`,
    });
  }

  // Revue de prix : à faire, à relancer ou non concluante (les causes sont listées ci-dessus).
  if (s.status === 'revue' || s.status === 'validation') {
    if (!s.review) out.push({ id: 'revue', level: 'important', label: 'Revue de prix à lancer', detail: 'Les contrôles de cohérence n’ont pas été exécutés.', to: `${base}/revue` });
    else if (isReviewStale(s)) out.push({ id: 'revue', level: 'important', label: 'Revue de prix à relancer', detail: 'L’étude a changé depuis la dernière revue.', to: `${base}/revue` });
    else {
      const sc = scoreOf(s.review.checks, s.reviewJustifications ?? {});
      if (sc.toCheck) out.push({ id: 'revue', level: 'important', label: `${sc.toCheck} point(s) de la revue à vérifier`, detail: 'À corriger, ou à justifier avec un motif.', to: `${base}/revue?filtre=verifier` });
    }
  }

  const order = { critique: 0, important: 1 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
