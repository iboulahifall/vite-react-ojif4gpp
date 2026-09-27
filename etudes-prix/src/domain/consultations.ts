import type { MetreLine } from './metre';
import { effectiveQty, round } from './metre';
import { daysUntil } from './dates';

export type SupplierKind = 'fournisseur' | 'sous-traitant';

/** Fiche de l'annuaire (commune à toutes les études). */
export interface Supplier {
  id: string;
  name: string;
  kind: SupplierKind;
  contactName: string;
  email: string;
  phone: string;
  /** Familles de postes pour lesquelles il est habituellement consulté. */
  familyIds: string[];
  notes: string;
  isDemo?: boolean;
}

export interface OfferFile { id: string; name: string; size: number; kind: 'pdf' | 'excel' | 'word' | 'image' | 'text' | 'other' }

export interface OfferLine { metreLineId: string; unitPrice: number | null }

export interface Offer {
  receivedAt: string; // AAAA-MM-JJ
  reference: string;
  /** Montant HT saisi (utilisé si aucun prix unitaire n'est renseigné). */
  amount: number | null;
  /** Prix unitaires par ligne de métré consultée. */
  lines: OfferLine[];
  delay: string;
  validUntil: string; // AAAA-MM-JJ ou ''
  exclusions: string;
  comment: string;
  files: OfferFile[];
}

export type RequestStatus = 'a-envoyer' | 'envoyee' | 'relancee' | 'recue' | 'declinee';

export interface Reminder { at: string; by: string; note: string }

/** Demande de prix adressée à un fournisseur dans une consultation. */
export interface SupplierRequest {
  id: string;
  supplierId: string;
  status: RequestStatus;
  sentAt?: string; // AAAA-MM-JJ
  reminders: Reminder[];
  offer?: Offer;
  declineReason?: string;
}

export interface Consultation {
  id: string;
  label: string;
  kind: SupplierKind;
  familyIds: string[];
  /** Lignes de métré consultées (quantités communes à toutes les offres). */
  metreLineIds: string[];
  createdAt: string;
  /** Date de réponse attendue. */
  dueDate: string;
  requests: SupplierRequest[];
  retainedRequestId?: string;
  notes: string;
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  'a-envoyer': 'À envoyer',
  envoyee: 'En attente',
  relancee: 'Relancée',
  recue: 'Offre reçue',
  declinee: 'Décliné',
};

export function isWaiting(r: SupplierRequest): boolean {
  return r.status === 'envoyee' || r.status === 'relancee';
}

/** Délai laissé au fournisseur après une relance avant de le signaler à nouveau. */
export const REMINDER_GRACE_DAYS = 2;

/** Demande sans réponse après la date attendue (et pas relancée ces derniers jours). */
export function isLate(r: SupplierRequest, c: Consultation, today = new Date()): boolean {
  if (!isWaiting(r) || daysUntil(c.dueDate, today) >= 0) return false;
  const since = daysSinceLastContact(r, today);
  return since === null || since > REMINDER_GRACE_DAYS;
}

export function daysSinceLastContact(r: SupplierRequest, today = new Date()): number | null {
  const last = r.reminders.length ? r.reminders[r.reminders.length - 1].at.slice(0, 10) : r.sentAt;
  return last ? -daysUntil(last, today) : null;
}

export function offerLineTotal(line: OfferLine, metre: MetreLine[]): number | null {
  const m = metre.find((x) => x.id === line.metreLineId);
  const q = m ? effectiveQty(m) : null;
  return line.unitPrice === null || q === null ? null : round(line.unitPrice * q);
}

/**
 * Montant HT d'une offre : somme des prix unitaires × quantités retenues du métré
 * quand ils sont renseignés, sinon montant global saisi.
 */
export function offerTotal(offer: Offer, metre: MetreLine[]): number | null {
  const priced = offer.lines.map((l) => offerLineTotal(l, metre)).filter((v): v is number => v !== null);
  if (priced.length) return round(priced.reduce((a, b) => a + b, 0));
  return offer.amount;
}

