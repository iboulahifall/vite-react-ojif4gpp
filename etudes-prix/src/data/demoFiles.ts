import { loadExcelJs } from '../lib/excel';
import type { DceFile } from '../domain/types';
import { A4, buildPdf, textDocument, type PdfPage } from './pdfWriter';

/**
 * DCE fictif du PROJET DÉMONSTRATION — IMMEUBLE TERTIAIRE.
 * Les fichiers sont générés à la demande (aucun fichier réel n'est embarqué).
 */

const PROJECT = 'PROJET DÉMONSTRATION — IMMEUBLE TERTIAIRE';
const HEADER = `DONNÉES DE DÉMONSTRATION — ${PROJECT} — Lot 13 Électricité CFO/CFA`;

interface DemoDocDef {
  id: string;
  name: string;
  category: DceFile['category'];
  mime: string;
  build: () => Promise<{ bytes: Uint8Array; pages?: number; sheets?: number }>;
}

function pdf(title: string, blocks: { h?: string; p?: string }[]) {
  return async () => {
    const pages = textDocument(HEADER, [{ h: title }, ...blocks], `${title} — document fictif`);
    return { bytes: buildPdf(pages, title), pages: pages.length };
  };
}

const RC_BLOCKS = [
  { h: 'Article 1 — Objet de la consultation', p: 'La présente consultation porte sur les travaux du lot 13 Électricité courants forts et courants faibles pour la réhabilitation d’un immeuble de bureaux de 4 niveaux (R+3) d’une surface de 3 200 m² SU. Maître d’ouvrage : SCI Démo Bureaux (fictif).' },
  { h: 'Article 2 — Date limite de remise des offres', p: 'Les offres devront être remises sur la plateforme de dématérialisation avant la date et l’heure indiquées dans l’avis de consultation. Aucune offre remise hors délai ne sera examinée.' },
  { h: 'Article 3 — Contenu de l’offre', p: 'Le candidat remettra : l’acte d’engagement complété, la DPGF dûment renseignée sans modification du cadre, un mémoire technique (moyens humains, méthodologie, planning, fiches techniques des principaux matériels), la liste des sous-traitants envisagés.' },
  { h: 'Article 4 — Variantes', p: 'Les variantes à l’initiative du candidat sont autorisées sous réserve de répondre également à la solution de base. La prestation supplémentaire éventuelle PSE 1 (GTB étendue aux compteurs divisionnaires) doit obligatoirement être chiffrée.' },
  { h: 'Article 5 — Critères de jugement', p: 'Prix des prestations : 60 %. Valeur technique appréciée au vu du mémoire technique : 40 %, dont méthodologie et planning 20 %, qualité des matériels proposés 15 %, démarche environnementale 5 %.' },
  { h: 'Article 6 — Visite du site', p: 'Une visite du site est fortement recommandée. Les candidats prendront rendez-vous auprès du maître d’œuvre. Aucune réclamation ne sera admise pour méconnaissance des lieux.' },
];

const CCAP_BLOCKS = [
  { h: 'Article 1 — Délais d’exécution', p: 'Le délai global d’exécution est de 8 mois à compter de l’ordre de service de démarrage, y compris période de préparation d’un mois. Les travaux seront réalisés en site partiellement occupé (niveau R+3 occupé jusqu’au mois 4).' },
  { h: 'Article 2 — Pénalités de retard', p: 'En cas de retard dans l’exécution, une pénalité journalière de 1/1000e du montant du marché HT sera appliquée, sans plafond. Pénalité pour absence en réunion de chantier : 150 € HT par absence.' },
  { h: 'Article 3 — Prix et révision', p: 'Les prix sont révisables mensuellement par application de l’index BT47. Une avance de 5 % pourra être versée. Retenue de garantie : 5 %, remplaçable par une garantie à première demande.' },
  { h: 'Article 4 — Réception', p: 'Les opérations préalables à la réception comprennent les essais et autocontrôles, le rapport de vérification initiale d’un organisme agréé (Consuel inclus), la remise du DOE en 3 exemplaires papier et 1 exemplaire numérique.' },
];

