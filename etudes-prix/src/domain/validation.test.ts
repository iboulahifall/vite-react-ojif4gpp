import { describe, expect, it } from 'vitest';
import { buildDemoStudies } from '../data/demo';
import { isLocked, snapshotOf, validationReadiness, versionLabel, type ValidationRecord } from './validation';
import { runReview } from './review';
import { buildUp } from './chiffrage';
import { nextAction } from './workflow';
import { studyBlockers } from './blockers';
import { computeAlerts } from './kpi';
import type { Study } from './types';

const TODAY = new Date(2026, 8, 28, 12);
const demo = (): Study => ({ ...buildDemoStudies('T', TODAY)[0], status: 'validation' });

function validated(s: Study): Study {
  const v: ValidationRecord = { version: 1, validatedAt: TODAY.toISOString(), validatedBy: 'T', approver: 'Direction', comment: '', checklist: [], withReserves: true, snapshot: snapshotOf(s) };
  return { ...s, validation: v, validationCount: 1 };
}

describe('validation finale', () => {
  it('fige le récapitulatif financier de l’étude', () => {
    const s = demo();
    const snap = snapshotOf(s);
    const b = buildUp(s.metre, s.chiffrage);
    expect(snap).toMatchObject({ dryCost: b.dryCost, costPrice: b.costPrice, salePrice: b.salePrice, margin: b.margin, marginPct: 8, criticalRisks: 1, missingPrices: 1, reviewScore: null });
    expect(snap.openQuestions).toBeGreaterThan(0);
  });

  it('exige une revue à jour ; les contrôles bloquants imposent des réserves', () => {
    const s = demo();
    expect(validationReadiness(s)).toMatchObject({ reviewOk: false, reason: 'Lancez d’abord la revue de prix.' });
    s.review = runReview(s, 'T', TODAY);
    const r = validationReadiness(s);
    expect(r.reviewOk).toBe(true);
    expect(r.blocking).toBeGreaterThan(0);
    const changed = { ...s, questions: [] };
    expect(validationReadiness(changed).reviewOk).toBe(false);
  });

  it('verrouille l’étude, ne signale plus de blocage et propose la remise', () => {
    const s = demo();
    expect(isLocked(s)).toBe(false);
    expect(versionLabel(s)).toBe('V1');
    const v = validated(s);
    expect(isLocked(v)).toBe(true);
    expect(studyBlockers(v, TODAY)).toEqual([]);
    expect(nextAction(v, TODAY).label).toBe('Remettre l’offre');
    expect(versionLabel({ validation: undefined, validationCount: 1 })).toBe('V2');
    expect(isLocked({ status: 'remise', validation: undefined })).toBe(true);
  });

  it('signale au tableau de bord les études prêtes à valider', () => {
    const s = demo();
    s.risks = []; s.questions = [];
    s.indicators = { criticalRisks: 0, openQuestions: 0, pendingPrices: 0 };
    expect(computeAlerts([s], TODAY).some((a) => a.kind === 'ready')).toBe(false); // pas de revue
    s.review = { ...runReview(s, 'T', TODAY), checks: [] };
    expect(computeAlerts([s], TODAY).some((a) => a.kind === 'ready')).toBe(true);
    expect(computeAlerts([validated(s)], TODAY).some((a) => a.kind === 'ready')).toBe(false);
  });
});

import { studiesToCsv } from './exports';
describe('export CSV des études', () => {
  it('produit un CSV lisible par Excel (BOM, « ; », virgule décimale, champs protégés)', () => {
    const studies = buildDemoStudies('T', TODAY);
    const csv = studiesToCsv(studies, TODAY);
    const lines = csv.split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines).toHaveLength(studies.length + 1);
    expect(lines[0].split(';')).toContain('Prochaine action');
    const s = { ...studies[0], name: 'Lot « A » ; bâtiment "B"' };
    expect(studiesToCsv([s], TODAY).split('\r\n')[1]).toContain('"Lot « A » ; bâtiment ""B"""');
  });
});
