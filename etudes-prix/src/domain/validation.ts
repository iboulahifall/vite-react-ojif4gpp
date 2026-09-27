import type { Study } from './types';
import { buildUp } from './chiffrage';
import { amountOf, criticalRisksOf, openQuestionsOf, pendingPricesOf } from './kpi';
import { isReviewStale, scoreOf } from './review';

/**
 * Validation finale de l'étude (V1.9) : récapitulatif, validation humaine par cases à cocher,
 * puis verrouillage. Une étude validée n'est plus modifiable tant qu'elle n'est pas déverrouillée.
 */

export interface ValidationItem {
  id: string;
  label: string;
}

/** Points que le responsable certifie avoir vérifiés avant de valider. */
export const VALIDATION_ITEMS: ValidationItem[] = [
  { id: 'recap', label: 'J’ai relu le récapitulatif financier : déboursé, prix de revient, prix de vente et marge.' },
  { id: 'quantites', label: 'Les quantités retenues ont été contrôlées (métré, écarts avec la DPGF).' },
  { id: 'prix', label: 'Les prix fournisseurs retenus sont confirmés et valables à la date de remise.' },
  { id: 'risques', label: 'Les risques critiques sont maîtrisés, provisionnés ou portés en réserve.' },
  { id: 'reserves', label: 'Les questions sans réponse, hypothèses et exclusions sont reprises dans l’offre.' },
  { id: 'direction', label: 'Le prix de vente a été validé par la direction.' },
];

/** Chiffres de l'étude figés au moment de la validation. */
export interface ValidationSnapshot {
  dryCost: number;
  costPrice: number;
  salePrice: number;
  margin: number;
  marginPct: number;
  /** Montant affiché sans chiffrage détaillé (montant estimé). */
  amount: number;
  criticalRisks: number;
  openQuestions: number;
  pendingPrices: number;
  missingPrices: number;
  reviewScore: number | null;
  reviewBlocking: number;
  reviewToCheck: number;
}

export interface ValidationRecord {
  /** Version de l'offre validée (V1, V2… après déverrouillage et nouvelle validation). */
  version: number;
  validatedAt: string;
  validatedBy: string;
  /** Nom de la personne de la direction ayant validé le prix. */
  approver: string;
  comment: string;
  checklist: string[];
  /** Validation prononcée malgré des contrôles bloquants (motif obligatoire). */
  withReserves: boolean;
  snapshot: ValidationSnapshot;
}

export function snapshotOf(s: Study): ValidationSnapshot {
  const b = s.chiffrage.lines.length ? buildUp(s.metre, s.chiffrage) : null;
  const sc = s.review ? scoreOf(s.review.checks, s.reviewJustifications ?? {}) : null;
  return {
    dryCost: b?.dryCost ?? 0,
    costPrice: b?.costPrice ?? 0,
    salePrice: b?.salePrice ?? 0,
    margin: b?.margin ?? 0,
    marginPct: s.chiffrage.params.marginPct,
    amount: amountOf(s),
    criticalRisks: criticalRisksOf(s),
    openQuestions: openQuestionsOf(s),
    pendingPrices: pendingPricesOf(s),
    missingPrices: b?.missing ?? 0,
    reviewScore: sc?.score ?? null,
    reviewBlocking: sc?.blocking ?? 0,
    reviewToCheck: sc?.toCheck ?? 0,
  };
}

/** Une étude validée ou remise est en lecture seule. */
export function isLocked(s: Pick<Study, 'status' | 'validation'>): boolean {
  return s.status === 'remise' || !!s.validation;
}

export interface ValidationReadiness {
  /** La revue existe et est à jour. */
  reviewOk: boolean;
  reason: string | null;
  blocking: number;
}

/** Conditions pour valider : une revue à jour ; les contrôles bloquants imposent une validation avec réserves. */
export function validationReadiness(s: Study): ValidationReadiness {
  if (s.status === 'remise') return { reviewOk: false, reason: 'L’offre est déjà remise.', blocking: 0 };
  if (!s.review) return { reviewOk: false, reason: 'Lancez d’abord la revue de prix.', blocking: 0 };
  if (isReviewStale(s)) return { reviewOk: false, reason: 'L’étude a changé depuis la dernière revue : relancez-la.', blocking: 0 };
  const sc = scoreOf(s.review.checks, s.reviewJustifications ?? {});
  return { reviewOk: true, reason: null, blocking: sc.blocking };
}

export function versionLabel(s: Pick<Study, 'validation' | 'validationCount'>): string {
  return `V${s.validation?.version ?? (s.validationCount ?? 0) + 1}`;
}
