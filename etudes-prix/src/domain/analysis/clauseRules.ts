import type { FindingLevel } from './types';

/**
 * Clauses à risque repérées dans les pièces écrites (RC, CCAP, CCTP).
 * Chaque règle s'applique à une phrase normalisée ; une phrase ne produit
 * qu'un constat, celui de la première règle qui la reconnaît (ordre = priorité).
 */
export interface ClauseRule {
  id: string;
  level: FindingLevel;
  title: string;
  detail: string;
  pattern: RegExp;
  /** Question proposée ; « {phrase} » est remplacé par l'extrait. */
  question?: string;
  /** Nombre maximum de constats par document (3 par défaut). */
  max?: number;
}

export const CLAUSE_RULES: ClauseRule[] = [
  { id: 'a-confirmer', level: 'critique', title: 'Hypothèse à confirmer',
    detail: 'Le dossier laisse un point ouvert : le chiffrage repose sur une hypothèse non confirmée.',
    pattern: /\b(a confirmer|a preciser|a definir|a valider|non defini|hypothese)\b/,
    question: 'Pouvez-vous confirmer le point suivant : « {phrase} » ?' },
  { id: 'penalites-sans-plafond', level: 'critique', title: 'Pénalités sans plafond',
    detail: 'Des pénalités non plafonnées exposent l’entreprise à un risque financier illimité.',
    pattern: /penalite.{0,160}sans plafond|sans plafond.{0,80}penalite/,
    question: 'Un plafonnement des pénalités de retard (ex. 10 % du montant) est-il envisageable ?' },
  { id: 'penalites', max: 2, level: 'verifier', title: 'Pénalités',
    detail: 'Vérifier le montant des pénalités et leur impact sur le prix.',
    pattern: /penalites?\b(?!.{0,160}sans plafond)/ },
  { id: 'site-occupe', level: 'verifier', title: 'Travaux en site occupé',
    detail: 'Le site occupé réduit la productivité et impose des phasages : majorer la main-d’œuvre.',
    pattern: /site (partiellement )?occupe|en presence (des|du) (occupants|public|personnel)/,
    question: 'Pouvez-vous préciser le phasage et les contraintes horaires liés à l’occupation du site ?' },
  { id: 'horaires', level: 'critique', title: 'Travaux en horaires décalés',
    detail: 'Travail de nuit, de week-end ou en horaires décalés : majorations de main-d’œuvre à prévoir.',
    pattern: /travaux de nuit|\bde nuit\b|week-?ends?|horaires? (decales|particuliers)|jours feries/,
    question: 'Quel volume de travaux est à réaliser en horaires décalés (nuit / week-end) ?' },
  { id: 'amiante', level: 'critique', title: 'Amiante / plomb',
    detail: 'Présence possible d’amiante ou de plomb : sous-section 4, protections et délais spécifiques.',
    pattern: /amiante|\bplomb\b|\bhap\b/,
    question: 'Le repérage amiante avant travaux est-il disponible pour les zones concernées par le lot électricité ?' },
  { id: 'pse', max: 2, level: 'verifier', title: 'Prestation supplémentaire éventuelle (PSE)',
    detail: 'Une PSE doit être chiffrée séparément de la solution de base.',
    pattern: /\bpse ?\d*\b|prestations? supplementaires? eventuelles?/ },
  { id: 'variantes', max: 1, level: 'verifier', title: 'Variantes',
    detail: 'Vérifier si des variantes sont autorisées ou imposées et leurs conditions.',
    pattern: /\bvariantes?\b/ },
  { id: 'a-la-charge', level: 'verifier', title: 'Répartition des prestations entre lots',
    detail: 'Une prestation est attribuée à un autre intervenant ou à l’entreprise : vérifier les limites de prestation.',
    pattern: /a la charge (du|de l'|des|de la)|fourni(e|s)? par (le|la|les) (lot|maitre|moa)|hors (lot|marche)|non compris/,
    question: 'Pouvez-vous confirmer la répartition suivante : « {phrase} » ?' },
  { id: 'coordination-lots', max: 2, level: 'verifier', title: 'Coordination avec un autre lot',
    detail: 'Interface avec un autre lot : vérifier les limites de prestation et les données d’entrée.',
    pattern: /coordination avec (le|les) lots?|en coordination avec|\blot \d+\b.{0,60}(interface|coordination)/ },
  { id: 'exhaustivite', max: 2, level: 'verifier', title: 'Clause d’exhaustivité',
    detail: 'L’entreprise est réputée avoir tout prévu : les oublis resteront à sa charge.',
    pattern: /(est|sont) reputee?s? (avoir|comprendre|inclure)|toutes sujetions|aucune reclamation|aucun supplement/ },
  { id: 'annexe', level: 'verifier', title: 'Document annexe mentionné',
    detail: 'Une pièce complémentaire est citée : vérifier qu’elle figure dans le DCE.',
    pattern: /(jointe?s?|voir|fournie?s?) en annexe|\bvoir annexe\b|annexe \d+|liste des points/,
    question: 'Pouvez-vous transmettre la pièce mentionnée : « {phrase} » ?' },
  { id: 'delai', max: 1, level: 'verifier', title: 'Délai d’exécution',
    detail: 'Vérifier la cohérence entre délai, effectif et phasage.',
    pattern: /delai (global )?d'execution|delai de \d+ (mois|semaines)/ },
  { id: 'revision', max: 1, level: 'verifier', title: 'Prix révisables / fermes',
    detail: 'Vérifier le mode de révision des prix (index BT) ou l’absence de révision.',
    pattern: /prix (fermes|revisables|actualisables)|index bt ?\d+|\bbt ?47\b/ },
  { id: 'garanties', max: 1, level: 'verifier', title: 'Retenue de garantie / cautions',
    detail: 'Impact sur la trésorerie : vérifier retenue de garantie et cautions demandées.',
    pattern: /retenue de garantie|garantie a premiere demande|caution/ },
  { id: 'visite', max: 1, level: 'verifier', title: 'Visite de site',
    detail: 'Visite obligatoire ou recommandée : à organiser avant la remise.',
    pattern: /visite (du site|obligatoire|des lieux)|meconnaissance des lieux/ },
];
