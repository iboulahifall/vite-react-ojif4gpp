import type { DpgfLine } from './analysis/types';

/** Ligne de détail d'un métré : « 12 bureaux × 4 PC ». */
export interface MetreDetailRow {
  id: string;
  label: string;
  qty: number;
  coef: number;
}

export interface MetreLine {
  id: string;
  /** Famille de postes (null = à rattacher). */
  familyId: string | null;
  ref: string;
  designation: string;
  unit: string;
  section: string;
  /** Quantité figurant dans la DPGF (null = non renseignée ou ligne ajoutée). */
  dpgfQty: number | null;
  /** Quantité calculée par l'entreprise (somme du détail, ou saisie directe). */
  calcQty: number | null;
  calcDetail: MetreDetailRow[];
  /** Quantité retenue saisie ; si null, la quantité proposée est utilisée. */
  retainedQty: number | null;
  validated: boolean;
  validatedBy?: string;
  validatedAt?: string;
  source: 'dpgf' | 'manuel';
  /** Ligne issue d'une DPGF qui n'y figure plus après mise à jour. */
  removedFromDpgf?: boolean;
  /** Prestation du CCTP (règle d'analyse) à l'origine d'une ligne ajoutée. */
  fromRule?: string;
  comment: string;
}

/** Au-delà de cet écart relatif avec la DPGF, l'écart est jugé important. */
export const GAP_THRESHOLD = 0.1;

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function calcFromDetail(rows: MetreDetailRow[]): number | null {
  if (!rows.length) return null;
  return round(rows.reduce((t, r) => t + (Number(r.qty) || 0) * (Number.isFinite(r.coef) ? r.coef : 1), 0));
}

/** Quantité retenue effective : saisie, sinon calculée, sinon DPGF. */
export function effectiveQty(l: MetreLine): number | null {
  return l.retainedQty ?? l.calcQty ?? l.dpgfQty;
}

/** La quantité retenue est-elle une proposition (non saisie explicitement) ? */
export function isProposed(l: MetreLine): boolean {
  return l.retainedQty === null && effectiveQty(l) !== null;
}

export type GapLevel = 'aucun' | 'mineur' | 'important' | 'sans-dpgf' | 'a-etablir';

export interface Gap {
  abs: number | null;
  pct: number | null;
  level: GapLevel;
}

/** Écart entre quantité retenue et quantité DPGF. */
export function gapOf(l: MetreLine): Gap {
  const q = effectiveQty(l);
  if (q === null) return { abs: null, pct: null, level: 'a-etablir' };
  if (l.dpgfQty === null) return { abs: null, pct: null, level: 'sans-dpgf' };
  const abs = round(q - l.dpgfQty);
  const pct = l.dpgfQty === 0 ? (abs === 0 ? 0 : null) : abs / l.dpgfQty;
  if (abs === 0) return { abs, pct: 0, level: 'aucun' };
  const important = pct === null || Math.abs(pct) > GAP_THRESHOLD;
  return { abs, pct, level: important ? 'important' : 'mineur' };
}

function key(ref: string, designation: string): string {
  return `${ref.trim().toLowerCase()}|${designation.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

export function lineFromDpgf(l: DpgfLine, id: string): MetreLine {
  return {
    id,
    familyId: l.familyId,
    ref: l.ref,
    designation: l.designation,
    unit: l.unit,
    section: l.section,
    dpgfQty: l.qty,
    calcQty: null,
    calcDetail: [],
    retainedQty: null,
    validated: false,
    source: 'dpgf',
    comment: '',
  };
}

export interface MergeResult {
  lines: MetreLine[];
  added: number;
  updated: number;
  removed: number;
}

/**
 * Crée ou met à jour le métré à partir de la DPGF, sans perdre le travail déjà fait :
 * quantités calculées / retenues, détail, validations et lignes manuelles sont conservés.
 * Une ligne dont la quantité DPGF change perd sa validation.
 */
export function mergeDpgf(existing: MetreLine[], dpgf: DpgfLine[], newId: () => string): MergeResult {
  const byKey = new Map(existing.filter((l) => l.source === 'dpgf').map((l) => [key(l.ref, l.designation), l]));
  const seen = new Set<string>();
  let added = 0;
  let updated = 0;
  const fromDpgf: MetreLine[] = dpgf.map((d) => {
    const k = key(d.ref, d.designation);
    seen.add(k);
    const prev = byKey.get(k);
    if (!prev) { added++; return lineFromDpgf(d, newId()); }
    const changed = prev.dpgfQty !== d.qty || prev.unit !== d.unit;
    if (changed) updated++;
    return {
      ...prev,
      unit: d.unit,
      section: d.section,
      dpgfQty: d.qty,
      familyId: prev.familyId ?? d.familyId,
      removedFromDpgf: false,
      validated: changed ? false : prev.validated,
    };
  });
  let removed = 0;
  const orphans = existing
    .filter((l) => l.source === 'dpgf' && !seen.has(key(l.ref, l.designation)))
    .map((l) => { if (!l.removedFromDpgf) removed++; return { ...l, removedFromDpgf: true, validated: false }; });
  const manual = existing.filter((l) => l.source === 'manuel');
  return { lines: [...fromDpgf, ...orphans, ...manual], added, updated, removed };
}

export interface MetreSummary {
  total: number;
  validated: number;
  toEstablish: number;
  majorGaps: number;
  minorGaps: number;
  unassigned: number;
}

export function metreSummary(lines: MetreLine[]): MetreSummary {
  const active = lines.filter((l) => !l.removedFromDpgf);
  const gaps = active.map(gapOf);
  return {
    total: active.length,
    validated: active.filter((l) => l.validated).length,
    toEstablish: gaps.filter((g) => g.level === 'a-etablir').length,
    majorGaps: gaps.filter((g) => g.level === 'important').length,
    minorGaps: gaps.filter((g) => g.level === 'mineur').length,
    unassigned: active.filter((l) => !l.familyId).length,
  };
}

export function formatQty(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

export function formatGap(g: Gap): string {
  if (g.abs === null) return g.level === 'a-etablir' ? 'À établir' : '—';
  if (g.abs === 0) return '=';
  const sign = g.abs > 0 ? '+' : '−';
  // Espaces insécables : l'écart ne se coupe jamais sur deux lignes.
  const pct = g.pct === null ? '' : `\u00a0(${sign}${Math.abs(Math.round(g.pct * 100))}\u00a0%)`;
  return `${sign}${formatQty(Math.abs(g.abs))}${pct}`;
}

/** Export CSV (séparateur « ; », compatible Excel français). */
export function metreToCsv(lines: MetreLine[], familyLabel: (id: string | null) => string): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const num = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));
  const head = ['Famille', 'Poste', 'Désignation', 'Unité', 'Qté DPGF', 'Qté calculée', 'Qté retenue', 'Écart', 'Écart %', 'Validée', 'Commentaire'];
  const rows = lines.filter((l) => !l.removedFromDpgf).map((l) => {
    const g = gapOf(l);
    return [familyLabel(l.familyId), l.ref, l.designation, l.unit, num(l.dpgfQty), num(l.calcQty), num(effectiveQty(l)),
      num(g.abs), g.pct === null ? '' : String(Math.round(g.pct * 1000) / 10).replace('.', ','), l.validated ? 'oui' : 'non', l.comment].map((v) => esc(String(v)));
  });
  return '﻿' + [head.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}
