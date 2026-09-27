import type { Lot, RiskLevel, Study, StudyStatus } from '../domain/types';
import { familiesOfLots } from '../domain/catalog';
import { addDays, toISODate } from '../domain/dates';
import { generatePlan } from '../domain/planning';
import { demoDocuments } from './demoFiles';
import { buildDemoMetre } from './demoMetre';
import { buildDemoConsultations } from './demoConsultations';
import { buildDemoChiffrage } from './demoChiffrage';
import { emptyChiffrage } from '../domain/chiffrage';
import { defaultDceDocs } from '../domain/studyFactory';
import { STATUS_ORDER, progressForStatus, stageIndex } from '../domain/workflow';

interface DemoSeed {
  name: string;
  client: string;
  location: string;
  dueIn: number;
  amount: number;
  status: StudyStatus;
  progress: number;
  risk: RiskLevel;
  lots?: Lot[];
  critical?: number;
  questions?: number;
  pending?: number;
  missingDocs?: string[];
  market?: 'public' | 'prive';
  /** Génère un DCE fictif consultable (projet principal uniquement). */
  withFiles?: boolean;
}

/** Projet principal de démonstration, puis un portefeuille fictif réaliste. */
const SEEDS: DemoSeed[] = [
  { name: 'PROJET DÉMONSTRATION — IMMEUBLE TERTIAIRE', client: 'SCI Démo Bureaux (fictif)', location: 'Lyon 3e',
    dueIn: 5, amount: 420_000, status: 'chiffrage', progress: 68, risk: 'important', critical: 1, questions: 4, pending: 3, market: 'prive',
    missingDocs: ['PLANS_CFA'], withFiles: true },
  { name: 'Rénovation électrique — Immeuble Haussmann', client: 'Foncière Exemple (fictif)', location: 'Paris 8e',
    dueIn: 4, amount: 265_000, status: 'revue', progress: 82, risk: 'important', questions: 2 },
  { name: 'Groupe scolaire Jean-Démo', client: 'Ville de Démoville (fictif)', location: 'Démoville',
    dueIn: 6, amount: 310_000, status: 'consultation', progress: 54, risk: 'critique', critical: 2, questions: 5, pending: 6 },
  { name: 'EHPAD Les Tilleuls — extension', client: 'Association Démo Santé (fictif)', location: 'Villeurbanne',
    dueIn: 10, amount: 185_000, status: 'validation', progress: 93, risk: 'ok' },
  { name: 'Plateforme logistique — cellule 4', client: 'Logistique Démo SAS (fictif)', location: 'Saint-Priest',
    dueIn: 2, amount: 540_000, status: 'chiffrage', progress: 61, risk: 'important', pending: 4, market: 'prive' },
  { name: 'Résidence étudiante — 120 logements', client: 'Bailleur Démo Habitat (fictif)', location: 'Grenoble',
    dueIn: 18, amount: 390_000, status: 'metre', progress: 28, risk: 'surveiller', questions: 3 },
  { name: 'Centre aquatique intercommunal', client: 'Communauté Démo Agglo (fictif)', location: 'Annecy',
    dueIn: 25, amount: 620_000, status: 'analyse', progress: 10, risk: 'surveiller', missingDocs: ['PLANS_CFA', 'CCAP'], questions: 2 },
  { name: 'Siège social — aménagement plateaux', client: 'Démo Assurances (fictif)', location: 'Lyon Part-Dieu',
    dueIn: 14, amount: 155_000, status: 'consultation', progress: 42, risk: 'ok', pending: 2, market: 'prive' },
  { name: 'Clinique — bloc opératoire', client: 'Groupe Démo Médical (fictif)', location: 'Clermont-Ferrand',
    dueIn: 21, amount: 275_000, status: 'metre', progress: 24, risk: 'important', lots: ['CFO'], questions: 1 },
  { name: 'Gymnase — mise en conformité SSI', client: 'Département Démo (fictif)', location: 'Bourg-en-Bresse',
    dueIn: 9, amount: 62_000, status: 'revue', progress: 78, risk: 'ok', lots: ['CFA'] },
  { name: 'Médiathèque — réhabilitation', client: 'Ville de Démoville (fictif)', location: 'Démoville',
    dueIn: 32, amount: 145_000, status: 'analyse', progress: 6, risk: 'surveiller', missingDocs: ['DPGF'] },
  { name: 'Data center — extension salle 2', client: 'Démo Cloud Services (fictif)', location: 'Vénissieux',
    dueIn: -1, amount: 480_000, status: 'chiffrage', progress: 70, risk: 'critique', critical: 1, pending: 2, market: 'prive' },
  { name: 'Collège — remplacement éclairage LED', client: 'Département Démo (fictif)', location: 'Mâcon',
    dueIn: -12, amount: 98_000, status: 'remise', progress: 100, risk: 'ok', lots: ['CFO'] },
  { name: 'Bureaux — contrôle d’accès', client: 'Démo Immobilier (fictif)', location: 'Lyon 7e',
    dueIn: -20, amount: 44_000, status: 'remise', progress: 100, risk: 'ok', lots: ['CFA'], market: 'prive' },
];

