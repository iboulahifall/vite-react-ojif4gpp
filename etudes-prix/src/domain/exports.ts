import type { Study } from './types';
import { amountOf, criticalRisksOf, openQuestionsOf, pendingPricesOf } from './kpi';
import { nextAction, stageOf } from './workflow';
import { daysUntil } from './dates';

const esc = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const num = (n: number) => String(n).replace('.', ',');

/** Liste des études (lignes affichées) au format CSV « Excel français » : séparateur « ; », BOM UTF-8. */
export function studiesToCsv(studies: Study[], today = new Date()): string {
  const head = ['Référence', 'Projet', 'Client', 'Lieu', 'Responsable', 'Date de remise', 'Jours restants', 'Étape', 'Avancement %',
    'Montant HT', 'Risques critiques', 'Questions ouvertes', 'Prix en attente', 'Prochaine action', 'Validée', 'Démo'];
  const rows = studies.map((s) => [
    s.reference, s.name, s.client, s.location, s.owner, s.dueDate, s.status === 'remise' ? '' : num(daysUntil(s.dueDate, today)),
    stageOf(s.status).label, num(s.progress), num(amountOf(s)), num(criticalRisksOf(s)), num(openQuestionsOf(s, today)), num(pendingPricesOf(s, today)),
    nextAction(s, today).label, s.validation ? `V${s.validation.version}` : '', s.isDemo ? 'oui' : '',
  ].map((v) => esc(String(v))));
  return '﻿' + [head.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}
