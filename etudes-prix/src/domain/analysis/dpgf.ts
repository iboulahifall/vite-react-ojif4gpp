import type { DpgfLine } from './types';
import { normalizeText } from './text';
import { mainPrestation, PRESTATION_RULES } from './prestationRules';

type Row = (string | number | null)[];

interface Columns { ref: number; designation: number; unit: number; qty: number }

const HEADER = {
  ref: /^(n°|no|n|numero|num|ref|reference|article|art|poste|code|item)\.?$/,
  designation: /designation|libelle|description|intitule|prestations?|ouvrages?/,
  unit: /^(unite|u|unit|un)\.?$/,
  qty: /^(quantite|qte|qt|quant|qte dce|quantites?)\.?/,
};

function text(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Repère la ligne d'en-tête et les colonnes utiles d'une DPGF. */
export function detectColumns(rows: Row[]): { header: number; cols: Columns } | null {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const cells = rows[r].map((c) => normalizeText(text(c)));
    const find = (re: RegExp) => cells.findIndex((c) => c && re.test(c));
    const designation = find(HEADER.designation);
    const unit = find(HEADER.unit);
    if (designation < 0 || unit < 0) continue;
    return { header: r, cols: { ref: find(HEADER.ref), designation, unit, qty: find(HEADER.qty) } };
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = text(v).replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const TOTAL = /^(sous-?total|total|montant total|tva|total ht|total ttc|report)\b/;

/** Lignes chiffrables de la DPGF, avec leur section et la prestation reconnue. */
export function parseDpgf(rows: Row[]): DpgfLine[] {
  const det = detectColumns(rows);
  if (!det) return [];
  const { cols } = det;
  const lines: DpgfLine[] = [];
  let section = '';
  for (let r = det.header + 1; r < rows.length; r++) {
    const row = rows[r];
    const designation = text(row[cols.designation]);
    if (!designation) continue;
    const norm = normalizeText(designation);
    if (TOTAL.test(norm)) continue;
    const unit = text(row[cols.unit]);
    const qty = cols.qty >= 0 ? toNumber(row[cols.qty]) : null;
    if (!unit && qty === null) {
      section = designation;
      continue;
    }
    const main = mainPrestation(norm);
    lines.push({
      ref: cols.ref >= 0 ? text(row[cols.ref]) : '',
      designation,
      unit,
      qty,
      section,
      row: r + 1,
      ruleId: main?.id ?? null,
      familyId: main?.familyId ?? null,
      ruleIds: PRESTATION_RULES.filter((p) => p.pattern.test(norm)).map((p) => p.id),
    });
  }
  return lines;
}
