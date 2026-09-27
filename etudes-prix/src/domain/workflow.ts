import type { RiskLevel, Study, StudyStatus } from './types';
import { daysUntil } from './dates';
import { missingDocs } from './catalog';
import { summarize } from './analysis/summary';
import { metreSummary } from './metre';
import { consultationSummary } from './consultations';
import { buildUp } from './chiffrage';
import { isQuestionLate, riskSummary } from './risks';
import { isReviewStale, scoreOf } from './review';

export interface StageInfo {
  id: StudyStatus;
  label: string;
  short: string;
  /** Avancement minimum atteint en entrant dans l'étape. */
  minProgress: number;
  /** Ce que le responsable doit faire à cette étape. */
  todo: string;
  /** Version du module qui outillera cette étape. */
  module: string;
  /** Le module outillant l'étape est livré. */
  delivered: boolean;
}

export const STAGES: StageInfo[] = [
  { id: 'analyse', label: 'Analyse DCE', short: 'Analyse', minProgress: 0, module: 'V1.2 / V1.3', delivered: true,
    todo: 'Lire le DCE, vérifier les pièces, repérer les prestations et les points critiques.' },
  { id: 'metre', label: 'Métré', short: 'Métré', minProgress: 20, module: 'V1.4', delivered: true,
    todo: 'Établir et contrôler les quantités CFO/CFA par rapport à la DPGF et aux plans.' },
  { id: 'consultation', label: 'Consultations', short: 'Consultation', minProgress: 35, module: 'V1.5', delivered: true,
    todo: 'Consulter fournisseurs et sous-traitants, relancer, comparer les offres.' },
  { id: 'chiffrage', label: 'Chiffrage', short: 'Chiffrage', minProgress: 55, module: 'V1.6', delivered: true,
    todo: 'Calculer le déboursé sec, intégrer la main-d’œuvre et les frais, fixer le prix de vente.' },
  { id: 'revue', label: 'Revue de prix', short: 'Revue', minProgress: 75, module: 'V1.8', delivered: true,
    todo: 'Contrôler la cohérence du chiffrage : quantités, prix, risques, oublis.' },
  { id: 'validation', label: 'Validation', short: 'Validation', minProgress: 90, module: 'V1.9', delivered: true,
    todo: 'Valider l’étude avec la direction et préparer le dossier de remise.' },
  { id: 'remise', label: 'Remise', short: 'Remise', minProgress: 100, module: 'V1.10', delivered: false,
    todo: 'Offre remise au client. L’étude est terminée.' },
];

export const STATUS_ORDER: StudyStatus[] = STAGES.map((s) => s.id);

export function stageOf(status: StudyStatus): StageInfo {
  return STAGES.find((s) => s.id === status)!;
}

export function stageIndex(status: StudyStatus): number {
  return STATUS_ORDER.indexOf(status);
}

export function nextStatus(status: StudyStatus): StudyStatus | null {
  const i = stageIndex(status);
  return i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null;
}

export function previousStatus(status: StudyStatus): StudyStatus | null {
  const i = stageIndex(status);
  return i > 0 ? STATUS_ORDER[i - 1] : null;
}

/** Avancement cohérent après un changement d'étape (jamais en recul automatique). */
export function progressForStatus(status: StudyStatus, current: number): number {
  const stage = stageOf(status);
  if (status === 'remise') return 100;
  const next = nextStatus(status);
  const max = next ? stageOf(next).minProgress - 1 : 99;
  return Math.min(Math.max(current, stage.minProgress), max);
}

export function isActive(study: Study): boolean {
  return study.status !== 'remise';
}

export const RISK_ORDER: RiskLevel[] = ['critique', 'important', 'surveiller', 'ok'];

export interface NextAction {
  label: string;
  tone: 'danger' | 'warning' | 'info' | 'success';
  reason: string;
}

