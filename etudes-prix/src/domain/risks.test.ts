import { describe, expect, it } from 'vitest';
import { isQuestionLate, nextNumber, questionCode, questionSummary, questionsLetter, riskCode, riskSummary, type Question, type Risk } from './risks';
import { studyBlockers } from './blockers';
import { buildDemoStudies } from '../data/demo';
import { criticalRisksOf, openQuestionsOf } from './kpi';

const TODAY = new Date(2026, 8, 28, 12);

function risk(over: Partial<Risk> = {}): Risk {
  return { id: 'r', number: 1, title: 'x', description: '', level: 'critique', category: 'technique', source: { label: '' }, impact: '', amount: 1000, owner: 'T', action: '', status: 'ouvert', createdAt: '', ...over };
}
function question(over: Partial<Question> = {}): Question {
  return { id: 'q', number: 1, subject: 's', source: { label: 'CCTP p.3' }, text: 'Confirmer ?', impact: '', blocking: false, status: 'en-attente', sentAt: '2026-09-20', dueDate: '2026-09-25', reminders: [], createdAt: '', ...over };
}

describe('risques', () => {
  it('compte les risques actifs par niveau et l’exposition financière', () => {
    const s = riskSummary([risk(), risk({ level: 'important', amount: 500, action: 'x' }), risk({ status: 'maitrise', amount: 9999 }), risk({ level: 'surveiller', amount: null, status: 'en-cours' })]);
    expect(s).toEqual({ critical: 1, important: 1, watch: 1, exposure: 1500, withoutAction: 1, closed: 1 });
  });
  it('numérote R-001, Q-014', () => {
    expect(riskCode({ number: 1 })).toBe('R-001');
    expect(questionCode({ number: 14 })).toBe('Q-014');
    expect(nextNumber([{ number: 3 }, { number: 7 }])).toBe(8);
    expect(nextNumber([])).toBe(1);
  });
});

describe('questions', () => {
  it('détecte une question en retard, sauf si elle vient d’être relancée', () => {
    expect(isQuestionLate(question(), TODAY)).toBe(true);
    expect(isQuestionLate(question({ reminders: [{ at: '2026-09-27T09:00:00Z', by: 'T', note: '' }], status: 'relancee' }), TODAY)).toBe(false);
    expect(isQuestionLate(question({ status: 'repondue' }), TODAY)).toBe(false);
    expect(isQuestionLate(question({ dueDate: '2026-10-01' }), TODAY)).toBe(false);
  });
  it('résume le suivi', () => {
    const s = questionSummary([question({ blocking: true }), question({ status: 'a-envoyer' }), question({ status: 'repondue' }), question({ status: 'sans-objet' })], TODAY);
    expect(s).toEqual({ open: 2, toSend: 1, waiting: 1, late: 1, blocking: 1, answered: 1 });
  });
  it('prépare le courriel au maître d’ouvrage avec les seules questions ouvertes', () => {
    const l = questionsLetter([question({ number: 1, subject: 'TGBT' }), question({ number: 2, status: 'repondue', subject: 'Déjà réglé' })], 'Immeuble X', 'AO-1', 'Ibrahima');
    expect(l.subject).toBe('Questions — Immeuble X — AO-1');
    expect(l.body).toContain('Q-001 — TGBT (CCTP p.3)');
    expect(l.body).not.toContain('Déjà réglé');
  });
});

describe('ce qui bloque', () => {
  const [demo, second] = buildDemoStudies('T', TODAY);

  it('calcule les indicateurs depuis les registres (sinon saisie manuelle)', () => {
    expect(criticalRisksOf(demo)).toBe(1);
    expect(openQuestionsOf(demo, TODAY)).toBe(3);
    expect(criticalRisksOf(second)).toBe(second.indicators.criticalRisks);
  });

  it('rassemble les blocages de tous les modules, critiques d’abord', () => {
    const b = studyBlockers(demo, TODAY);
    const ids = b.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['dce', 'metre-ecarts', 'metre-a-etablir', 'relances', 'prix', 'risques-critiques', 'questions-bloquantes']));
    expect(b.find((x) => x.id === 'risques-critiques')?.label).toBe('Risque critique R-001 : Pénalités de retard sans plafond');
    const q = b.find((x) => x.id === 'questions-bloquantes')!;
    expect(q).toMatchObject({ level: 'critique', label: '2 questions bloquantes sans réponse' }); // Q-004 en retard
    expect(q.detail).toContain('Q-004 en retard');
    expect(q.detail).not.toContain('Q-003'); // répondue, non bloquante
    expect(b.slice(0, b.filter((x) => x.level === 'critique').length).every((x) => x.level === 'critique')).toBe(true);
    expect(studyBlockers({ ...demo, status: 'remise' }, TODAY)).toEqual([]);
  });
});
