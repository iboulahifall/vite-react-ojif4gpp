import { describe, expect, it } from 'vitest';
import { generatePlan, isPlanTight } from './planning';
import { computeAlerts, computeKpis, countByStatus, sortByPriority } from './kpi';
import { nextAction, nextStatus, previousStatus, progressForStatus } from './workflow';
import { createStudyFromDraft, emptyDraft, nextReference, validateProjectStep } from './studyFactory';
import { preAnalyse } from './preAnalysis';
import { missingDocs } from './catalog';
import { addDays, daysUntil, toISODate } from './dates';
import { formatEuroCompact } from './format';
import { buildDemoStudies } from '../data/demo';
import { LocalStudyRepository, memoryStore } from '../data/repository';
import type { Study } from './types';
import { metreSummary } from './metre';

// Lundi 28 septembre 2026, midi.
const TODAY = new Date(2026, 8, 28, 12);

function study(over: Partial<Study> = {}): Study {
  const draft = { ...emptyDraft('Test', 'AO-2026-001', TODAY), name: 'Projet', client: 'Client' };
  return { ...createStudyFromDraft(draft, 'Test', TODAY), ...over };
}

describe('dates', () => {
  it('compte les jours calendaires restants', () => {
    expect(daysUntil('2026-09-28', TODAY)).toBe(0);
    expect(daysUntil('2026-10-05', TODAY)).toBe(7);
    expect(daysUntil('2026-09-27', TODAY)).toBe(-1);
  });
});

describe('workflow', () => {
  it('enchaîne les étapes dans l’ordre', () => {
    expect(nextStatus('analyse')).toBe('metre');
    expect(nextStatus('remise')).toBeNull();
    expect(previousStatus('analyse')).toBeNull();
    expect(previousStatus('revue')).toBe('chiffrage');
  });

  it('ajuste l’avancement à l’étape', () => {
    expect(progressForStatus('chiffrage', 10)).toBe(55);
    expect(progressForStatus('chiffrage', 80)).toBe(74);
    expect(progressForStatus('chiffrage', 60)).toBe(60);
    expect(progressForStatus('remise', 10)).toBe(100);
  });

  it('propose la bonne prochaine action', () => {
    expect(nextAction(study({ dueDate: '2026-09-20' }), TODAY).label).toBe('Échéance dépassée');
    expect(nextAction(study({ dueDate: '2026-10-20' }), TODAY).label).toBe('Compléter le DCE');
    expect(nextAction(study({ dueDate: '2026-10-20', status: 'consultation', indicators: { criticalRisks: 0, openQuestions: 0, pendingPrices: 2 } }), TODAY).label).toBe('Relancer');
    expect(nextAction(study({ dueDate: '2026-10-20', status: 'validation' }), TODAY).label).toBe('Valider');
    expect(nextAction(study({ status: 'remise' }), TODAY).label).toBe('Aucune');
  });

  it('au métré : créer, puis valider les quantités', () => {
    const base = study({ dueDate: '2026-10-20', status: 'metre' });
    expect(nextAction(base, TODAY).label).toBe('Créer le métré');
    const demo = buildDemoStudies('T', TODAY)[0];
    const a = nextAction({ ...demo, status: 'metre' }, TODAY);
    expect(a.label).toBe('Valider les quantités');
    expect(a.reason).toMatch(/écart\(s\) > 10 %/);
  });

  it('propose l’analyse puis le traitement des points critiques', () => {
    const allReceived = study().dceDocs.map((d) => ({ ...d, received: true }));
    const cctp = { id: 'c', name: 'CCTP.pdf', size: 1, mime: '', kind: 'pdf' as const, category: 'CCTP' as const, uploadedAt: '', uploadedBy: '', note: '' };
    const base = study({ dueDate: '2026-10-20', dceDocs: allReceived, documents: [cctp] });
    expect(nextAction(base, TODAY).label).toBe('Lancer l’analyse');
    const finding = { id: 'f1', level: 'critique' as const, category: 'clause' as const, title: 'x', detail: '' };
    const analysis = { runAt: '', runBy: '', dceSignature: '', documentsRead: [], prestations: [], dpgfLines: [], comparison: [], findings: [finding] };
    expect(nextAction({ ...base, analysis }, TODAY).label).toBe('Traiter les points critiques');
    const treated = { ...base, analysis, analysisDecisions: { f1: { status: 'traite' as const, comment: '', by: '', at: '' } } };
    expect(nextAction(treated, TODAY).label).toBe('Analyser le DCE');
  });
});

describe('planning', () => {
  it('rétro-planifie jusqu’à la date de remise, dans l’ordre, hors week-end', () => {
    const plan = generatePlan('2026-10-26', TODAY);
    expect(plan).toHaveLength(6);
    expect(plan[plan.length - 1].dueDate).toBe('2026-10-26');
    for (let i = 1; i < plan.length; i++) expect(plan[i].dueDate >= plan[i - 1].dueDate).toBe(true);
    for (const t of plan.slice(0, -1)) {
      const [y, m, d] = t.dueDate.split('-').map(Number);
      expect([0, 6]).not.toContain(new Date(y, m - 1, d).getDay());
    }
  });

  it('ne planifie jamais avant aujourd’hui, même pour un délai très court', () => {
    const plan = generatePlan('2026-09-29', TODAY);
    for (const t of plan) expect(t.dueDate >= '2026-09-28').toBe(true);
    expect(isPlanTight('2026-09-29', TODAY)).toBe(true);
    expect(isPlanTight('2026-11-30', TODAY)).toBe(false);
  });
});

