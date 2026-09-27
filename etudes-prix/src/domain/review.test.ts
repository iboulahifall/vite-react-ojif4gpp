import { describe, expect, it } from 'vitest';
import { buildDemoStudies } from '../data/demo';
import { isJustified, isReviewStale, runChecks, runReview, scoreOf, type ReviewCheck } from './review';
import { nextAction } from './workflow';
import { studyBlockers } from './blockers';
import type { Study } from './types';

const TODAY = new Date(2026, 8, 28, 12);
const demo = (): Study => buildDemoStudies('T', TODAY)[0];
const byId = (checks: ReviewCheck[], id: string) => checks.find((c) => c.id === id)!;

describe('revue de prix', () => {
  it('contrôle toutes les familles et relie chaque anomalie à la page où la corriger', () => {
    const checks = runChecks(demo(), TODAY);
    expect(new Set(checks.map((c) => c.group))).toEqual(new Set(['cctp', 'dpgf', 'pieces', 'quantites', 'prix', 'risques']));
    expect(checks.length).toBeGreaterThanOrEqual(25);
    expect(new Set(checks.map((c) => c.id)).size).toBe(checks.length);
    for (const c of checks) expect(c.to).toMatch(/^\/etudes\/demo-1/);
  });

  it('détecte les incohérences du projet de démonstration', () => {
    const c = runChecks(demo(), TODAY);
    expect(byId(c, 'analyse-faite').status).toBe('verifier'); // l'analyse n'a pas été lancée
    expect(byId(c, 'dce-pieces').status).not.toBe('ok'); // plans CFA manquants
    expect(byId(c, 'plans-importes').detail).toContain('plans CFA manquants');
    expect(byId(c, 'risques-critiques').status).toBe('bloquant');
    expect(byId(c, 'qte-etablies').status).toBe('bloquant'); // 13.2.7 sans quantité
  });

  it('bloque sur les prix manquants et une marge négative, signale les prix hors norme', () => {
    const s = demo();
    const first = s.metre[0];
    const others = s.chiffrage.lines.filter((l) => l.metreLineId !== first.id);
    s.chiffrage = { ...s.chiffrage, params: { ...s.chiffrage.params, marginPct: -2 }, lines: others };
    let c = runChecks(s, TODAY);
    expect(byId(c, 'prix-manquants').status).toBe('bloquant');
    expect(byId(c, 'prix-manquants').items[0].label).toContain(first.designation);
    expect(byId(c, 'marge').status).toBe('bloquant');

    // Luminaire saisi 100 fois trop cher (erreur d'unité) : prix confirmé mais anormal.
    const lum = s.metre.find((m) => /luminaire/i.test(m.designation) && !m.removedFromDpgf)!;
    s.chiffrage.lines = s.chiffrage.lines.map((l) => l.metreLineId === lum.id
      ? { ...l, materialUnit: 9500, laborHoursUnit: 0.8, subcontractUnit: null, source: { kind: 'catalogue', status: 'confirme' } } : l);
    c = runChecks(s, TODAY);
    expect(byId(c, 'prix-anormaux').status).toBe('verifier');
    expect(byId(c, 'prix-anormaux').items.some((i) => i.label.includes(lum.designation))).toBe(true);
  });

  it('calcule le score : réussis + justifiés sur les contrôles applicables', () => {
    const checks: ReviewCheck[] = [
      { id: 'a', group: 'prix', label: 'A', status: 'ok', detail: '', items: [], to: '' },
      { id: 'b', group: 'prix', label: 'B', status: 'verifier', detail: 'x', items: [], to: '' },
      { id: 'c', group: 'prix', label: 'C', status: 'bloquant', detail: '', items: [], to: '' },
      { id: 'd', group: 'prix', label: 'D', status: 'na', detail: '', items: [], to: '' },
    ];
    expect(scoreOf(checks)).toMatchObject({ score: 33, passed: 1, toCheck: 1, blocking: 1, justified: 0, applicable: 3 });
    const j = { b: { reason: 'Hypothèse écrite dans l’offre', by: 'T', at: '', detail: 'x' } };
    expect(scoreOf(checks, j)).toMatchObject({ score: 67, toCheck: 0, justified: 1 });
    // Constat modifié : la justification ne s'applique plus.
    expect(isJustified({ ...checks[1], detail: 'y' }, j)).toBe(false);
  });

  it('détecte une revue périmée et guide la prochaine action', () => {
    const s: Study = { ...demo(), status: 'revue' };
    expect(nextAction(s, TODAY).label).not.toBe('Passer à la validation');
    expect(studyBlockers(s, TODAY).some((b) => b.id === 'revue')).toBe(true);
    s.review = runReview(s, 'T', TODAY);
    expect(isReviewStale(s)).toBe(false);
    const changed = { ...s, risks: s.risks.map((r) => ({ ...r, status: 'clos' as const })) };
    expect(isReviewStale(changed)).toBe(true);
    expect(studyBlockers(changed, TODAY).find((b) => b.id === 'revue')?.label).toBe('Revue de prix à relancer');
  });

  it('propose la validation quand la revue n’a plus de point ouvert', () => {
    const s: Study = { ...demo(), status: 'revue' };
    s.review = { runAt: TODAY.toISOString(), runBy: 'T', signature: '', checks: [{ id: 'a', group: 'prix', label: 'A', status: 'ok', detail: '', items: [], to: '' }] };
    s.risks = []; s.questions = [];
    s.indicators = { criticalRisks: 0, openQuestions: 0, pendingPrices: 0 };
    s.review.signature = runReview(s, 'T', TODAY).signature;
    expect(nextAction(s, TODAY).label).toBe('Passer à la validation');
  });
});
