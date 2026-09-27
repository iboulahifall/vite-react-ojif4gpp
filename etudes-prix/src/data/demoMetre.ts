import type { MetreDetailRow, MetreLine } from '../domain/metre';
import { calcFromDetail } from '../domain/metre';
import { mainPrestation } from '../domain/analysis/prestationRules';
import { normalizeText } from '../domain/analysis/text';
import { DEMO_DPGF } from './demoFiles';

/** Métré fictif du projet de démonstration : quantités calculées, détail, validations. */
const CALC: Record<string, { detail?: [string, number, number][]; calc?: number; validated?: boolean; comment?: string }> = {
  '13.1.1': { calc: 1, validated: true },
  '13.1.2': { detail: [['TD par demi-plateau (R+1 à R+3)', 3, 2], ['TD RDC + TD sous-sol', 2, 1]], validated: true },
  '13.1.3': { detail: [['Colonne TGBT → TD, par niveau', 4, 26]], validated: true, comment: 'Longueurs relevées sur coupe' },
  '13.1.4': { detail: [['Plateaux R+1 à R+3', 3, 125], ['RDC', 1, 80]], validated: true },
  '13.1.5': { detail: [['Plateaux R+1 à R+3', 3, 88], ['RDC (hall + bureaux)', 1, 62]], validated: true, comment: 'Comptage plans CFO indice B' },
  '13.1.6': { detail: [['Bureaux', 70, 1], ['Circulations', 22, 1]], validated: true },
  '13.1.7': { detail: [['BAES évacuation', 4, 16], ['BAEH locaux techniques', 1, 17]], validated: false },
  '13.1.8': { calc: 280, validated: true },
  '13.1.9': { calc: 1, validated: true },
  '13.1.10': { calc: 6, validated: true },
  '13.1.11': { calc: 12, validated: true },
  '13.1.12': { calc: 1, validated: false, comment: 'Non décrit au CCTP — question posée' },
  '13.2.1': { calc: 1, validated: true },
  '13.2.2': { detail: [['Plateaux R+1 à R+3', 3, 19], ['RDC + locaux techniques', 1, 14]], validated: false, comment: 'Écart à confirmer avec le bureau de contrôle' },
  '13.2.3': { calc: 22, validated: true },
  '13.2.4': { calc: 38, validated: true },
  '13.2.5': { detail: [['Postes de travail', 280, 2], ['Imprimantes / bornes Wi-Fi', 52, 1]], validated: true },
  '13.2.6': { calc: 4, validated: true },
  '13.2.7': { detail: [['Rocade par niveau (baie R+1 → baies)', 3, 24]], validated: false },
  '13.2.8': { calc: 18, validated: true },
  '13.2.9': { calc: 1, validated: true },
  '13.2.10': { calc: 1, validated: true },
  'PSE1.1': { calc: 1, validated: false },
};

export function buildDemoMetre(studyId: string, owner: string, at: string): MetreLine[] {
  const lines: MetreLine[] = [];
  let i = 0;
  for (const section of DEMO_DPGF) {
    for (const l of section.lines) {
      const c = CALC[l.n] ?? {};
      const detail: MetreDetailRow[] = (c.detail ?? []).map(([label, qty, coef], k) => ({ id: `${studyId}-d${i}-${k}`, label, qty, coef }));
      const calcQty = c.detail ? calcFromDetail(detail) : c.calc ?? null;
      lines.push({
        id: `${studyId}-m${i++}`,
        familyId: mainPrestation(normalizeText(l.d))?.familyId ?? null,
        ref: l.n,
        designation: l.d,
        unit: l.u,
        section: section.section,
        dpgfQty: l.q,
        calcQty,
        calcDetail: detail,
        retainedQty: c.validated ? calcQty : null,
        validated: !!c.validated,
        validatedBy: c.validated ? owner : undefined,
        validatedAt: c.validated ? at : undefined,
        source: 'dpgf',
        comment: c.comment ?? '',
      });
    }
  }
  // Prestations du CCTP absentes de la DPGF, ajoutées au métré après l'analyse.
  lines.push(
    { id: `${studyId}-m${i++}`, familyId: 'cfa-acces', ref: 'A1', designation: 'Interphonie vidéo portail + accueil (CCTP §10)', unit: 'ens', section: 'Ajouts CCTP',
      dpgfQty: null, calcQty: 2, calcDetail: [], retainedQty: 2, validated: true, validatedBy: owner, validatedAt: at, source: 'manuel', fromRule: 'interphonie', comment: 'Absent de la DPGF — chiffré en ligne ajoutée' },
    { id: `${studyId}-m${i++}`, familyId: 'cfa-ssi', ref: 'A2', designation: 'Asservissements SSI (désenfumage, portes CF, arrêt ventilation)', unit: 'ens', section: 'Ajouts CCTP',
      dpgfQty: null, calcQty: null, calcDetail: [], retainedQty: null, validated: false, source: 'manuel', fromRule: 'asservissements', comment: 'Nombre de points à confirmer' },
  );
  return lines;
}