/** Détermine la prochaine action à mener sur une étude (affichée partout). */
export function nextAction(study: Study, today = new Date()): NextAction {
  if (study.status === 'remise') {
    return { label: 'Aucune', tone: 'success', reason: 'Offre remise.' };
  }
  if (study.validation) {
    return { label: 'Remettre l’offre', tone: 'success', reason: `Étude validée (V${study.validation.version}) : imprimez le dossier final et remettez l’offre.` };
  }
  const days = daysUntil(study.dueDate, today);
  if (days < 0) {
    return { label: 'Échéance dépassée', tone: 'danger', reason: `Date de remise dépassée de ${-days} j.` };
  }
  const missing = missingDocs(study.dceDocs, study.lots).length;
  if (study.status === 'analyse' && missing > 0) {
    return { label: 'Compléter le DCE', tone: 'warning', reason: `${missing} pièce(s) du DCE manquante(s).` };
  }
  if (study.status === 'analyse' && study.documents.some((d) => d.category === 'CCTP')) {
    if (!study.analysis) {
      return { label: 'Lancer l’analyse', tone: 'info', reason: 'Le CCTP est importé : lancez l’analyse automatique du DCE.' };
    }
    const critical = summarize(study.analysis, study.analysisDecisions).critical;
    if (critical > 0) {
      return { label: 'Traiter les points critiques', tone: 'warning', reason: `${critical} point(s) critique(s) relevé(s) par l’analyse du DCE.` };
    }
  }
  if (study.status === 'metre') {
    const m = metreSummary(study.metre);
    if (!m.total) return { label: 'Créer le métré', tone: 'info', reason: 'Le métré n’a pas encore été établi : créez-le à partir de la DPGF.' };
    if (m.validated < m.total) {
      return { label: 'Valider les quantités', tone: m.majorGaps ? 'warning' : 'info',
        reason: `${m.total - m.validated} ligne(s) à valider${m.majorGaps ? `, dont ${m.majorGaps} écart(s) > 10 %` : ''}.` };
    }
  }
  if (study.status === 'consultation' && !study.consultations?.length && study.indicators.pendingPrices === 0) {
    return { label: 'Lancer les consultations', tone: 'info', reason: 'Aucune consultation fournisseur n’a encore été créée.' };
  }
  const late = study.consultations?.length ? consultationSummary(study.consultations, today).late : 0;
  if ((study.status === 'consultation' || study.status === 'chiffrage') && late > 0) {
    return { label: 'Relancer', tone: 'warning', reason: `${late} fournisseur(s) sans réponse après la date attendue.` };
  }
  const pending = study.consultations?.length
    ? consultationSummary(study.consultations, today).waiting + consultationSummary(study.consultations, today).toSend
    : study.indicators.pendingPrices;
  if ((study.status === 'consultation' || study.status === 'chiffrage') && pending > 0) {
    return { label: 'Relancer', tone: 'warning', reason: `${pending} prix fournisseur(s) en attente.` };
  }
  if (study.status === 'chiffrage') {
    const b = buildUp(study.metre, study.chiffrage);
    if (!study.chiffrage.lines.length) return { label: 'Chiffrer', tone: 'info', reason: 'Aucun prix saisi : pré-remplissez avec la base de prix et reportez les offres retenues.' };
    if (b.missing > 0) return { label: 'Compléter les prix', tone: 'warning', reason: `${b.missing} ligne(s) sans prix.` };
    if (b.toConfirm + b.estimated > 0) return { label: 'Confirmer les prix', tone: 'info', reason: `${b.toConfirm} prix à confirmer et ${b.estimated} prix estimé(s).` };
  }
  const critical = study.risks?.length ? riskSummary(study.risks).critical : study.indicators.criticalRisks;
  if (critical > 0 && (study.status === 'revue' || study.status === 'validation')) {
    return { label: 'Traiter les risques', tone: 'danger', reason: `${critical} risque(s) critique(s) avant validation.` };
  }
  const lateBlocking = (study.questions ?? []).filter((q) => q.blocking && isQuestionLate(q, today));
  if (lateBlocking.length) {
    return { label: 'Relancer le maître d’ouvrage', tone: 'warning', reason: `${lateBlocking.length} question(s) bloquante(s) sans réponse après la date attendue.` };
  }
  switch (study.status) {
    case 'analyse': return { label: 'Analyser le DCE', tone: 'info', reason: stageOf('analyse').todo };
    case 'metre': return { label: 'Métrer', tone: 'info', reason: stageOf('metre').todo };
    case 'consultation': return { label: 'Comparer les offres', tone: 'info', reason: stageOf('consultation').todo };
    case 'chiffrage': return { label: 'Chiffrer', tone: 'info', reason: stageOf('chiffrage').todo };
    case 'revue':
    case 'validation': {
      if (!study.review) return { label: 'Lancer la revue', tone: 'info', reason: 'Contrôlez la cohérence du chiffrage avant la validation.' };
      if (isReviewStale(study)) return { label: 'Relancer la revue', tone: 'warning', reason: 'L’étude a changé depuis la dernière revue.' };
      const sc = scoreOf(study.review.checks, study.reviewJustifications ?? {});
      if (sc.blocking) return { label: 'Corriger les anomalies', tone: 'danger', reason: `${sc.blocking} contrôle(s) bloquant(s) dans la revue de prix.` };
      if (study.status === 'validation') return { label: 'Valider', tone: 'success', reason: `Revue de prix à jour (${sc.score} %) : relisez le récapitulatif, cochez les points de contrôle et validez l’étude.` };
      if (sc.toCheck) return { label: 'Traiter les points à vérifier', tone: 'warning', reason: `${sc.toCheck} point(s) de la revue à corriger ou à justifier.` };
      return { label: 'Passer à la validation', tone: 'success', reason: `Revue de prix terminée (${sc.score} %).` };
    }
  }
}
