import { describe, expect, it } from 'vitest';
import {
  compareOffers, consultationState, consultationSummary, daysSinceLastContact, isLate, mailtoLink, missingLinePrices, offerTotal,
  uncoveredFamilies, type Consultation, type Offer, type SupplierRequest,
} from './consultations';
import type { MetreLine } from './metre';

const TODAY = new Date(2026, 8, 28, 12);

function metre(id: string, qty: number): MetreLine {
  return { id, familyId: 'cfo-eclairage', ref: id, designation: id, unit: 'u', section: '', dpgfQty: qty, calcQty: null, calcDetail: [],
    retainedQty: null, validated: false, source: 'dpgf', comment: '' };
}
const M = [metre('lum', 100), metre('baes', 40)];

function offer(over: Partial<Offer> = {}): Offer {
  return { receivedAt: '2026-09-25', reference: '', amount: null, lines: [], delay: '4 sem.', validUntil: '2026-12-31', exclusions: '', comment: '', files: [], ...over };
}
function req(id: string, over: Partial<SupplierRequest> = {}): SupplierRequest {
  return { id, supplierId: `s-${id}`, status: 'envoyee', sentAt: '2026-09-20', reminders: [], ...over };
}
function consult(requests: SupplierRequest[], over: Partial<Consultation> = {}): Consultation {
  return { id: 'c', label: 'Éclairage', kind: 'fournisseur', familyIds: ['cfo-eclairage'], metreLineIds: ['lum', 'baes'], createdAt: '', dueDate: '2026-09-30', requests, notes: '', ...over };
}

describe('offres', () => {
  it('calcule le montant à partir des prix unitaires et des quantités retenues', () => {
    expect(offerTotal(offer({ lines: [{ metreLineId: 'lum', unitPrice: 85.5 }, { metreLineId: 'baes', unitPrice: 42 }] }), M)).toBe(10230);
    expect(offerTotal(offer({ amount: 9800 }), M)).toBe(9800);
    expect(offerTotal(offer(), M)).toBeNull();
  });

  it('signale une offre incomplète', () => {
    const c = consult([]);
    expect(missingLinePrices(offer({ lines: [{ metreLineId: 'lum', unitPrice: 80 }] }), c)).toEqual(['baes']);
    expect(missingLinePrices(offer({ amount: 5000 }), c)).toEqual([]);
  });

  it('classe les offres et calcule l’écart avec la moins-disante', () => {
    const c = consult([
      req('a', { status: 'recue', offer: offer({ amount: 12000 }) }),
      req('b', { status: 'recue', offer: offer({ amount: 10000, validUntil: '2026-09-01' }) }),
      req('c', { status: 'recue', offer: offer({ lines: [{ metreLineId: 'lum', unitPrice: 100 }, { metreLineId: 'baes', unitPrice: 25 }] }) }),
      req('d'),
    ]);
    const cmp = compareOffers(c, M, TODAY);
    expect(cmp.map((x) => [x.requestId, x.rank])).toEqual([['b', 1], ['c', 2], ['a', 3]]);
    expect(cmp[0]).toMatchObject({ gapToBest: 0, expired: true });
    expect(cmp[1].gapToBest).toBeCloseTo(0.1);
    expect(cmp[2].gapToBest).toBeCloseTo(0.2);
  });
});

describe('suivi des demandes', () => {
  it('détecte les réponses en retard et le délai depuis le dernier contact', () => {
    const c = consult([req('a')], { dueDate: '2026-09-25' });
    expect(isLate(c.requests[0], c, TODAY)).toBe(true);
    expect(isLate({ ...c.requests[0], status: 'recue' }, c, TODAY)).toBe(false);
    // Relancé hier : laissé en attente pendant le délai de grâce.
    expect(isLate({ ...c.requests[0], status: 'relancee', reminders: [{ at: '2026-09-27T09:00:00Z', by: 'T', note: '' }] }, c, TODAY)).toBe(false);
    expect(isLate({ ...c.requests[0], status: 'relancee', reminders: [{ at: '2026-09-24T09:00:00Z', by: 'T', note: '' }] }, c, TODAY)).toBe(true);
    expect(daysSinceLastContact(c.requests[0], TODAY)).toBe(8);
    expect(daysSinceLastContact({ ...c.requests[0], reminders: [{ at: '2026-09-26T10:00:00Z', by: 'T', note: '' }] }, TODAY)).toBe(2);
  });

  it('résume l’état d’une consultation', () => {
    expect(consultationState(consult([]), TODAY).label).toBe('Aucun fournisseur');
    expect(consultationState(consult([req('a')], { dueDate: '2026-09-01' }), TODAY).label).toBe('Relance nécessaire');
    expect(consultationState(consult([req('a', { status: 'a-envoyer' })]), TODAY).label).toBe('Demandes à envoyer');
    expect(consultationState(consult([req('a'), req('b', { status: 'recue', offer: offer({ amount: 1 }) })]), TODAY).label).toBe('En attente de réponses');
    expect(consultationState(consult([req('a', { status: 'recue', offer: offer({ amount: 1 }) }), req('b', { status: 'declinee' })]), TODAY).label).toBe('À comparer');
    expect(consultationState(consult([req('a')], { retainedRequestId: 'a' }), TODAY).label).toBe('Offre retenue');
  });

  it('compte les demandes et les familles non consultées', () => {
    const list = [consult([req('a'), req('b', { status: 'recue', offer: offer() }), req('c', { status: 'a-envoyer' })], { dueDate: '2026-09-01' })];
    expect(consultationSummary(list, TODAY)).toEqual({ consultations: 1, requests: 3, received: 1, waiting: 1, late: 1, toSend: 1, retained: 0 });
    expect(uncoveredFamilies(['cfo-eclairage', 'cfa-ssi'], list)).toEqual(['cfa-ssi']);
  });

  it('prépare un courriel de relance', () => {
    expect(mailtoLink('a@b.fr', 'Relance — Éclairage', 'Bonjour,\nMerci')).toBe('mailto:a%40b.fr?subject=Relance%20%E2%80%94%20%C3%89clairage&body=Bonjour%2C%0AMerci');
  });
});
