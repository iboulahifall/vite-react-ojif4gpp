import { describe, expect, it } from 'vitest';
import { calcFromDetail, effectiveQty, formatGap, gapOf, isProposed, mergeDpgf, metreSummary, metreToCsv, type MetreLine } from './metre';
import type { DpgfLine } from './analysis/types';

let n = 0;
const id = () => `m${++n}`;

function line(over: Partial<MetreLine> = {}): MetreLine {
  return { id: id(), familyId: 'cfo-eclairage', ref: '1.1', designation: 'Luminaires', unit: 'u', section: '', dpgfQty: 100,
    calcQty: null, calcDetail: [], retainedQty: null, validated: false, source: 'dpgf', comment: '', ...over };
}

function dpgf(ref: string, designation: string, qty: number | null, unit = 'u'): DpgfLine {
  return { ref, designation, unit, qty, section: 'CFO', row: 1, ruleId: null, familyId: 'cfo-eclairage', ruleIds: [] };
}

describe('quantités du métré', () => {
  it('calcule le détail (quantité × coefficient)', () => {
    expect(calcFromDetail([{ id: 'a', label: 'Bureaux', qty: 12, coef: 4 }, { id: 'b', label: 'Salles', qty: 3, coef: 6.5 }])).toBe(67.5);
    expect(calcFromDetail([])).toBeNull();
  });

  it('retient la saisie, sinon le calcul, sinon la DPGF', () => {
    expect(effectiveQty(line())).toBe(100);
    expect(effectiveQty(line({ calcQty: 110 }))).toBe(110);
    expect(effectiveQty(line({ calcQty: 110, retainedQty: 105 }))).toBe(105);
    expect(isProposed(line({ calcQty: 110 }))).toBe(true);
    expect(isProposed(line({ retainedQty: 105 }))).toBe(false);
  });

  it('qualifie les écarts avec la DPGF', () => {
    expect(gapOf(line()).level).toBe('aucun');
    expect(gapOf(line({ calcQty: 105 }))).toMatchObject({ abs: 5, level: 'mineur' });
    expect(gapOf(line({ calcQty: 125 }))).toMatchObject({ abs: 25, pct: 0.25, level: 'important' });
    expect(gapOf(line({ calcQty: 80 })).level).toBe('important');
    expect(gapOf(line({ dpgfQty: null, calcQty: 3 })).level).toBe('sans-dpgf');
    expect(gapOf(line({ dpgfQty: null })).level).toBe('a-etablir');
    expect(gapOf(line({ dpgfQty: 0, calcQty: 2 })).level).toBe('important');
    expect(formatGap(gapOf(line({ calcQty: 125 }))).replace(/\u00a0/g, ' ')).toBe('+25 (+25 %)');
    expect(formatGap(gapOf(line({ calcQty: 90 }))).replace(/\u00a0/g, ' ')).toBe('−10 (−10 %)');
  });
});

describe('initialisation et mise à jour depuis la DPGF', () => {
  it('crée une ligne par ligne de DPGF', () => {
    const r = mergeDpgf([], [dpgf('1.1', 'Luminaires', 100), dpgf('1.2', 'BAES', 40)], id);
    expect(r).toMatchObject({ added: 2, updated: 0, removed: 0 });
    expect(r.lines[1]).toMatchObject({ ref: '1.2', dpgfQty: 40, retainedQty: null, source: 'dpgf', validated: false });
  });

  it('conserve le travail fait et invalide les lignes dont la DPGF change', () => {
    const existing = [
      line({ ref: '1.1', designation: 'Luminaires', calcQty: 110, retainedQty: 108, validated: true, comment: 'relevé plans' }),
      line({ ref: '1.2', designation: 'BAES', dpgfQty: 40, calcQty: 40, validated: true }),
      line({ ref: '1.3', designation: 'Ancienne ligne', validated: true }),
      line({ ref: 'M1', designation: 'Ajout manuel', source: 'manuel', dpgfQty: null, retainedQty: 2 }),
    ];
    const r = mergeDpgf(existing, [dpgf('1.1', 'Luminaires', 120), dpgf('1.2', 'BAES', 40), dpgf('1.4', 'Détecteurs', 30)], id);
    expect(r).toMatchObject({ added: 1, updated: 1, removed: 1 });
    const get = (ref: string) => r.lines.find((l) => l.ref === ref)!;
    expect(get('1.1')).toMatchObject({ dpgfQty: 120, calcQty: 110, retainedQty: 108, validated: false, comment: 'relevé plans' });
    expect(get('1.2').validated).toBe(true);
    expect(get('1.3')).toMatchObject({ removedFromDpgf: true, validated: false });
    expect(get('M1').retainedQty).toBe(2);
    expect(mergeDpgf(r.lines, [dpgf('1.1', 'Luminaires', 120), dpgf('1.2', 'BAES', 40), dpgf('1.4', 'Détecteurs', 30)], id).removed).toBe(0);
  });
});

describe('synthèse et export', () => {
  const lines = [
    line({ validated: true }),
    line({ calcQty: 130 }),
    line({ calcQty: 104 }),
    line({ dpgfQty: null }),
    line({ familyId: null }),
    line({ removedFromDpgf: true }),
  ];

  it('compte validations, écarts et quantités à établir (hors lignes retirées)', () => {
    expect(metreSummary(lines)).toEqual({ total: 5, validated: 1, toEstablish: 1, majorGaps: 1, minorGaps: 1, unassigned: 1 });
  });

  it('produit un CSV lisible par Excel', () => {
    const csv = metreToCsv([line({ designation: 'Câble « U1000 »; 3G2,5', calcQty: 12.5, dpgfQty: 10 })], () => 'Éclairage');
    expect(csv.startsWith('﻿Famille;Poste;Désignation')).toBe(true);
    expect(csv).toContain('"Câble « U1000 »; 3G2,5"');
    expect(csv).toContain(';10;12,5;12,5;2,5;25;non;');
  });
});