const CCTP_BLOCKS = [
  { h: '1. Généralités', p: 'Le présent CCTP définit les travaux d’électricité courants forts et courants faibles. L’entreprise est réputée avoir pris connaissance de l’ensemble des pièces du dossier, des plans et des autres lots, notamment CVC (lot 12) et plomberie (lot 11). Normes applicables : NF C 15-100, NF C 14-100, règlement de sécurité ERP type W 4e catégorie, Code du travail.' },
  { h: '2. Origine de l’installation — TGBT', p: 'Raccordement tarif jaune depuis le point de livraison existant, puissance à confirmer par le maître d’ouvrage (hypothèse 250 kVA). Fourniture et pose d’un TGBT de type forme 2, IP30, avec disjoncteur général 400 A réglable, comptages divisionnaires par usage (éclairage, prises, CVC, ascenseur), parafoudre type 1+2 et réserve de 20 % disponible.' },
  { h: '3. Tableaux divisionnaires', p: 'Un tableau divisionnaire par niveau et par demi-plateau, soit 8 TD, en coffrets métalliques. Protection différentielle 30 mA pour les circuits prises. Repérage de tous les départs. Les TD recevront un bornier de raccordement pour la GTB.' },
  { h: '4. Distribution et chemins de câbles', p: 'Colonne montante en câbles U1000 R2V depuis le TGBT vers chaque TD. Chemins de câbles en dalles perforées en faux plafond, séparation CFO / CFA obligatoire avec cloison de séparation ou chemins distincts. Toutes les traversées de parois coupe-feu seront rebouchées au degré requis.' },
  { h: '5. Éclairage', p: 'Luminaires LED 600x600 encastrés UGR<19 dans les bureaux, 3 400 lm, 4 000 K, pilotage DALI. Détection de présence et de luminosité dans les bureaux et circulations. Éclairage de sécurité par blocs autonomes BAES / BAEH à LED, adressables, avec télécommande centralisée. Mise en lumière du hall d’accueil selon plans.' },
  { h: '6. Prises de courant et postes de travail', p: 'Chaque poste de travail comprendra 4 prises 2P+T dont 2 ondulées (circuit détrompé) et 2 RJ45. Distribution par goulottes de bureau et nourrices en plancher technique selon plans. Prévoir 1 poste de travail pour 10 m² de bureau.' },
  { h: '7. Force motrice', p: 'Alimentations des équipements CVC (CTA, groupes froids, VMC), ascenseur, portes automatiques, et bornes de recharge de véhicules électriques (6 points de charge 7 kW en sous-sol, pré-équipement de 12 places supplémentaires). Coordination avec le lot 12 pour la définition des puissances.' },
  { h: '8. Système de sécurité incendie (SSI)', p: 'SSI de catégorie A avec ECS/CMSI adressable, détection automatique dans les locaux à risques et circulations, déclencheurs manuels, diffuseurs sonores et lumineux. Asservissements : désenfumage, portes coupe-feu, arrêt de la ventilation. Le choix du coordinateur SSI est à la charge du maître d’ouvrage : à confirmer.' },
  { h: '9. Précâblage VDI', p: 'Précâblage catégorie 6A, 4 paires, avec baie de brassage 42U par niveau et rocade fibre optique OM4 12 brins vers la baie principale en R+1. Recette avec certificats de test pour chaque lien.' },
  { h: '10. Contrôle d’accès et vidéosurveillance', p: 'Contrôle d’accès par badges sur les accès principaux, parking et locaux techniques (18 lecteurs). Vidéosurveillance : 12 caméras IP extérieures et intérieures, enregistreur 30 jours. Interphonie vidéo au portail et à l’accueil.' },
  { h: '11. Gestion technique du bâtiment (GTB)', p: 'GTB BACnet/IP supervisant les comptages, l’éclairage (état et commande par zone), les alarmes techniques et les équipements CVC du lot 12. La liste des points est jointe en annexe. La PSE 1 étend la GTB aux compteurs divisionnaires de chaque locataire.' },
  { h: '12. Essais, DOE et formation', p: 'Autocontrôles et essais de l’ensemble des installations, vérification initiale par un organisme agréé, dossier des ouvrages exécutés, formation du personnel d’exploitation (2 sessions d’une demi-journée).' },
];

