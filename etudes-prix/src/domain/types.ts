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

/** Catégorie de classement d'un fichier du DCE. */
export type DceCategory = DceDocType | 'AUTRE';

export type FileKind = 'pdf' | 'excel' | 'word' | 'image' | 'text' | 'other';

/** Fichier importé dans le DCE d'une étude (le contenu binaire est stocké à part). */
export interface DceFile {
  id: string;
  name: string;
  size: number; // octets
  mime: string;
  kind: FileKind;
  category: DceCategory;
  uploadedAt: string; // ISO
  uploadedBy: string;
  /** Pages (PDF), feuilles (Excel) ou mots (Word), calculés après import. */
  pages?: number;
  sheets?: number;
  words?: number;
  note: string;
  isDemo?: boolean;
}

import type { AnalysisResult, FindingDecision } from './analysis/types';
import type { MetreLine } from './metre';
import type { Consultation } from './consultations';
import type { Chiffrage } from './chiffrage';
import type { Question, Risk } from './risks';
import type { ReviewJustification, ReviewRecord } from './review';
import type { ValidationRecord } from './validation';

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
  /** Élément concerné (ex. identifiant d'une ligne de métré), pour son historique propre. */
  target?: string;
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
  documents: DceFile[];
  /** Dernière analyse automatique du DCE (V1.3). */
  analysis?: AnalysisResult;
  /** Décisions du responsable sur les constats, conservées d'une analyse à l'autre. */
  analysisDecisions: Record<string, FindingDecision>;
  /** Métré : quantités par poste (V1.4). */
  metre: MetreLine[];
  /** Consultations fournisseurs et sous-traitants (V1.5). */
  consultations: Consultation[];
  /** Chiffrage : prix des lignes du métré et paramètres de vente (V1.6). */
  chiffrage: Chiffrage;
  /** Risques et questions au maître d'ouvrage (V1.7). */
  risks: Risk[];
  questions: Question[];
  /** Dernière revue de prix (V1.8) et justifications des points « à vérifier ». */
  review?: ReviewRecord;
  reviewJustifications: Record<string, ReviewJustification>;
  /** Validation finale (V1.9) : présente = étude verrouillée. */
  validation?: ValidationRecord;
  /** Nombre de validations prononcées (numéro de version de l'offre). */
  validationCount: number;
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
  'id' | 'status' | 'progress' | 'isDemo' | 'createdAt' | 'updatedAt' | 'history' | 'documents' | 'analysis' | 'analysisDecisions' | 'metre' | 'consultations' | 'chiffrage' | 'risks' | 'questions' | 'review' | 'reviewJustifications' | 'validation' | 'validationCount'
>;

export interface AppSettings {
  userName: string;
  companyName: string;
  /** Logo de l'entreprise (image en data URL), affiché sur les rapports. */
  logo?: string;
  guidedMode: boolean;
}