/** Lignes de la consultation sans prix unitaire dans l'offre (offre incomplète). */
export function missingLinePrices(offer: Offer, c: Consultation): string[] {
  if (!offer.lines.some((l) => l.unitPrice !== null)) return [];
  return c.metreLineIds.filter((id) => (offer.lines.find((l) => l.metreLineId === id)?.unitPrice ?? null) === null);
}

export function isExpired(offer: Offer, today = new Date()): boolean {
  return !!offer.validUntil && daysUntil(offer.validUntil, today) < 0;
}

export interface OfferComparison {
  requestId: string;
  supplierId: string;
  total: number | null;
  rank: number | null;
  /** Écart relatif avec la meilleure offre (0 = moins-disante). */
  gapToBest: number | null;
  expired: boolean;
  incomplete: boolean;
}

/** Classement des offres reçues d'une consultation (moins-disante en premier). */
export function compareOffers(c: Consultation, metre: MetreLine[], today = new Date()): OfferComparison[] {
  const rows = c.requests
    .filter((r) => r.status === 'recue' && r.offer)
    .map((r) => ({
      requestId: r.id,
      supplierId: r.supplierId,
      total: offerTotal(r.offer!, metre),
      expired: isExpired(r.offer!, today),
      incomplete: missingLinePrices(r.offer!, c).length > 0,
    }));
  const priced = rows.filter((r) => r.total !== null).sort((a, b) => a.total! - b.total!);
  const best = priced[0]?.total ?? null;
  return rows
    .map((r) => ({
      ...r,
      rank: r.total === null ? null : priced.findIndex((p) => p.requestId === r.requestId) + 1,
      gapToBest: r.total === null || !best ? null : (r.total - best) / best,
    }))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
}

export interface ConsultationSummary {
  consultations: number;
  requests: number;
  received: number;
  waiting: number;
  late: number;
  toSend: number;
  retained: number;
}

export function consultationSummary(list: Consultation[], today = new Date()): ConsultationSummary {
  const reqs = list.flatMap((c) => c.requests.map((r) => ({ r, c })));
  return {
    consultations: list.length,
    requests: reqs.length,
    received: reqs.filter(({ r }) => r.status === 'recue').length,
    waiting: reqs.filter(({ r }) => isWaiting(r)).length,
    late: reqs.filter(({ r, c }) => isLate(r, c, today)).length,
    toSend: reqs.filter(({ r }) => r.status === 'a-envoyer').length,
    retained: list.filter((c) => c.retainedRequestId).length,
  };
}

/** État d'une consultation, pour les cartes : ce qu'il reste à faire. */
export function consultationState(c: Consultation, today = new Date()): { label: string; tone: 'danger' | 'warning' | 'info' | 'success' } {
  if (c.retainedRequestId) return { label: 'Offre retenue', tone: 'success' };
  if (c.requests.length === 0) return { label: 'Aucun fournisseur', tone: 'warning' };
  if (c.requests.some((r) => isLate(r, c, today))) return { label: 'Relance nécessaire', tone: 'danger' };
  if (c.requests.some((r) => r.status === 'a-envoyer')) return { label: 'Demandes à envoyer', tone: 'warning' };
  const received = c.requests.filter((r) => r.status === 'recue').length;
  if (received >= 2 || (received >= 1 && !c.requests.some(isWaiting))) return { label: 'À comparer', tone: 'info' };
  return { label: 'En attente de réponses', tone: 'info' };
}

/** Familles du périmètre sans aucune consultation. */
export function uncoveredFamilies(scope: string[], list: Consultation[]): string[] {
  return scope.filter((f) => !list.some((c) => c.familyIds.includes(f)));
}

/** Lien de messagerie prérempli (demande de prix ou relance). */
export function mailtoLink(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