/** Plans CFO : deux niveaux, pièces et symboles simplifiés. */
async function plansCfo() {
  const level = (name: string): PdfPage => {
    const ops: PdfPage = [
      { t: 'text', x: 40, y: A4.h - 40, size: 8, text: HEADER },
      { t: 'text', x: 40, y: A4.h - 70, size: 14, text: `PLAN CFO — ${name} — Échelle 1/100 (fictif)`, bold: true },
      { t: 'rect', x: 40, y: 160, w: 515, h: 560 },
    ];
    // Bureaux le long des façades
    for (let i = 0; i < 5; i++) {
      ops.push({ t: 'rect', x: 40 + i * 103, y: 580, w: 103, h: 140 });
      ops.push({ t: 'text', x: 48 + i * 103, y: 700, size: 7, text: `Bureau ${i + 1}` });
      ops.push({ t: 'rect', x: 40 + i * 103, y: 160, w: 103, h: 140 });
      ops.push({ t: 'text', x: 48 + i * 103, y: 284, size: 7, text: `Bureau ${i + 6}` });
      for (let j = 0; j < 2; j++) {
        // luminaires (carrés gris) et prises (petits rectangles)
        ops.push({ t: 'rect', x: 60 + i * 103 + j * 40, y: 640, w: 16, h: 16, fill: 0.75 });
        ops.push({ t: 'rect', x: 60 + i * 103 + j * 40, y: 220, w: 16, h: 16, fill: 0.75 });
        ops.push({ t: 'rect', x: 55 + i * 103 + j * 45, y: 584, w: 8, h: 5, fill: 0.2 });
        ops.push({ t: 'rect', x: 55 + i * 103 + j * 45, y: 291, w: 8, h: 5, fill: 0.2 });
      }
    }
    ops.push({ t: 'text', x: 250, y: 440, size: 9, text: 'Circulation / plateau ouvert' });
    ops.push({ t: 'rect', x: 470, y: 400, w: 40, h: 60, fill: 0.55 });
    ops.push({ t: 'text', x: 466, y: 390, size: 7, text: `TD ${name}` });
    ops.push({ t: 'line', x1: 490, y1: 460, x2: 490, y2: 580, width: 1.5 });
    ops.push({ t: 'line', x1: 490, y1: 400, x2: 490, y2: 300, width: 1.5 });
    // Légende
    ops.push({ t: 'text', x: 40, y: 130, size: 9, text: 'LÉGENDE', bold: true });
    ops.push({ t: 'rect', x: 40, y: 108, w: 12, h: 12, fill: 0.75 });
    ops.push({ t: 'text', x: 60, y: 110, size: 8, text: 'Luminaire LED 600x600 DALI' });
    ops.push({ t: 'rect', x: 40, y: 92, w: 10, h: 6, fill: 0.2 });
    ops.push({ t: 'text', x: 60, y: 92, size: 8, text: 'Poste de travail (4 PC + 2 RJ45)' });
    ops.push({ t: 'rect', x: 240, y: 104, w: 12, h: 18, fill: 0.55 });
    ops.push({ t: 'text', x: 260, y: 110, size: 8, text: 'Tableau divisionnaire' });
    ops.push({ t: 'text', x: 40, y: 50, size: 8, text: 'Document fictif — données de démonstration' });
    return ops;
  };
  const pages = [level('RDC'), level('R+1'), level('R+2'), level('R+3')];
  return { bytes: buildPdf(pages, 'Plans CFO'), pages: pages.length };
}

interface DpgfLine { n: string; d: string; u: string; q: number | null }

/** DPGF fictive : cadre de décomposition à remplir (prix vides). */
export const DEMO_DPGF: { section: string; lines: DpgfLine[] }[] = [
  { section: '13.1 COURANTS FORTS', lines: [
    { n: '13.1.1', d: 'TGBT forme 2 — disjoncteur général 400 A, comptages, parafoudre', u: 'ens', q: 1 },
    { n: '13.1.2', d: 'Tableaux divisionnaires par demi-plateau', u: 'u', q: 8 },
    { n: '13.1.3', d: 'Colonne montante U1000 R2V 4x95 mm²', u: 'ml', q: 96 },
    { n: '13.1.4', d: 'Chemins de câbles dalle perforée 300 mm', u: 'ml', q: 420 },
    { n: '13.1.5', d: 'Luminaires LED 600x600 DALI encastrés', u: 'u', q: 312 },
    { n: '13.1.6', d: 'Détecteurs de présence / luminosité', u: 'u', q: 86 },
    { n: '13.1.7', d: 'Blocs autonomes d’éclairage de sécurité adressables', u: 'u', q: 74 },
    { n: '13.1.8', d: 'Postes de travail (4 PC dont 2 ondulées)', u: 'u', q: 280 },
    { n: '13.1.9', d: 'Alimentations CVC (CTA, groupes, VMC)', u: 'ens', q: 1 },
    { n: '13.1.10', d: 'Bornes de recharge VE 7 kW', u: 'u', q: 6 },
    { n: '13.1.11', d: 'Pré-équipement IRVE (fourreaux + réservation TGBT)', u: 'place', q: 12 },
    { n: '13.1.12', d: 'Groupe électrogène de secours 60 kVA', u: 'ens', q: 1 },
  ] },
  { section: '13.2 COURANTS FAIBLES', lines: [
    { n: '13.2.1', d: 'SSI catégorie A — ECS / CMSI adressable', u: 'ens', q: 1 },
    { n: '13.2.2', d: 'Détecteurs automatiques d’incendie', u: 'u', q: 64 },
    { n: '13.2.3', d: 'Déclencheurs manuels', u: 'u', q: 22 },
    { n: '13.2.4', d: 'Diffuseurs sonores et lumineux', u: 'u', q: 38 },
    { n: '13.2.5', d: 'Prises RJ45 cat. 6A', u: 'u', q: 560 },
    { n: '13.2.6', d: 'Baies de brassage 42U', u: 'u', q: 4 },
    { n: '13.2.7', d: 'Rocade fibre optique OM4 12 brins', u: 'ml', q: null },
    { n: '13.2.8', d: 'Lecteurs de badges contrôle d’accès', u: 'u', q: 18 },
    { n: '13.2.9', d: 'Caméras IP + enregistreur 30 jours', u: 'ens', q: 1 },
    { n: '13.2.10', d: 'GTB BACnet/IP — supervision et points', u: 'ens', q: 1 },
  ] },
  { section: 'PSE 1', lines: [
    { n: 'PSE1.1', d: 'Extension GTB aux compteurs divisionnaires locataires', u: 'ens', q: 1 },
  ] },
];

