/** Résultat d'une analyse automatique du DCE (V1.3). */

export type FindingLevel = 'critique' | 'verifier';
export type FindingCategory = 'clause' | 'ecart' | 'quantite' | 'perimetre' | 'document';
export type FindingStatus = 'ouvert' | 'traite' | 'ecarte';

export interface SourceRef {
  docId: string;
  docName: string;
  /** Page (PDF) ou ligne (Excel) où l'élément a été trouvé. */
  page?: number;
  row?: number;
}

export interface DetectedPrestation {
  ruleId: string;
  familyId: string;
  label: string;
  /** Pages du CCTP où la prestation est décrite. */
  pages: number[];
  excerpt: string;
}

export interface DpgfLine {
  ref: string;
  designation: string;
  unit: string;
  qty: number | null;
  section: string;
  row: number;
  /** Prestation principale reconnue dans la désignation (détermine la famille). */
  ruleId: string | null;
  familyId: string | null;
  /** Toutes les prestations couvertes par la ligne (ex. « TGBT … comptages, parafoudre »). */
  ruleIds: string[];
}

export type ComparisonStatus = 'ok' | 'cctp-seul' | 'dpgf-seul';

export interface ComparisonItem {
  ruleId: string;
  familyId: string;
  label: string;
  status: ComparisonStatus;
  cctpPages: number[];
  dpgfRefs: string[];
}

export interface Finding {
  /** Identifiant stable d'une analyse à l'autre (les décisions y sont rattachées). */
  id: string;
  level: FindingLevel;
  category: FindingCategory;
  title: string;
  detail: string;
  excerpt?: string;
  source?: SourceRef;
  /** Question proposée au maître d'ouvrage. */
  question?: string;
}

export interface AnalysisResult {
  runAt: string;
  runBy: string;
  /** Empreinte du DCE analysé, pour détecter une analyse périmée. */
  dceSignature: string;
  cctp?: { docId: string; docName: string; pages: number };
  dpgf?: { docId: string; docName: string; lines: number };
  documentsRead: { docId: string; docName: string; pages: number }[];
  prestations: DetectedPrestation[];
  dpgfLines: DpgfLine[];
  comparison: ComparisonItem[];
  findings: Finding[];
}

export interface FindingDecision {
  status: FindingStatus;
  comment: string;
  by: string;
  at: string;
}
