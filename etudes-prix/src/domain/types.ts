/** Étapes du workflow d'une étude de prix, dans l'ordre. */
export type StudyStatus =
  | 'analyse'
  | 'metre'
  | 'consultation'
  | 'chiffrage'
  | 'revue'
  | 'validation'
  | 'remise';

export type RiskLevel = 'critique' | 'important' | 'surveiller' | 'ok';

export type Lot = 'CFO' | 'CFA';

export type MarketType = 'public' | 'prive';

export type DceDocType = 'RC' | 'CCAP' | 'CCTP' | 'DPGF' | 'PLANS_CFO' | 'PLANS_CFA';

export interface DceDocDeclaration {
  type: DceDocType;
  received: boolean;
}

export interface PlanTask {
  id: string;
  stage: StudyStatus;
  label: string;
  dueDate: string; // AAAA-MM-JJ
  done: boolean;
}

/**
 * Indicateurs saisis manuellement en V1.1.
 * Ils seront calculés automatiquement par les modules Risques (V1.7),
 * Questions (V1.7) et Consultations (V1.5).
 */
export interface StudyIndicators {
  criticalRisks: number;
  openQuestions: number;
  pendingPrices: number;
}

export interface HistoryEntry {
  id: string;
  date: string; // ISO
  user: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface Study {
  id: string;
  reference: string;
  name: string;
  client: string;
  location: string;
  marketType: MarketType;
  dueDate: string; // AAAA-MM-JJ
  dueTime: string; // HH:MM
  owner: string;
  estimatedAmount: number; // € HT
  status: StudyStatus;
  progress: number; // 0..100
  riskLevel: RiskLevel;
  lots: Lot[];
  families: string[];
  dceDocs: DceDocDeclaration[];
  plan: PlanTask[];
  indicators: StudyIndicators;
  notes: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
}

/** Données saisies dans l'assistant « Nouvelle étude ». */
export type StudyDraft = Omit<
  Study,
  'id' | 'status' | 'progress' | 'isDemo' | 'createdAt' | 'updatedAt' | 'history'
>;

export interface AppSettings {
  userName: string;
  companyName: string;
  guidedMode: boolean;
}
