import type { MetreLine } from './metre';
import { effectiveQty, round } from './metre';
import type { Consultation } from './consultations';
import type { PriceLine } from './chiffrage';
import { mainPrestation } from './analysis/prestationRules';
import { normalizeText } from './analysis/text';

/**
 * Base de prix INDICATIVE livrée avec l'application (fourniture € HT / unité, temps de pose h / unité).
 * Ordres de grandeur pour un premier chiffrage : chaque prix issu de la base est marqué « estimé »
 * et doit être confirmé par une offre ou remplacé par vos propres prix.
 */
export const BASE_PRICES: Record<string, { material: number; hours: number; byUnit?: Record<string, { material: number; hours: number }> }> = {
  raccordement: { material: 2500, hours: 16 },
  tgbt: { material: 18000, hours: 40 },
  comptage: { material: 350, hours: 2 },
  parafoudre: { material: 900, hours: 2 },
  'groupe-electrogene': { material: 22000, hours: 24 },
  td: { material: 1800, hours: 10 },
  colonne: { material: 45, hours: 0.35 },
  chemins: { material: 22, hours: 0.3 },
  terre: { material: 1500, hours: 12 },
  'coupe-feu': { material: 35, hours: 0.5 },
  luminaires: { material: 95, hours: 0.8 },
  'gestion-eclairage': { material: 55, hours: 0.5 },
  baes: { material: 70, hours: 0.6 },
  'mise-en-lumiere': { material: 6000, hours: 24 },
  'postes-travail': { material: 60, hours: 1.2 },
  nourrices: { material: 85, hours: 0.8 },
  onduleur: { material: 4500, hours: 6 },
  'alim-cvc': { material: 3500, hours: 30 },
  'alim-ascenseur': { material: 900, hours: 8 },
  irve: { material: 1200, hours: 6, byUnit: { place: { material: 150, hours: 1.5 } } },
  photovoltaique: { material: 1100, hours: 4 },
  ssi: { material: 9000, hours: 30 },
  'detection-incendie': { material: 65, hours: 0.6 },
  dm: { material: 45, hours: 0.5 },
  diffuseurs: { material: 85, hours: 0.6 },
  asservissements: { material: 3500, hours: 16 },
  vdi: { material: 18, hours: 0.45 },
  baies: { material: 2200, hours: 10 },
  fibre: { material: 12, hours: 0.2 },
  'controle-acces': { material: 450, hours: 3 },
  interphonie: { material: 1800, hours: 10 },
  video: { material: 14000, hours: 40 },
  gtb: { material: 25000, hours: 80 },
  'essais-doe': { material: 1500, hours: 24 },
  verification: { material: 2500, hours: 4 },
  formation: { material: 300, hours: 8 },
};

/** Prix de base pour une ligne du métré (null si la prestation n'est pas reconnue). */
export function baseLineFor(m: MetreLine): PriceLine | null {
  const rule = m.fromRule ?? mainPrestation(normalizeText(m.designation))?.id;
  const base = rule ? BASE_PRICES[rule] : undefined;
  if (!rule || !base) return null;
  const v = base.byUnit?.[m.unit.trim().toLowerCase()] ?? base;
  return {
    metreLineId: m.id,
    materialUnit: v.material,
    laborHoursUnit: v.hours,
    subcontractUnit: null,
    source: { kind: 'base', status: 'estime', note: 'Base de prix indicative de l’application — à confirmer ou remplacer.' },
    comment: '',
  };
}

export interface OfferImport {
  lines: PriceLine[];
  applied: number;
  /** Lignes non modifiées car leur prix a été confirmé par l'utilisateur (hors offre). */
  kept: string[];
}

/**
 * Reporte les offres retenues dans le chiffrage : prix unitaires par ligne, ou montant forfaitaire
 * affecté à la première ligne de la consultation (les autres lignes étant « incluses »).
 * Fourniture → prix matériel ; sous-traitance → prix de sous-traitance (pose comprise).
 */
export function importRetainedOffers(consultations: Consultation[], metre: MetreLine[], existing: PriceLine[]): OfferImport {
  const byLine = new Map(existing.map((l) => [l.metreLineId, l]));
  const kept: string[] = [];
  let applied = 0;
  for (const c of consultations) {
    const r = c.requests.find((x) => x.id === c.retainedRequestId);
    if (!r?.offer) continue;
    const priced = r.offer.lines.filter((l) => l.unitPrice !== null);
    const sub = c.kind === 'sous-traitant';
    const baseSource = {
      kind: 'offre' as const, status: 'confirme' as const, supplierId: r.supplierId, consultationId: c.id, requestId: r.id,
      reference: r.offer.reference, documentName: r.offer.files[0]?.name, note: r.offer.comment || undefined,
    };
    const set = (metreLineId: string, unit: number | null, note?: string) => {
      const prev = byLine.get(metreLineId);
      // Un prix confirmé par l'utilisateur (catalogue, estimation) n'est jamais écrasé, ni une ligne
      // déjà issue de cette même offre (si elle diffère, c'est qu'elle a été ajustée à la main) ;
      // un prix à confirmer, estimé ou issu d'une autre offre est remplacé par l'offre retenue.
      if (prev && ((prev.source.status === 'confirme' && prev.source.kind !== 'offre') || (prev.source.kind === 'offre' && prev.source.requestId === r.id))) {
        if (prev.source.kind !== 'offre') kept.push(metreLineId);
        return;
      }
      byLine.set(metreLineId, {
        metreLineId,
        materialUnit: sub ? null : unit,
        laborHoursUnit: sub ? null : prev?.laborHoursUnit ?? null,
        subcontractUnit: sub ? unit : null,
        source: { ...baseSource, note: note ?? baseSource.note },
        comment: prev?.comment ?? '',
      });
      applied++;
    };
    if (priced.length) {
      for (const l of priced) set(l.metreLineId, l.unitPrice);
    } else if (r.offer.amount !== null && c.metreLineIds.length) {
      const [first, ...others] = c.metreLineIds;
      const m = metre.find((x) => x.id === first);
      const q = m ? effectiveQty(m) : null;
      set(first, q ? round(r.offer.amount / q) : r.offer.amount, `Offre forfaitaire ${r.offer.reference || ''} (${r.offer.amount} € HT) affectée à cette ligne.`.replace('  ', ' '));
      for (const o of others) set(o, 0, `Inclus dans l’offre forfaitaire ${r.offer.reference || ''}.`.replace('  ', ' '));
    }
  }
  return { lines: [...byLine.values()], applied, kept };
}
