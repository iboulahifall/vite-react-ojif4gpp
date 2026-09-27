import type { PlanTask, StudyStatus } from './types';
import { addDays, daysUntil, parseISODate, previousWorkingDay, toISODate } from './dates';

/** Part du délai total allouée à chaque étape (cumulée pour dater la fin d'étape). */
const PLAN_TEMPLATE: { stage: StudyStatus; label: string; share: number }[] = [
  { stage: 'analyse', label: 'Analyse du DCE et questions', share: 0.15 },
  { stage: 'metre', label: 'Métré CFO / CFA', share: 0.2 },
  { stage: 'consultation', label: 'Consultations fournisseurs et sous-traitants', share: 0.25 },
  { stage: 'chiffrage', label: 'Chiffrage et déboursé', share: 0.2 },
  { stage: 'revue', label: 'Revue de prix', share: 0.1 },
  { stage: 'validation', label: 'Validation et remise de l’offre', share: 0.1 },
];

/** Délai en dessous duquel le plan est jugé tendu (jours calendaires). */
export const TIGHT_PLAN_DAYS = 10;

/**
 * Génère un plan de travail rétro-planifié entre aujourd'hui et la date de remise.
 * Les jalons tombant un week-end sont ramenés au vendredi précédent,
 * sans jamais passer avant aujourd'hui.
 */
export function generatePlan(dueDate: string, today = new Date(), idPrefix = 't'): PlanTask[] {
  const total = Math.max(daysUntil(dueDate, today), 0);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let cumulated = 0;
  return PLAN_TEMPLATE.map((t, i) => {
    cumulated += t.share;
    const isLast = i === PLAN_TEMPLATE.length - 1;
    let date = isLast ? parseISODate(dueDate) : addDays(start, Math.round(total * cumulated));
    if (!isLast) {
      const shifted = previousWorkingDay(date);
      date = shifted < start ? start : shifted;
    }
    return { id: `${idPrefix}-${i + 1}`, stage: t.stage, label: t.label, dueDate: toISODate(date), done: false };
  });
}

export function isPlanTight(dueDate: string, today = new Date()): boolean {
  return daysUntil(dueDate, today) < TIGHT_PLAN_DAYS;
}
