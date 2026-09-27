import type { RiskLevel, Study, StudyStatus } from './types';
import { STAGES, isActive, nextAction, RISK_ORDER } from './workflow';
import { daysUntil } from './dates';
import { consultationSummary } from './consultations';
import { buildUp } from './chiffrage';
import { missingDocs } from './catalog';

/**
 * Prix en attente : calculé depuis les consultations quand l'étude en a,
 * sinon valeur saisie manuellement.
 */
export function pendingPricesOf(s: Study, today = new Date()): number {
  if (!s.consultations?.length) return s.indicators.pendingPrices;
  const sum = consultationSummary(s.consultations, today);
  return sum.waiting + sum.toSend;
}

/** Demandes de prix sans réponse après la date attendue. */
export function lateRequestsOf(s: Study, today = new Date()): number {
  return s.consultations?.length ? consultationSummary(s.consultations, today).late : 0;
}

/** Montant d'une étude : prix de vente chiffré s'il existe, sinon montant estimé. */
export function amountOf(s: Study): number {
  if (s.chiffrage?.lines.length) {
    const pv = buildUp(s.metre, s.chiffrage).salePrice;
    if (pv > 0) return pv;
  }
  return s.estimatedAmount;
}

export interface DashboardKpis {
  activeCount: number;
  dueSoonCount: number;
  overdueCount: number;
  activeAmount: number;
  criticalRisks: number;
  pendingPrices: number;
  readyToValidate: number;
}

/** Échéance « proche » : dans les 7 prochains jours (aujourd'hui inclus). */
export const DUE_SOON_DAYS = 7;

export function isDueSoon(s: Study, today = new Date()): boolean {
  const d = daysUntil(s.dueDate, today);
  return isActive(s) && d >= 0 && d < DUE_SOON_DAYS;
}

export function isOverdue(s: Study, today = new Date()): boolean {
  return isActive(s) && daysUntil(s.dueDate, today) < 0;
}

export function computeKpis(studies: Study[], today = new Date()): DashboardKpis {
  const active = studies.filter(isActive);
  return {
    activeCount: active.length,
    dueSoonCount: active.filter((s) => isDueSoon(s, today)).length,
    overdueCount: active.filter((s) => isOverdue(s, today)).length,
    activeAmount: active.reduce((sum, s) => sum + amountOf(s), 0),
    criticalRisks: active.reduce((sum, s) => sum + s.indicators.criticalRisks, 0),
    pendingPrices: active.reduce((sum, s) => sum + pendingPricesOf(s, today), 0),
    readyToValidate: active.filter((s) => s.status === 'validation').length,
  };
}

export function countByStatus(studies: Study[]): { status: StudyStatus; label: string; count: number }[] {
  return STAGES.map((st) => ({
    status: st.id,
    label: st.short,
    count: studies.filter((s) => s.status === st.id).length,
  }));
}

/**
 * Ordre de priorité : retard d'abord, puis échéance la plus proche,
 * puis niveau de risque le plus élevé.
 */
export function sortByPriority(studies: Study[], today = new Date()): Study[] {
  return studies
    .filter(isActive)
    .slice()
    .sort((a, b) => {
      const da = daysUntil(a.dueDate, today);
      const db = daysUntil(b.dueDate, today);
      if (da !== db) return da - db;
      return RISK_ORDER.indexOf(a.riskLevel) - RISK_ORDER.indexOf(b.riskLevel);
    });
}

export type AlertKind = 'overdue' | 'due-soon' | 'critical-risk' | 'missing-dce' | 'ready' | 'relance';

export interface Alert {
  kind: AlertKind;
  studyId: string;
  studyName: string;
  message: string;
  level: RiskLevel;
}

/** Ce qui bloque ou demande une action aujourd'hui (tableau de bord + notifications). */
export function computeAlerts(studies: Study[], today = new Date()): Alert[] {
  const alerts: Alert[] = [];
  for (const s of sortByPriority(studies, today)) {
    const days = daysUntil(s.dueDate, today);
    if (days < 0) {
      alerts.push({ kind: 'overdue', studyId: s.id, studyName: s.name, level: 'critique', message: `Échéance dépassée de ${-days} j` });
    } else if (days < DUE_SOON_DAYS) {
      alerts.push({ kind: 'due-soon', studyId: s.id, studyName: s.name, level: days <= 2 ? 'critique' : 'important',
        message: days === 0 ? 'Remise aujourd’hui' : `Remise dans ${days} j` });
    }
    if (s.indicators.criticalRisks > 0) {
      alerts.push({ kind: 'critical-risk', studyId: s.id, studyName: s.name, level: 'critique',
        message: `${s.indicators.criticalRisks} risque(s) critique(s)` });
    }
    const missing = missingDocs(s.dceDocs, s.lots).length;
    if (missing > 0) {
      alerts.push({ kind: 'missing-dce', studyId: s.id, studyName: s.name, level: 'surveiller',
        message: `${missing} pièce(s) DCE manquante(s)` });
    }
    const late = lateRequestsOf(s, today);
    if (late > 0) {
      alerts.push({ kind: 'relance', studyId: s.id, studyName: s.name, level: 'important', message: `${late} fournisseur(s) à relancer` });
    }
    if (nextAction(s, today).label === 'Valider') {
      alerts.push({ kind: 'ready', studyId: s.id, studyName: s.name, level: 'ok', message: 'Prête à être validée' });
    }
  }
  return alerts;
}
