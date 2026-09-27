import type { DceDocDeclaration, Lot } from './types';
import { dceDocInfo, missingDocs } from './catalog';
import { daysUntil } from './dates';
import { TIGHT_PLAN_DAYS } from './planning';

export type FindingLevel = 'critique' | 'important' | 'surveiller' | 'ok';

export interface Finding {
  level: FindingLevel;
  title: string;
  detail: string;
}

/**
 * Pré-analyse V1.1 : contrôles de cohérence sur les éléments déclarés
 * (pièces reçues, lots, délai). L'analyse du contenu des documents
 * (CCTP / DPGF) arrive en V1.3.
 */
export function preAnalyse(input: { dceDocs: DceDocDeclaration[]; lots: Lot[]; dueDate: string }, today = new Date()): Finding[] {
  const findings: Finding[] = [];
  for (const d of missingDocs(input.dceDocs, input.lots)) {
    const info = dceDocInfo(d.type);
    findings.push({
      level: info.essential ? 'critique' : 'important',
      title: `${info.label} manquant`,
      detail: info.essential
        ? `Pièce indispensable : ${info.role.toLowerCase()}. Demander la pièce au maître d’ouvrage.`
        : `${info.role}. À demander pour sécuriser l’offre.`,
    });
  }
  if (input.lots.length === 0) {
    findings.push({ level: 'critique', title: 'Aucun lot sélectionné', detail: 'Choisir au moins CFO ou CFA.' });
  }
  if (input.dueDate) {
    const days = daysUntil(input.dueDate, today);
    if (days < 0) {
      findings.push({ level: 'critique', title: 'Date de remise passée', detail: 'Vérifier la date de remise indiquée dans le RC.' });
    } else if (days < TIGHT_PLAN_DAYS) {
      findings.push({ level: 'important', title: 'Délai court', detail: `${days} jour(s) avant la remise : prioriser les consultations dès le démarrage.` });
    }
  }
  if (findings.length === 0) {
    findings.push({ level: 'ok', title: 'Dossier complet', detail: 'Toutes les pièces déclarées sont présentes et le délai est confortable.' });
  }
  return findings;
}
