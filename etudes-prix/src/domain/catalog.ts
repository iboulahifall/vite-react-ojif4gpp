import type { DceDocDeclaration, DceDocType, Lot, RiskLevel, MarketType } from './types';

export interface Family {
  id: string;
  lot: Lot;
  label: string;
  description: string;
}

/** Familles de postes CFO / CFA (arborescence des postes). */
export const FAMILIES: Family[] = [
  { id: 'cfo-tgbt', lot: 'CFO', label: 'TGBT', description: 'Tableau général basse tension, arrivée, comptage' },
  { id: 'cfo-tableaux', lot: 'CFO', label: 'Tableaux divisionnaires', description: 'TD par niveau / zone, protections' },
  { id: 'cfo-distribution', lot: 'CFO', label: 'Distribution', description: 'Câbles, chemins de câbles, colonnes montantes' },
  { id: 'cfo-eclairage', lot: 'CFO', label: 'Éclairage', description: 'Luminaires, commandes, éclairage de sécurité' },
  { id: 'cfo-prises', lot: 'CFO', label: 'Prises de courant', description: 'PC, postes de travail, goulottes' },
  { id: 'cfo-force', lot: 'CFO', label: 'Force motrice', description: 'Alimentations CVC, ascenseurs, équipements' },
  { id: 'cfa-ssi', lot: 'CFA', label: 'SSI', description: 'Système de sécurité incendie, détection, alarme' },
  { id: 'cfa-vdi', lot: 'CFA', label: 'VDI', description: 'Précâblage voix-données-images, baies' },
  { id: 'cfa-acces', lot: 'CFA', label: 'Contrôle d’accès', description: 'Lecteurs, gâches, interphonie' },
  { id: 'cfa-video', lot: 'CFA', label: 'Vidéosurveillance', description: 'Caméras, enregistreurs, supervision' },
  { id: 'cfa-gtb', lot: 'CFA', label: 'GTB', description: 'Gestion technique du bâtiment, automates' },
];

export function familiesOfLots(lots: Lot[]): Family[] {
  return FAMILIES.filter((f) => lots.includes(f.lot));
}

export interface DceDocInfo {
  type: DceDocType;
  label: string;
  file: string;
  role: string;
  /** Pièce indispensable au chiffrage. */
  essential: boolean;
}

export const DCE_DOCS: DceDocInfo[] = [
  { type: 'RC', label: 'Règlement de consultation', file: 'RC.pdf', role: 'Date et modalités de remise, critères de jugement', essential: true },
  { type: 'CCAP', label: 'CCAP', file: 'CCAP.pdf', role: 'Clauses administratives : pénalités, délais, révision', essential: false },
  { type: 'CCTP', label: 'CCTP', file: 'CCTP.pdf', role: 'Description technique des prestations à chiffrer', essential: true },
  { type: 'DPGF', label: 'DPGF', file: 'DPGF.xlsx', role: 'Cadre de décomposition du prix à remplir', essential: true },
  { type: 'PLANS_CFO', label: 'Plans CFO', file: 'Plans CFO.pdf', role: 'Implantations courants forts, base du métré', essential: true },
  { type: 'PLANS_CFA', label: 'Plans CFA', file: 'Plans CFA.pdf', role: 'Implantations courants faibles, base du métré', essential: true },
];

export function dceDocInfo(type: DceDocType): DceDocInfo {
  return DCE_DOCS.find((d) => d.type === type)!;
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  critique: 'Critique',
  important: 'Important',
  surveiller: 'À surveiller',
  ok: 'Maîtrisé',
};

export const MARKET_LABELS: Record<MarketType, string> = {
  public: 'Marché public',
  prive: 'Marché privé',
};

/** Les plans d'un lot non chiffré sont sans objet. */
export function isDocRelevant(type: DceDocType, lots: Lot[]): boolean {
  if (type === 'PLANS_CFO') return lots.includes('CFO');
  if (type === 'PLANS_CFA') return lots.includes('CFA');
  return true;
}

export function missingDocs(docs: DceDocDeclaration[], lots: Lot[]): DceDocDeclaration[] {
  return docs.filter((d) => !d.received && isDocRelevant(d.type, lots));
}