async function dpgf() {
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Démonstration';
  const ws = wb.addWorksheet('DPGF Lot 13');
  ws.columns = [
    { header: 'N°', key: 'n', width: 10 },
    { header: 'Désignation', key: 'd', width: 62 },
    { header: 'Unité', key: 'u', width: 8 },
    { header: 'Quantité', key: 'q', width: 10 },
    { header: 'PU HT (€)', key: 'pu', width: 12 },
    { header: 'Montant HT (€)', key: 'm', width: 15 },
  ];
  ws.insertRow(1, [`DONNÉES DE DÉMONSTRATION — ${PROJECT} — DPGF lot 13 Électricité (fictive)`]);
  ws.getRow(1).font = { bold: true };
  ws.getRow(2).font = { bold: true };
  for (const s of DEMO_DPGF) {
    const r = ws.addRow({ d: s.section });
    r.font = { bold: true };
    for (const l of s.lines) {
      const row = ws.addRow({ n: l.n, d: l.d, u: l.u, q: l.q });
      row.getCell('m').value = { formula: `D${row.number}*E${row.number}` };
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return { bytes: new Uint8Array(buf as ArrayBuffer), sheets: 1 };
}

const DEMO_DOCS: DemoDocDef[] = [
  { id: 'rc', name: 'RC - Règlement de consultation.pdf', category: 'RC', mime: 'application/pdf', build: pdf('Règlement de consultation (fictif)', RC_BLOCKS) },
  { id: 'ccap', name: 'CCAP.pdf', category: 'CCAP', mime: 'application/pdf', build: pdf('CCAP (fictif)', CCAP_BLOCKS) },
  { id: 'cctp', name: 'CCTP Lot 13 Electricite CFO-CFA.pdf', category: 'CCTP', mime: 'application/pdf', build: pdf('CCTP Lot 13 Électricité CFO/CFA (fictif)', CCTP_BLOCKS) },
  { id: 'dpgf', name: 'DPGF Lot 13.xlsx', category: 'DPGF', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', build: dpgf },
  { id: 'plans-cfo', name: 'Plans CFO - RDC a R+3.pdf', category: 'PLANS_CFO', mime: 'application/pdf', build: plansCfo },
];

export function demoDocumentId(studyId: string, key: string): string {
  return `${studyId}-doc-${key}`;
}

/** Métadonnées des fichiers de démonstration (taille / pages complétées à la génération). */
export function demoDocuments(studyId: string, owner: string, uploadedAt: string): DceFile[] {
  return DEMO_DOCS.map((d) => ({
    id: demoDocumentId(studyId, d.id),
    name: d.name,
    size: 0,
    mime: d.mime,
    kind: d.mime === 'application/pdf' ? 'pdf' : 'excel',
    category: d.category,
    uploadedAt,
    uploadedBy: owner,
    note: 'Document fictif de démonstration.',
    isDemo: true,
  }));
}

/** Génère le contenu d'un fichier de démonstration à partir de son identifiant. */
export async function buildDemoFile(fileId: string): Promise<{ blob: Blob; pages?: number; sheets?: number } | null> {
  const def = DEMO_DOCS.find((d) => fileId.endsWith(`-doc-${d.id}`));
  if (!def) return null;
  const r = await def.build();
  return { blob: new Blob([r.bytes as BlobPart], { type: def.mime }), pages: r.pages, sheets: r.sheets };
}
