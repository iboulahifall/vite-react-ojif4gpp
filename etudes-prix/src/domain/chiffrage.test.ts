import { describe, expect, it } from 'vitest';
import { buildUp, DEFAULT_PARAMS, lineCost, lineSalePrice, marginForTarget, netFromCatalog, type Chiffrage, type PriceLine } from './chiffrage';
import { baseLineFor, importRetainedOffers } from './priceBase';
import type { MetreLine } from './metre';
import type { Consultation } from './consultations';

function m(id: string, qty: number | null, designation = 'Luminaires LED', unit = 'u'): MetreLine {
  return { id, familyId: 'cfo-eclairage', ref: id, designation, unit, section: '', dpgfQty: qty, calcQty: null, calcDetail: [], retainedQty: null, validated: true, source: 'dpgf', comment: '' };
}
function p(metreLineId: string, materialUnit: number | null, laborHoursUnit: number | null, subcontractUnit: number | null = null, status: PriceLine['source']['status'] = 'confirme'): PriceLine {
  return { metreLineId, materialUnit, laborHoursUnit, subcontractUnit, source: { kind: 'catalogue', status }, comment: '' };
}

describe('déboursé sec d’une ligne', () => {
  it('additionne matériel, main-d’œuvre et sous-traitance', () => {
    const c = lineCost(m('a', 100), p('a', 80, 0.5, 10), { ...DEFAULT_PARAMS, hourlyRate: 40 });
    expect(c).toMatchObject({ qty: 100, material: 8000, laborHours: 50, labor: 2000, subcontract: 1000, total: 11000, unitCost: 110, missing: false });
  });
  it('signale une ligne sans prix', () => {
    expect(lineCost(m('a', 10), undefined, DEFAULT_PARAMS)).toMatchObject({ total: 0, missing: true });
  });
});

describe('du déboursé sec au prix de vente', () => {
  const metre = [m('a', 100), m('b', 10), m('c', 5), { ...m('old', 99), removedFromDpgf: true }];
  const ch: Chiffrage = {
    params: { hourlyRate: 40, siteCostsPct: 5, overheadPct: 10, riskPct: 2, marginPct: 10 },
    lines: [p('a', 80, 0.5), p('b', null, null, 100, 'a-confirmer'), { ...p('c', 20, 0), source: { kind: 'base', status: 'estime' } }, p('old', 1000, 10)],
  };
  const b = buildUp(metre, ch);

  it('calcule chaque étape', () => {
    // DS = 8000 + 2000 + 1000 + 100 = 11 100
    expect(b).toMatchObject({ material: 8100, labor: 2000, laborHours: 50, subcontract: 1000, dryCost: 11100 });
    expect(b.siteCosts).toBe(555);
    expect(b.overhead).toBe(1165.5);
    expect(b.risk).toBe(222);
    expect(b.costPrice).toBe(13042.5);
    expect(b.salePrice).toBe(14491.67);
    expect(b.margin).toBeCloseTo(b.salePrice * 0.1, 1);
    expect(b.coefficient).toBe(1.306);
  });

  it('compte les prix à confirmer, estimés et manquants (hors lignes retirées)', () => {
    expect(b).toMatchObject({ lines: 3, missing: 0, toConfirm: 1, estimated: 1 });
    expect(buildUp([...metre, m('d', 3)], ch).missing).toBe(1);
  });

  it('répartit le prix de vente par ligne ; la somme des lignes redonne le prix de vente', () => {
    expect(lineSalePrice(lineCost(metre[0], ch.lines[0], ch.params), b)).toBe(13055.56); // 10 000 × 14 491,67 / 11 100
    const sum = metre.filter((x) => !x.removedFromDpgf).reduce((t, x) => t + (lineSalePrice(lineCost(x, ch.lines.find((l) => l.metreLineId === x.id), ch.params), b) ?? 0), 0);
    expect(Math.abs(sum - b.salePrice)).toBeLessThan(0.05);
  });

  it('calcule la marge nécessaire pour un prix de vente cible', () => {
    expect(marginForTarget(15000, 13042.5)).toBe(13.05);
    const at = buildUp(metre, { ...ch, params: { ...ch.params, marginPct: marginForTarget(15000, 13042.5) } });
    expect(Math.abs(at.salePrice - 15000)).toBeLessThan(2);
  });

  it('calcule un prix net depuis le catalogue', () => {
    expect(netFromCatalog(5200, 18)).toBe(4264);
  });
});

