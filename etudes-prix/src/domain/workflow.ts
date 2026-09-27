import type { RiskLevel, Study, StudyStatus } from './types';
import { daysUntil } from './dates';
import { missingDocs } from './catalog';

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
}

export const STAGES: StageInfo[] = [
  { id: 'analyse', label: 'Analyse DCE', short: 'Analyse', minProgress: 0, module: 'V1.2 / V1.3',
    todo: 'Lire le DCE, vérifier les pièces, repérer les prestations et les points critiques.' },
  { id: 'metre', label: 'Métré', short: 'Métré', minProgress: 20, module: 'V1.4',
    todo: 'Établir et contrôler les quantités CFO/CFA par rapport à la DPGF et aux plans.' },
  { id: 'consultation', label: 'Consultations', short: 'Consultation', minProgress: 35, module: 'V1.5',
    todo: 'Consulter fournisseurs et sous-traitants, relancer, comparer les offres.' },
  { id: 'chiffrage', label: 'Chiffrage', short: 'Chiffrage', minProgress: 55, module: 'V1.6',
    todo: 'Calculer le déboursé sec, intégrer la main-d’œuvre et les frais, fixer le prix de vente.' },
  { id: 'revue', label: 'Revue de prix', short: 'Revue', minProgress: 75, module: 'V1.8',
    todo: 'Contrôler la cohérence du chiffrage : quantités, prix, risques, oublis.' },
  { id: 'validation', label: 'Validation', short: 'Validation', minProgress: 90, module: 'V1.9',
    todo: 'Valider l’étude avec la direction et préparer le dossier de remise.' },
  { id: 'remise', label: 'Remise', short: 'Remise', minProgress: 100, module: 'V1.10',
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
  const days = daysUntil(study.dueDate, today);
  if (days < 0) {
    return { label: 'Échéance dépassée', tone: 'danger', reason: `Date de remise dépassée de ${-days} j.` };
  }
  const missing = missingDocs(study.dceDocs, study.lots).length;
  if (study.status === 'analyse' && missing > 0) {
    return { label: 'Compléter le DCE', tone: 'warning', reason: `${missing} pièce(s) du DCE manquante(s).` };
  }
  if ((study.status === 'consultation' || study.status === 'chiffrage') && study.indicators.pendingPrices > 0) {
    return { label: 'Relancer', tone: 'warning', reason: `${study.indicators.pendingPrices} prix fournisseur(s) en attente.` };
  }
  if (study.indicators.criticalRisks > 0 && (study.status === 'revue' || study.status === 'validation')) {
    return { label: 'Traiter les risques', tone: 'danger', reason: `${study.indicators.criticalRisks} risque(s) critique(s) avant validation.` };
  }
  switch (study.status) {
    case 'analyse': return { label: 'Analyser le DCE', tone: 'info', reason: stageOf('analyse').todo };
    case 'metre': return { label: 'Métrer', tone: 'info', reason: stageOf('metre').todo };
    case 'consultation': return { label: 'Comparer les offres', tone: 'info', reason: stageOf('consultation').todo };
    case 'chiffrage': return { label: 'Chiffrer', tone: 'info', reason: stageOf('chiffrage').todo };
    case 'revue': return { label: 'Faire la revue', tone: 'info', reason: stageOf('revue').todo };
    case 'validation': return { label: 'Valider', tone: 'success', reason: 'L’étude est prête à être validée.' };
  }
}
