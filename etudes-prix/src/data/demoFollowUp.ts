import type { Question, Risk } from '../domain/risks';
import { addDays, toISODate } from '../domain/dates';
import { hash } from '../domain/analysis/text';

/** Identifiant du constat d'analyse correspondant à une phrase du DCE fictif (même calcul que l'analyse). */
function clauseId(rule: string, docId: string, sentence: string): string {
  return `clause-${rule}-${hash(docId + sentence)}`;
}

export const DEMO_SENTENCES = {
  puissance: 'Raccordement tarif jaune depuis le point de livraison existant, puissance à confirmer par le maître d’ouvrage (hypothèse 250 kVA).',
  penalites: 'En cas de retard dans l’exécution, une pénalité journalière de 1/1000e du montant du marché HT sera appliquée, sans plafond.',
  annexe: 'La liste des points est jointe en annexe.',
  siteOccupe: 'Les travaux seront réalisés en site partiellement occupé (niveau R+3 occupé jusqu’au mois 4).',
};

export function buildDemoFollowUp(studyId: string, owner: string, today = new Date()): { risks: Risk[]; questions: Question[] } {
  const d = (n: number) => toISODate(addDays(today, n));
  const at = (n: number, h = 10) => new Date(addDays(today, n).setHours(h, 15)).toISOString();
  const cctp = `${studyId}-doc-cctp`;
  const ccap = `${studyId}-doc-ccap`;
  const risks: Risk[] = [
    { id: `${studyId}-risk1`, number: 1, title: 'Pénalités de retard sans plafond', level: 'critique', category: 'contractuel',
      description: 'Pénalité journalière de 1/1000e du montant HT, sans plafond (CCAP art. 2).',
      source: { label: 'CCAP p.1', docId: ccap, page: 1, findingId: clauseId('penalites-sans-plafond', ccap, DEMO_SENTENCES.penalites) },
      impact: 'Exposition financière illimitée en cas de retard (site occupé, délais fournisseurs).', amount: 22000, owner,
      action: 'Demander un plafonnement à 10 % (Q-002) ; sécuriser les délais TGBT et SSI.', status: 'en-cours', createdAt: at(-5) },
    { id: `${studyId}-risk2`, number: 2, title: 'Puissance disponible non confirmée', level: 'important', category: 'technique',
      description: 'Le CCTP retient une hypothèse de 250 kVA « à confirmer par le maître d’ouvrage ».',
      source: { label: 'CCTP p.1', docId: cctp, page: 1, findingId: clauseId('a-confirmer', cctp, DEMO_SENTENCES.puissance) },
      impact: 'Prix du TGBT et du câble principal ; éventuel renforcement du branchement.', amount: 18000, owner,
      action: 'Question Q-001 posée ; chiffrage sur 250 kVA en hypothèse.', status: 'ouvert', createdAt: at(-5) },
    { id: `${studyId}-risk3`, number: 3, title: 'Site partiellement occupé jusqu’au mois 4', level: 'important', category: 'planning',
      description: 'Le niveau R+3 reste occupé pendant la première moitié des travaux.',
      source: { label: 'CCAP p.1', docId: ccap, page: 1, findingId: clauseId('site-occupe', ccap, DEMO_SENTENCES.siteOccupe) },
      impact: 'Baisse de productivité, phasage, travaux en horaires décalés possibles.', amount: 8500, owner,
      action: 'Majoration de 5 % des heures du R+3 intégrée au chiffrage.', status: 'maitrise', createdAt: at(-4) },
    { id: `${studyId}-risk4`, number: 4, title: 'Écart de quantité sur les détecteurs incendie', level: 'surveiller', category: 'technique',
      description: 'Métré 71 détecteurs contre 64 dans la DPGF (+11 %).', source: { label: 'Métré 13.2.2' },
      impact: 'Sous-évaluation possible du lot SSI sous-traité.', amount: 600, owner,
      action: 'Faire confirmer le nombre par le bureau de contrôle.', status: 'ouvert', createdAt: at(-2) },
  ];
  const questions: Question[] = [
    { id: `${studyId}-q1`, number: 1, subject: 'Alimentation TGBT', text: 'Confirmer la puissance disponible au point de livraison (hypothèse du CCTP : 250 kVA).',
      source: { label: 'CCTP p.1', docId: cctp, page: 1, findingId: clauseId('a-confirmer', cctp, DEMO_SENTENCES.puissance) },
      impact: 'Prix du TGBT + câble principal.', blocking: true, status: 'en-attente', sentAt: d(-4), dueDate: d(1), reminders: [], createdAt: at(-5) },
    { id: `${studyId}-q2`, number: 2, subject: 'Pénalités de retard', text: 'Un plafonnement des pénalités de retard (ex. 10 % du montant du marché) est-il envisageable ?',
      source: { label: 'CCAP p.1', docId: ccap, page: 1, findingId: clauseId('penalites-sans-plafond', ccap, DEMO_SENTENCES.penalites) },
      impact: 'Provision pour risque contractuel.', blocking: false, status: 'en-attente', sentAt: d(-4), dueDate: d(1), reminders: [], createdAt: at(-5) },
    { id: `${studyId}-q3`, number: 3, subject: 'Interphonie vidéo', text: 'L’interphonie vidéo décrite au CCTP (§10) n’apparaît pas dans la DPGF : dans quel article doit-elle être chiffrée ?',
      source: { label: 'CCTP p.2', docId: cctp, page: 2, findingId: 'ecart-cctp-interphonie' },
      impact: 'Environ 3 500 € HT à ajouter.', blocking: false, status: 'repondue', sentAt: d(-4), dueDate: d(1), reminders: [],
      answer: { text: 'À chiffrer en plus-value sur une ligne ajoutée à la DPGF (réponse du maître d’œuvre, fictive).', date: d(-1), by: owner }, createdAt: at(-5) },
    { id: `${studyId}-q4`, number: 4, subject: 'Liste des points GTB', text: 'Le CCTP indique que la liste des points GTB est jointe en annexe : pouvez-vous la transmettre ?',
      source: { label: 'CCTP p.2', docId: cctp, page: 2, findingId: clauseId('annexe', cctp, DEMO_SENTENCES.annexe) },
      impact: 'Dimensionnement des automates GTB (≈ 25 000 € HT).', blocking: true, status: 'relancee', sentAt: d(-6), dueDate: d(-2),
      reminders: [{ at: at(-4, 16), by: owner, note: 'Relance par courriel au maître d’œuvre.' }], createdAt: at(-6) },
  ];
  return { risks, questions };
}
