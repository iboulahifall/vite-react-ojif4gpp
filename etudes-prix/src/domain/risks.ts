import type { Reminder } from './consultations';
import { daysUntil } from './dates';

/** Lien vers l'origine d'un risque ou d'une question (document, page, constat d'analyse). */
export interface FollowUpSource {
  label: string;
  docId?: string;
  page?: number;
  /** Constat de l'analyse du DCE à l'origine de l'élément. */
  findingId?: string;
}

export type RiskLevel3 = 'critique' | 'important' | 'surveiller';
export type RiskCategory = 'technique' | 'financier' | 'planning' | 'contractuel';
export type RiskStatus = 'ouvert' | 'en-cours' | 'maitrise' | 'clos';

export interface Risk {
  id: string;
  number: number;
  title: string;
  description: string;
  level: RiskLevel3;
  category: RiskCategory;
  source: FollowUpSource;
  impact: string;
  /** Montant potentiel (€ HT) si le risque se réalise. */
  amount: number | null;
  owner: string;
  action: string;
  status: RiskStatus;
  createdAt: string;
}

export type QuestionStatus = 'a-envoyer' | 'en-attente' | 'relancee' | 'repondue' | 'sans-objet';

export interface Question {
  id: string;
  number: number;
  subject: string;
  source: FollowUpSource;
  text: string;
  impact: string;
  /** Question dont la réponse conditionne le prix (bloquante). */
  blocking: boolean;
  status: QuestionStatus;
  sentAt?: string; // AAAA-MM-JJ
  dueDate?: string; // réponse attendue
  reminders: Reminder[];
  answer?: { text: string; date: string; by: string };
  createdAt: string;
}

export const RISK_LEVEL_LABELS: Record<RiskLevel3, string> = { critique: 'Critique', important: 'Important', surveiller: 'À surveiller' };
export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = { technique: 'Technique', financier: 'Financier', planning: 'Planning', contractuel: 'Contractuel' };
export const RISK_STATUS_LABELS: Record<RiskStatus, string> = { ouvert: 'Ouvert', 'en-cours': 'Action en cours', maitrise: 'Maîtrisé', clos: 'Clos' };
export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  'a-envoyer': 'À envoyer', 'en-attente': 'En attente', relancee: 'Relancée', repondue: 'Répondue', 'sans-objet': 'Sans objet',
};

export function riskCode(r: Pick<Risk, 'number'>): string {
  return `R-${String(r.number).padStart(3, '0')}`;
}
export function questionCode(q: Pick<Question, 'number'>): string {
  return `Q-${String(q.number).padStart(3, '0')}`;
}

export function nextNumber(items: { number: number }[]): number {
  return items.reduce((m, x) => Math.max(m, x.number), 0) + 1;
}

/** Un risque est actif tant qu'il n'est ni maîtrisé ni clos. */
export function isRiskActive(r: Risk): boolean {
  return r.status === 'ouvert' || r.status === 'en-cours';
}

export function isQuestionOpen(q: Question): boolean {
  return q.status === 'a-envoyer' || q.status === 'en-attente' || q.status === 'relancee';
}

/** Question envoyée restée sans réponse après la date attendue. */
export function isQuestionLate(q: Question, today = new Date()): boolean {
  if (q.status !== 'en-attente' && q.status !== 'relancee') return false;
  if (!q.dueDate || daysUntil(q.dueDate, today) >= 0) return false;
  const last = q.reminders.length ? q.reminders[q.reminders.length - 1].at.slice(0, 10) : q.sentAt;
  return !last || -daysUntil(last, today) > 2;
}

export interface RiskSummary {
  critical: number;
  important: number;
  watch: number;
  /** Somme des montants potentiels des risques actifs. */
  exposure: number;
  /** Risques actifs critiques sans action définie. */
  withoutAction: number;
  closed: number;
}

export function riskSummary(risks: Risk[]): RiskSummary {
  const active = risks.filter(isRiskActive);
  return {
    critical: active.filter((r) => r.level === 'critique').length,
    important: active.filter((r) => r.level === 'important').length,
    watch: active.filter((r) => r.level === 'surveiller').length,
    exposure: active.reduce((t, r) => t + (r.amount ?? 0), 0),
    withoutAction: active.filter((r) => r.level === 'critique' && !r.action.trim()).length,
    closed: risks.length - active.length,
  };
}

export interface QuestionSummary {
  open: number;
  toSend: number;
  waiting: number;
  late: number;
  blocking: number;
  answered: number;
}

export function questionSummary(questions: Question[], today = new Date()): QuestionSummary {
  const open = questions.filter(isQuestionOpen);
  return {
    open: open.length,
    toSend: open.filter((q) => q.status === 'a-envoyer').length,
    waiting: open.filter((q) => q.status !== 'a-envoyer').length,
    late: open.filter((q) => isQuestionLate(q, today)).length,
    blocking: open.filter((q) => q.blocking).length,
    answered: questions.filter((q) => q.status === 'repondue').length,
  };
}

/** Texte du courriel au maître d'ouvrage regroupant les questions ouvertes. */
export function questionsLetter(questions: Question[], studyName: string, reference: string, user: string): { subject: string; body: string } {
  const open = questions.filter(isQuestionOpen);
  const body = [
    'Bonjour,',
    '',
    `Dans le cadre de l’appel d’offres « ${studyName} » (réf. ${reference}), nous vous remercions de bien vouloir répondre aux questions suivantes :`,
    '',
    ...open.map((q) => `${questionCode(q)} — ${q.subject}${q.source.label ? ` (${q.source.label})` : ''}\n${q.text}\n`),
    'Cordialement,',
    user,
  ].join('\n');
  return { subject: `Questions — ${studyName} — ${reference}`, body };
}
