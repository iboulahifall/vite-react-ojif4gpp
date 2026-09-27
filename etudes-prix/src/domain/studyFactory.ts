import type { DceDocDeclaration, Lot, Study, StudyDraft } from './types';
import { DCE_DOCS, familiesOfLots } from './catalog';
import { addDays, toISODate } from './dates';
import { generatePlan } from './planning';

export function newId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Référence affaire : AO-AAAA-NNN, NNN = premier numéro libre de l'année. */
export function nextReference(existing: string[], today = new Date()): string {
  const year = today.getFullYear();
  const prefix = `AO-${year}-`;
  const nums = existing.filter((r) => r.startsWith(prefix)).map((r) => Number(r.slice(prefix.length)) || 0);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
}

export function defaultDceDocs(): DceDocDeclaration[] {
  return DCE_DOCS.map((d) => ({ type: d.type, received: false }));
}

export function emptyDraft(owner: string, reference: string, today = new Date()): StudyDraft {
  const due = toISODate(addDays(today, 21));
  const lots: Lot[] = ['CFO', 'CFA'];
  return {
    reference,
    name: '',
    client: '',
    location: '',
    marketType: 'public',
    dueDate: due,
    dueTime: '12:00',
    owner,
    estimatedAmount: 0,
    riskLevel: 'surveiller',
    lots,
    families: familiesOfLots(lots).map((f) => f.id),
    dceDocs: defaultDceDocs(),
    plan: generatePlan(due, today),
    indicators: { criticalRisks: 0, openQuestions: 0, pendingPrices: 0 },
    notes: '',
  };
}

export function createStudyFromDraft(draft: StudyDraft, user: string, now = new Date()): Study {
  const iso = now.toISOString();
  return {
    ...draft,
    families: draft.families.filter((id) => familiesOfLots(draft.lots).some((f) => f.id === id)),
    id: newId('etude'),
    documents: [],
    analysisDecisions: {},
    metre: [],
    status: 'analyse',
    progress: 5,
    isDemo: false,
    createdAt: iso,
    updatedAt: iso,
    history: [
      { id: newId('h'), date: iso, user, field: 'Création', oldValue: '—', newValue: 'Étude créée', reason: 'Nouvelle étude' },
    ],
  };
}

export type DraftErrors = Partial<Record<'name' | 'client' | 'reference' | 'dueDate' | 'estimatedAmount' | 'owner' | 'lots', string>>;

export function validateProjectStep(d: StudyDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.name.trim()) e.name = 'Indiquez le nom du projet.';
  if (!d.client.trim()) e.client = 'Indiquez le client ou maître d’ouvrage.';
  if (!d.reference.trim()) e.reference = 'La référence affaire est obligatoire.';
  if (!d.owner.trim()) e.owner = 'Indiquez le responsable de l’étude.';
  if (!d.dueDate) e.dueDate = 'Indiquez la date de remise.';
  if (!(d.estimatedAmount >= 0)) e.estimatedAmount = 'Le montant doit être positif.';
  if (d.lots.length === 0) e.lots = 'Sélectionnez au moins un lot.';
  return e;
}
