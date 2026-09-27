/**
 * Prestations CFO / CFA reconnues dans le CCTP et la DPGF.
 * Les motifs s'appliquent à un texte normalisé (minuscules, sans accents).
 */
export interface PrestationRule {
  id: string;
  familyId: string;
  label: string;
  pattern: RegExp;
  /** Prestation transverse, souvent incluse dans les prix unitaires plutôt qu'en ligne dédiée. */
  transverse?: boolean;
}

export const PRESTATION_RULES: PrestationRule[] = [
  // CFO — TGBT
  { id: 'raccordement', familyId: 'cfo-tgbt', label: 'Raccordement / branchement', pattern: /\b(raccordement|branchement) (au reseau|tarif|enedis|du batiment)|tarif (jaune|vert|bleu)|point de livraison|poste de transformation|\btransformateur\b/ },
  { id: 'tgbt', familyId: 'cfo-tgbt', label: 'TGBT', pattern: /\btgbt\b|tableau general (basse tension|bt)/ },
  { id: 'comptage', familyId: 'cfo-tgbt', label: 'Comptages divisionnaires', pattern: /\bcomptages?\b|compteurs? (divisionnaires?|d'energie)/ },
  { id: 'parafoudre', familyId: 'cfo-tgbt', label: 'Parafoudre', pattern: /parafoudres?/ },
  { id: 'groupe-electrogene', familyId: 'cfo-tgbt', label: 'Groupe électrogène', pattern: /groupe electrogene/ },
  // CFO — tableaux
  { id: 'td', familyId: 'cfo-tableaux', label: 'Tableaux divisionnaires', pattern: /tableaux? divisionnaires?|\btd\b/ },
  // CFO — distribution
  { id: 'colonne', familyId: 'cfo-distribution', label: 'Colonne montante / câbles de distribution', pattern: /colonnes? montantes?|\bu1000 ?r2v\b|cables? de (distribution|puissance)/ },
  { id: 'chemins', familyId: 'cfo-distribution', label: 'Chemins de câbles', pattern: /chemins? de cables?|dalles? perforees?|goulottes? techniques?/ },
  { id: 'terre', familyId: 'cfo-distribution', label: 'Mise à la terre / liaisons équipotentielles', pattern: /mise a la terre|prise de terre|liaisons? equipotentielles?|ceinturage/ },
  { id: 'coupe-feu', familyId: 'cfo-distribution', label: 'Calfeutrements coupe-feu', pattern: /(rebouch|calfeutr)\w* .{0,40}coupe-feu|traversees? .{0,40}coupe-feu/, transverse: true },
  // CFO — éclairage
  { id: 'luminaires', familyId: 'cfo-eclairage', label: 'Luminaires', pattern: /luminaires?|\bdownlights?\b|reglettes? led/ },
  { id: 'gestion-eclairage', familyId: 'cfo-eclairage', label: 'Gestion d’éclairage (DALI, détection)', pattern: /\bdali\b|detecteurs? de presence|detection de presence|detecteurs? .{0,20}luminosite/ },
  { id: 'baes', familyId: 'cfo-eclairage', label: 'Éclairage de sécurité (BAES)', pattern: /\bbaes\b|\bbaeh\b|eclairage de securite|blocs? autonomes?/ },
  { id: 'mise-en-lumiere', familyId: 'cfo-eclairage', label: 'Mise en lumière / éclairage architectural', pattern: /mise en lumiere|eclairage (architectural|decoratif|exterieur)/ },
  // CFO — prises
  { id: 'postes-travail', familyId: 'cfo-prises', label: 'Postes de travail / prises de courant', pattern: /postes? de travail|prises? (de courant|2p\+t)|\bpc\b .{0,15}ondulees?/ },
  { id: 'nourrices', familyId: 'cfo-prises', label: 'Goulottes de bureau / nourrices de sol', pattern: /nourrices?|goulottes? (de bureau|gtl)|plancher technique/ },
  { id: 'onduleur', familyId: 'cfo-prises', label: 'Onduleur / circuits ondulés', pattern: /onduleurs?|\bondulees?\b|\bups\b/ },
  // CFO — force
  { id: 'alim-cvc', familyId: 'cfo-force', label: 'Alimentations CVC', pattern: /alimentations? .{0,30}(cvc|cta|groupes? (froid|de production)|vmc|chaufferie)|\bcta\b/ },
  { id: 'alim-ascenseur', familyId: 'cfo-force', label: 'Alimentation ascenseur', pattern: /ascenseurs?|monte-charges?/ },
  { id: 'irve', familyId: 'cfo-force', label: 'Bornes de recharge (IRVE)', pattern: /\birve\b|bornes? de recharge|points? de charge|recharge (de )?vehicules? electriques?/ },
  { id: 'photovoltaique', familyId: 'cfo-force', label: 'Photovoltaïque', pattern: /photovoltaique|panneaux solaires/ },
  // CFA — SSI
  { id: 'ssi', familyId: 'cfa-ssi', label: 'SSI (ECS / CMSI)', pattern: /\bssi\b|\bcmsi\b|\becs\b|securite incendie/ },
  { id: 'detection-incendie', familyId: 'cfa-ssi', label: 'Détection automatique d’incendie', pattern: /detect\w* (automatiques? )?(d'|de l')?incendie|detection automatique|detecteurs? (optiques?|de fumee|automatiques?)/ },
  { id: 'dm', familyId: 'cfa-ssi', label: 'Déclencheurs manuels', pattern: /declencheurs? manuels?/ },
  { id: 'diffuseurs', familyId: 'cfa-ssi', label: 'Diffuseurs d’alarme', pattern: /diffuseurs? (sonores?|lumineux|d'alarme)|\bdsaf\b|\bdl\b .{0,10}flash/ },
  { id: 'asservissements', familyId: 'cfa-ssi', label: 'Asservissements (désenfumage, portes CF)', pattern: /asservissements?|desenfumage|portes? coupe-feu/ },
  // CFA — VDI
  { id: 'vdi', familyId: 'cfa-vdi', label: 'Précâblage VDI / prises RJ45', pattern: /precablage|\bvdi\b|\brj ?45\b|categorie 6a?|\bcat\.? ?6a?\b/ },
  { id: 'baies', familyId: 'cfa-vdi', label: 'Baies de brassage', pattern: /baies? (de brassage|informatiques?)|\b42 ?u\b/ },
  { id: 'fibre', familyId: 'cfa-vdi', label: 'Rocade fibre optique', pattern: /fibre optique|\brocades?\b|\bom[34]\b/ },
  // CFA — accès
  { id: 'controle-acces', familyId: 'cfa-acces', label: 'Contrôle d’accès', pattern: /controle d'acces|lecteurs? de badges?|\bbadges?\b/ },
  { id: 'interphonie', familyId: 'cfa-acces', label: 'Interphonie / vidéophonie', pattern: /interphon\w*|videophon\w*|portier/ },
  // CFA — vidéo
  { id: 'video', familyId: 'cfa-video', label: 'Vidéosurveillance', pattern: /videosurveillance|videoprotection|cameras?\b|enregistreurs?/ },
  // CFA — GTB
  { id: 'gtb', familyId: 'cfa-gtb', label: 'GTB / supervision', pattern: /\bgtb\b|\bgtc\b|gestion technique (du batiment|centralisee)|\bbacnet\b|supervision (technique|centralisee|gtb)/ },
  // Transverse (rattaché à la distribution CFO par défaut)
  { id: 'essais-doe', familyId: 'cfo-distribution', label: 'Essais, autocontrôles et DOE', pattern: /\bdoe\b|dossier des ouvrages executes|autocontroles?|essais (et|de) (mise en service|reception)/, transverse: true },
  { id: 'verification', familyId: 'cfo-distribution', label: 'Vérification initiale / Consuel', pattern: /consuel|verification initiale|organisme (agree|de controle)/, transverse: true },
  { id: 'formation', familyId: 'cfa-gtb', label: 'Formation exploitation', pattern: /formation (du personnel|des utilisateurs|exploitation)/, transverse: true },
];

/** Prestations reconnues dans un texte normalisé. */
export function matchPrestations(normalized: string): PrestationRule[] {
  return PRESTATION_RULES.filter((r) => r.pattern.test(normalized));
}

/**
 * Prestation principale d'une désignation DPGF : la règle dont le motif
 * apparaît le plus tôt dans le libellé (le début de ligne porte l'objet).
 */
export function mainPrestation(normalizedDesignation: string): PrestationRule | null {
  let best: { rule: PrestationRule; at: number } | null = null;
  for (const rule of PRESTATION_RULES) {
    const m = rule.pattern.exec(normalizedDesignation);
    if (m && (!best || m.index < best.at)) best = { rule, at: m.index };
  }
  return best?.rule ?? null;
}
