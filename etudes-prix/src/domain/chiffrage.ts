import type { MetreLine } from './metre';
import { effectiveQty, round } from './metre';

/** Paramètres de calcul du prix (propres à chaque étude). */
export interface PricingParams {
  /** Taux horaire de main-d'œuvre en déboursé (€ HT / h, charges comprises). */
  hourlyRate: number;
  /** Frais de chantier, en % du déboursé sec. */
  siteCostsPct: number;
  /** Frais généraux, en % du déboursé sec + frais de chantier. */
  overheadPct: number;
  /** Aléas et risques, en % du déboursé sec. */
  riskPct: number;
  /** Marge, en % du prix de vente. */
  marginPct: number;
}

export const DEFAULT_PARAMS: PricingParams = { hourlyRate: 42, siteCostsPct: 5, overheadPct: 12, riskPct: 2, marginPct: 8 };

export type SourceKind = 'offre' | 'catalogue' | 'base' | 'estimation';
export type SourceStatus = 'confirme' | 'a-confirmer' | 'estime';

/** Origine d'un prix : « aucun prix important ne doit être inexplicable ». */
export interface PriceSource {
  kind: SourceKind;
  status: SourceStatus;
  supplierId?: string;
  consultationId?: string;
  requestId?: string;
  reference?: string;
  /** Prix catalogue et remise, quand le prix retenu en découle. */
  catalogPrice?: number | null;
  discountPct?: number | null;
  documentName?: string;
  note?: string;
}

/** Prix d'une ligne du métré (les quantités viennent du métré). */
export interface PriceLine {
  metreLineId: string;
  /** Prix unitaire de fourniture (€ HT / unité). */
  materialUnit: number | null;
  /** Temps unitaire de pose (heures / unité). */
  laborHoursUnit: number | null;
  /** Prix unitaire de sous-traitance (€ HT / unité). */
  subcontractUnit: number | null;
  source: PriceSource;
  comment: string;
}

export interface Chiffrage {
  params: PricingParams;
  lines: PriceLine[];
}

export function emptyChiffrage(): Chiffrage {
  return { params: { ...DEFAULT_PARAMS }, lines: [] };
}

export interface LineCost {
  qty: number | null;
  material: number;
  laborHours: number;
  labor: number;
  subcontract: number;
  /** Déboursé sec de la ligne. */
  total: number;
  /** Déboursé sec unitaire. */
  unitCost: number | null;
  /** Aucun prix renseigné. */
  missing: boolean;
}

export function isPriced(p: PriceLine | undefined): boolean {
  return !!p && (p.materialUnit !== null || p.laborHoursUnit !== null || p.subcontractUnit !== null);
}

export function lineCost(m: MetreLine, p: PriceLine | undefined, params: PricingParams): LineCost {
  const qty = effectiveQty(m);
  const q = qty ?? 0;
  const material = round(q * (p?.materialUnit ?? 0));
  const laborHours = round(q * (p?.laborHoursUnit ?? 0));
  const labor = round(laborHours * params.hourlyRate);
  const subcontract = round(q * (p?.subcontractUnit ?? 0));
  const total = round(material + labor + subcontract);
  return { qty, material, laborHours, labor, subcontract, total, unitCost: qty ? round(total / qty) : null, missing: !isPriced(p) };
}

export interface PriceBuildUp {
  material: number;
  labor: number;
  laborHours: number;
  subcontract: number;
  /** Déboursé sec. */
  dryCost: number;
  siteCosts: number;
  overhead: number;
  risk: number;
  /** Prix de revient. */
  costPrice: number;
  margin: number;
  /** Prix de vente HT. */
  salePrice: number;
  /** Coefficient de vente = prix de vente / déboursé sec (arrondi, pour l'affichage). */
  coefficient: number | null;
  /** Rapport exact prix de vente / déboursé sec (répartition du prix de vente par ligne). */
  ratio: number | null;
  lines: number;
  missing: number;
  toConfirm: number;
  estimated: number;
}

/**
 * Du déboursé sec au prix de vente :
 * DS → + frais de chantier (% DS) → + frais généraux (% DS+FC) → + aléas (% DS) = PR → PV = PR / (1 − marge).
 */
export function buildUp(metre: MetreLine[], ch: Chiffrage): PriceBuildUp {
  const active = metre.filter((m) => !m.removedFromDpgf);
  const costs = active.map((m) => ({ m, p: ch.lines.find((l) => l.metreLineId === m.id), c: lineCost(m, ch.lines.find((l) => l.metreLineId === m.id), ch.params) }));
  const sum = (f: (c: LineCost) => number) => round(costs.reduce((t, x) => t + f(x.c), 0));
  const dryCost = sum((c) => c.total);
  const siteCosts = round(dryCost * ch.params.siteCostsPct / 100);
  const overhead = round((dryCost + siteCosts) * ch.params.overheadPct / 100);
  const risk = round(dryCost * ch.params.riskPct / 100);
  const costPrice = round(dryCost + siteCosts + overhead + risk);
  const salePrice = ch.params.marginPct >= 100 ? costPrice : round(costPrice / (1 - ch.params.marginPct / 100));
  return {
    material: sum((c) => c.material),
    labor: sum((c) => c.labor),
    laborHours: sum((c) => c.laborHours),
    subcontract: sum((c) => c.subcontract),
    dryCost, siteCosts, overhead, risk, costPrice,
    margin: round(salePrice - costPrice),
    salePrice,
    coefficient: dryCost ? Math.round((salePrice / dryCost) * 1000) / 1000 : null,
    ratio: dryCost ? salePrice / dryCost : null,
    lines: costs.length,
    missing: costs.filter((x) => x.c.missing).length,
    toConfirm: costs.filter((x) => !x.c.missing && x.p?.source.status === 'a-confirmer').length,
    estimated: costs.filter((x) => !x.c.missing && x.p?.source.status === 'estime').length,
  };
}

/**
 * Prix de vente d'une ligne (déboursé × rapport exact PV / DS) : sert à remplir la DPGF.
 * La somme des lignes redonne le prix de vente (aux arrondis au centime près).
 */
export function lineSalePrice(cost: LineCost, b: PriceBuildUp): number | null {
  return b.ratio === null ? null : round(cost.total * b.ratio);
}

/** Marge (% du prix de vente) nécessaire pour atteindre un prix de vente cible. */
export function marginForTarget(target: number, costPrice: number): number {
  if (target <= 0) return 0;
  return Math.round((1 - costPrice / target) * 10000) / 100;
}

/** Prix net à partir d'un prix catalogue et d'une remise. */
export function netFromCatalog(catalog: number, discountPct: number): number {
  return round(catalog * (1 - discountPct / 100));
}

export const SOURCE_LABELS: Record<SourceKind, string> = {
  offre: 'Offre fournisseur',
  catalogue: 'Catalogue / tarif',
  base: 'Base de prix',
  estimation: 'Estimation',
};

export const STATUS_LABELS: Record<SourceStatus, string> = {
  confirme: 'Confirmé',
  'a-confirmer': 'À confirmer',
  estime: 'Estimé',
};