describe('tableau de bord', () => {
  const studies = buildDemoStudies('Ibrahima', TODAY);

  it('crée le projet de démonstration marqué comme tel', () => {
    expect(studies[0].name).toBe('PROJET DÉMONSTRATION — IMMEUBLE TERTIAIRE');
    const m = metreSummary(studies[0].metre);
    expect(m.total).toBe(25); // 23 lignes DPGF + 2 ajouts CCTP
    expect(m.majorGaps).toBeGreaterThan(0);
    expect(m.validated).toBeGreaterThan(15);
    expect(studies.slice(1).every((s) => s.metre.length === 0)).toBe(true);
    expect(studies.every((s) => s.isDemo)).toBe(true);
  });

  it('calcule les KPI sur les études en cours uniquement', () => {
    const k = computeKpis(studies, TODAY);
    const active = studies.filter((s) => s.status !== 'remise');
    expect(k.activeCount).toBe(active.length);
    expect(k.activeCount).toBe(12);
    expect(k.activeAmount).toBe(active.reduce((t, s) => t + s.estimatedAmount, 0));
    expect(k.overdueCount).toBe(1);
    expect(k.dueSoonCount).toBe(4); // J-2, J-4, J-5, J-6
    expect(k.readyToValidate).toBe(1);
  });

  it('compte les études par étape', () => {
    const c = countByStatus(studies);
    expect(c.map((x) => x.status)).toEqual(['analyse', 'metre', 'consultation', 'chiffrage', 'revue', 'validation', 'remise']);
    expect(c.reduce((t, x) => t + x.count, 0)).toBe(studies.length);
  });

  it('classe les priorités : retard puis échéance la plus proche', () => {
    const p = sortByPriority(studies, TODAY);
    expect(p[0].dueDate < toISODate(TODAY)).toBe(true);
    for (let i = 1; i < p.length; i++) expect(p[i].dueDate >= p[i - 1].dueDate).toBe(true);
    expect(p.some((s) => s.status === 'remise')).toBe(false);
  });

  it('signale ce qui bloque', () => {
    const kinds = new Set(computeAlerts(studies, TODAY).map((a) => a.kind));
    expect(kinds).toEqual(new Set(['overdue', 'due-soon', 'critical-risk', 'missing-dce', 'ready']));
  });
});

describe('création d’étude', () => {
  it('valide les champs obligatoires', () => {
    const d = emptyDraft('Ibrahima', 'AO-2026-001', TODAY);
    expect(Object.keys(validateProjectStep(d)).sort()).toEqual(['client', 'name']);
    expect(validateProjectStep({ ...d, name: 'X', client: 'Y', lots: [] }).lots).toBeDefined();
    expect(validateProjectStep({ ...d, name: 'X', client: 'Y' })).toEqual({});
  });

  it('propose la référence suivante de l’année', () => {
    expect(nextReference(['AO-2026-003', 'AO-2026-011', 'AO-2025-099'], TODAY)).toBe('AO-2026-012');
    expect(nextReference([], TODAY)).toBe('AO-2026-001');
  });

  it('démarre l’étude à l’étape Analyse avec un historique', () => {
    const s = study();
    expect(s.status).toBe('analyse');
    expect(s.isDemo).toBe(false);
    expect(s.history).toHaveLength(1);
  });

  it('ne garde que les familles des lots retenus', () => {
    const draft = { ...emptyDraft('T', 'R', TODAY), name: 'N', client: 'C', lots: ['CFA' as const] };
    expect(createStudyFromDraft(draft, 'T', TODAY).families.every((f) => f.startsWith('cfa-'))).toBe(true);
  });
});

describe('pré-analyse du DCE', () => {
  it('ignore les plans d’un lot non chiffré', () => {
    const docs = emptyDraft('T', 'R', TODAY).dceDocs.map((d) => ({ ...d, received: d.type !== 'PLANS_CFA' }));
    expect(missingDocs(docs, ['CFO'])).toHaveLength(0);
    expect(missingDocs(docs, ['CFO', 'CFA'])).toHaveLength(1);
  });

  it('signale les pièces indispensables manquantes et le délai court', () => {
    const f = preAnalyse({ dceDocs: emptyDraft('T', 'R', TODAY).dceDocs, lots: ['CFO'], dueDate: toISODate(addDays(TODAY, 3)) }, TODAY);
    expect(f.find((x) => x.title === 'DPGF manquant')?.level).toBe('critique');
    expect(f.find((x) => x.title === 'CCAP manquant')?.level).toBe('important');
    expect(f.some((x) => x.title === 'Plans CFA manquant')).toBe(false);
    expect(f.some((x) => x.title === 'Délai court')).toBe(true);
  });

  it('indique un dossier complet', () => {
    const docs = emptyDraft('T', 'R', TODAY).dceDocs.map((d) => ({ ...d, received: true }));
    expect(preAnalyse({ dceDocs: docs, lots: ['CFO', 'CFA'], dueDate: '2026-12-01' }, TODAY)[0].level).toBe('ok');
  });
});

describe('format', () => {
  it('affiche les montants de façon compacte', () => {
    expect(formatEuroCompact(2_480_000).replace(/\s/g, ' ')).toBe('2,48 M€');
    expect(formatEuroCompact(420_000).replace(/\s/g, ' ')).toBe('420 k€');
  });
});

describe('stockage', () => {
  it('relit ce qui a été enregistré et tolère un contenu corrompu', async () => {
    const store = memoryStore();
    const repo = new LocalStudyRepository(store);
    expect(await repo.loadStudies()).toBeNull();
    await repo.saveStudies([study()]);
    expect((await repo.loadStudies())?.[0].name).toBe('Projet');
    store.setItem('etudes-prix.v1.studies', '{corrompu');
    expect(await repo.loadStudies()).toBeNull();
  });
});