export function buildDemoStudies(owner: string, today = new Date()): Study[] {
  const iso = today.toISOString();
  return SEEDS.map((seed, i) => {
    const lots = seed.lots ?? ['CFO', 'CFA'];
    const due = toISODate(addDays(today, seed.dueIn));
    // Plan établi à la création de l'étude (≈ 4 semaines avant la remise).
    const planStart = addDays(today, seed.dueIn - 28);
    const plan = generatePlan(due, planStart, `demo${i}`).map((t) => ({
      ...t,
      done: stageIndex(t.stage) < stageIndex(seed.status),
    }));
    const dceDocs = defaultDceDocs().map((d) => ({ ...d, received: !(seed.missingDocs ?? []).includes(d.type) }));
    const createdAt = planStart.toISOString();
    const study: Study = {
      id: `demo-${i + 1}`,
      reference: `AO-${today.getFullYear()}-${String(i + 1).padStart(3, '0')}`,
      name: seed.name,
      client: seed.client,
      location: seed.location,
      marketType: seed.market ?? 'public',
      dueDate: due,
      dueTime: '12:00',
      owner,
      estimatedAmount: seed.amount,
      status: seed.status,
      progress: progressForStatus(seed.status, seed.progress),
      riskLevel: seed.risk,
      lots,
      families: familiesOfLots(lots).map((f) => f.id),
      dceDocs,
      documents: seed.withFiles ? demoDocuments(`demo-${i + 1}`, owner, createdAt) : [],
      analysisDecisions: {},
      metre: seed.withFiles ? buildDemoMetre(`demo-${i + 1}`, owner, iso) : [],
      consultations: seed.withFiles ? buildDemoConsultations(`demo-${i + 1}`, owner, today) : [],
      chiffrage: emptyChiffrage(),
      plan,
      indicators: { criticalRisks: seed.critical ?? 0, openQuestions: seed.questions ?? 0, pendingPrices: seed.pending ?? 0 },
      notes: 'DONNÉES DE DÉMONSTRATION — projet fictif.',
      isDemo: true,
      createdAt,
      updatedAt: iso,
      history: [
        { id: `demo${i}-h1`, date: createdAt, user: owner, field: 'Création', oldValue: '—', newValue: 'Étude créée', reason: 'Données de démonstration' },
        ...(stageIndex(seed.status) > 0
          ? [{ id: `demo${i}-h2`, date: iso, user: owner, field: 'Étape',
              oldValue: STATUS_ORDER[stageIndex(seed.status) - 1], newValue: seed.status, reason: 'Données de démonstration' }]
          : []),
      ],
    };
    if (seed.withFiles) study.chiffrage = buildDemoChiffrage(study.metre, study.consultations);
    return study;
  });
}