describe('base de prix et offres retenues', () => {
  it('propose un prix de base estimé selon la prestation et l’unité', () => {
    expect(baseLineFor(m('a', 10))).toMatchObject({ materialUnit: 95, laborHoursUnit: 0.8, source: { kind: 'base', status: 'estime' } });
    expect(baseLineFor(m('b', 12, 'Pré-équipement IRVE', 'place'))?.materialUnit).toBe(150);
    expect(baseLineFor(m('c', 1, 'Frais de nettoyage'))).toBeNull();
  });

  const offer = { receivedAt: '', reference: 'DEV-1', amount: null, lines: [] as { metreLineId: string; unitPrice: number | null }[], delay: '', validUntil: '', exclusions: '', comment: '', files: [] };
  const consult = (over: Partial<Consultation>): Consultation => ({ id: 'c', label: 'x', kind: 'fournisseur', familyIds: [], metreLineIds: ['a', 'b'], createdAt: '', dueDate: '', notes: '',
    retainedRequestId: 'r', requests: [{ id: 'r', supplierId: 's', status: 'recue', reminders: [], offer }], ...over });

  it('reporte les prix unitaires d’une offre de fourniture retenue', () => {
    const c = consult({ requests: [{ id: 'r', supplierId: 's', status: 'recue', reminders: [], offer: { ...offer, lines: [{ metreLineId: 'a', unitPrice: 79 }, { metreLineId: 'b', unitPrice: null }] } }] });
    const res = importRetainedOffers([c], [m('a', 10), m('b', 5)], [{ ...p('a', 95, 0.8), source: { kind: 'base', status: 'estime' } }]);
    expect(res.applied).toBe(1);
    expect(res.lines.find((l) => l.metreLineId === 'a')).toMatchObject({ materialUnit: 79, laborHoursUnit: 0.8, source: { kind: 'offre', status: 'confirme', reference: 'DEV-1' } });
  });

  it('affecte une offre forfaitaire de sous-traitance à la première ligne', () => {
    const c = consult({ kind: 'sous-traitant', requests: [{ id: 'r', supplierId: 's', status: 'recue', reminders: [], offer: { ...offer, amount: 5000 } }] });
    const res = importRetainedOffers([c], [m('a', 10), m('b', 5)], []);
    expect(res.lines.find((l) => l.metreLineId === 'a')).toMatchObject({ subcontractUnit: 500, materialUnit: null });
    expect(res.lines.find((l) => l.metreLineId === 'b')?.subcontractUnit).toBe(0);
    const total = buildUp([m('a', 10), m('b', 5)], { params: DEFAULT_PARAMS, lines: res.lines }).subcontract;
    expect(total).toBe(5000);
  });

  it('ne remplace pas un prix confirmé par l’utilisateur, mais remplace un prix à confirmer', () => {
    const c = consult({ requests: [{ id: 'r', supplierId: 's', status: 'recue', reminders: [], offer: { ...offer, lines: [{ metreLineId: 'a', unitPrice: 79 }] } }] });
    const res = importRetainedOffers([c], [m('a', 10)], [p('a', 70, 1)]);
    expect(res).toMatchObject({ applied: 0, kept: ['a'] });
    expect(importRetainedOffers([c], [m('a', 10)], [p('a', 70, 1, null, 'a-confirmer')]).applied).toBe(1);
    // Ligne déjà issue de cette offre puis ajustée à la main : conservée.
    const adjusted = { ...p('a', 75, 1), source: { kind: 'offre' as const, status: 'confirme' as const, requestId: 'r' } };
    expect(importRetainedOffers([c], [m('a', 10)], [adjusted])).toMatchObject({ applied: 0, kept: [] });
    // Ligne issue d'une autre offre (autre fournisseur retenu auparavant) : remplacée.
    expect(importRetainedOffers([c], [m('a', 10)], [{ ...adjusted, source: { ...adjusted.source, requestId: 'autre' } }]).applied).toBe(1);
    expect(importRetainedOffers([consult({ retainedRequestId: undefined })], [m('a', 10)], []).applied).toBe(0);
  });
});
