import { describe, expect, it } from 'vitest';
import { sentences, normalizeText, isHeading } from './text';
import { mainPrestation, matchPrestations } from './prestationRules';
import { detectColumns, parseDpgf } from './dpgf';
import { analyse, dceSignature } from './analyse';
import { summarize, docFacts } from './summary';
import type { DceFile } from '../types';
import { itemsToLines } from '../../lib/extractText';
import { buildDemoFile } from '../../data/demoFiles';
import { buildDemoStudies } from '../../data/demo';
import { loadExcelJs } from '../../lib/excel';

function doc(category: DceFile['category'], name: string, id = name): DceFile {
  return { id, name, size: 1, mime: '', kind: name.endsWith('.xlsx') ? 'excel' : 'pdf', category, uploadedAt: '2026-09-01', uploadedBy: 'T', note: '' };
}

const study = (documents: DceFile[], families = ['cfo-tgbt', 'cfo-eclairage', 'cfa-ssi', 'cfa-vdi']) =>
  ({ documents, families, lots: ['CFO', 'CFA'] as ('CFO' | 'CFA')[] });

describe('découpage du texte', () => {
  it('sépare titres et phrases, recolle les césures', () => {
    const page = [
      '3. Éclairage',
      'Luminaires LED encastrés dans les bureaux, pilotage DALI et détection de présence dans les circu-',
      'lations. Éclairage de sécurité par BAES.',
    ].join('\n');
    const s = sentences(page);
    expect(s[0]).toBe('3. Éclairage');
    expect(s[1]).toContain('circulations.');
    expect(s[2]).toBe('Éclairage de sécurité par BAES.');
    expect(isHeading(s[0])).toBe(true);
    expect(sentences('Coordination avec le lot 12. La liste des points est jointe. 2.1. Tableaux divisionnaires')).toEqual([
      'Coordination avec le lot 12.', 'La liste des points est jointe.', '2.1. Tableaux divisionnaires',
    ]);
    expect(isHeading(s[2])).toBe(false);
  });

  it('regroupe les fragments pdf.js en lignes ordonnées', () => {
    const it = (str: string, x: number, y: number, width = str.length * 5) => ({ str, transform: [10, 0, 0, 10, x, y], width });
    expect(itemsToLines([it('monde', 60, 700), it('Bonjour', 10, 700, 40), it('Ligne 2', 10, 680)])).toEqual(['Bonjour monde', 'Ligne 2']);
  });
});

describe('reconnaissance des prestations', () => {
  it.each([
    ['Fourniture et pose d’un TGBT forme 2', 'tgbt'],
    ['Blocs autonomes d’éclairage de sécurité', 'baes'],
    ['Précâblage catégorie 6A', 'vdi'],
    ['Bornes de recharge VE 7 kW', 'irve'],
    ['ECS / CMSI adressable', 'ssi'],
    ['Pré-équipement IRVE (fourreaux + réservation TGBT)', 'irve'],
  ])('%s → %s', (text, id) => {
    expect(mainPrestation(normalizeText(text))?.id).toBe(id);
  });

  it('ne confond pas la supervision du maître d’œuvre avec une GTB', () => {
    expect(matchPrestations(normalizeText('Travaux réalisés sous la supervision du maître d’œuvre')).map((r) => r.id)).not.toContain('gtb');
  });
});

describe('lecture de la DPGF', () => {
  const rows = [
    ['DPGF lot électricité', null, null, null],
    ['N°', 'Désignation', 'Unité', 'Qté'],
    [null, 'COURANTS FORTS', null, null],
    ['1.1', 'TGBT — comptages, parafoudre', 'ens', 1],
    ['1.2', 'Luminaires LED 600x600', 'u', '312'],
    ['1.3', 'Frais de nettoyage', 'ft', null],
    [null, 'Sous-total courants forts', null, 12000],
    [null, 'COURANTS FAIBLES', null, null],
    ['2.1', 'Prises RJ45 cat. 6A', 'u', '1 250,5'],
  ];

  it('repère les colonnes', () => {
    expect(detectColumns(rows)).toEqual({ header: 1, cols: { ref: 0, designation: 1, unit: 2, qty: 3 } });
  });

  it('extrait les lignes, sections, quantités et prestations', () => {
    const lines = parseDpgf(rows);
    expect(lines.map((l) => l.ref)).toEqual(['1.1', '1.2', '1.3', '2.1']);
    expect(lines[0]).toMatchObject({ section: 'COURANTS FORTS', ruleId: 'tgbt', familyId: 'cfo-tgbt', qty: 1 });
    expect(lines[0].ruleIds).toEqual(expect.arrayContaining(['tgbt', 'comptage', 'parafoudre']));
    expect(lines[1].qty).toBe(312);
    expect(lines[2]).toMatchObject({ ruleId: null, qty: null });
    expect(lines[3]).toMatchObject({ section: 'COURANTS FAIBLES', qty: 1250.5, ruleId: 'vdi' });
  });

  it('renvoie une liste vide si la structure est inconnue', () => {
    expect(parseDpgf([['a', 'b'], ['c', 'd']])).toEqual([]);
  });
});

describe('analyse et comparaison CCTP / DPGF', () => {
  const cctp = doc('CCTP', 'CCTP.pdf');
  const ccap = doc('CCAP', 'CCAP.pdf');
  const dpgf = doc('DPGF', 'DPGF.xlsx');
  const texts = [
    { doc: cctp, pages: [
      'Fourniture d’un TGBT avec parafoudre. Puissance disponible à confirmer par le maître d’ouvrage.',
      'Éclairage de sécurité par BAES. Mise en lumière du hall. Autocontrôles et DOE en fin de chantier.',
    ] },
    { doc: ccap, pages: ['Une pénalité journalière de 1/1000e sera appliquée, sans plafond. Les travaux se dérouleront en site occupé.'] },
  ];
  const sheets = [{ name: 'DPGF', rows: [
    ['N°', 'Désignation', 'Unité', 'Quantité'],
    ['1', 'TGBT et parafoudre', 'ens', 1],
    ['2', 'BAES', 'u', 40],
    ['3', 'Précâblage VDI cat. 6A', 'u', null],
  ] }];

  const res = analyse({ study: study([cctp, ccap, dpgf], ['cfo-tgbt', 'cfo-eclairage', 'cfa-vdi']), texts, dpgf: { doc: dpgf, sheets }, user: 'T', now: new Date('2026-09-27T10:00:00Z') });
  const byId = (prefix: string) => res.findings.filter((f) => f.id.startsWith(prefix));

  it('compare les prestations des deux documents', () => {
    const st = Object.fromEntries(res.comparison.map((c) => [c.ruleId, c.status]));
    expect(st).toMatchObject({ tgbt: 'ok', parafoudre: 'ok', baes: 'ok', 'mise-en-lumiere': 'cctp-seul', vdi: 'dpgf-seul', 'essais-doe': 'cctp-seul' });
    expect(res.comparison.find((c) => c.ruleId === 'baes')!.cctpPages).toEqual([2]);
  });

  it('classe les écarts : oubli critique, prestation transverse à vérifier', () => {
    expect(byId('ecart-cctp-mise-en-lumiere')[0].level).toBe('critique');
    expect(byId('ecart-cctp-essais-doe')[0].level).toBe('verifier');
    expect(byId('ecart-dpgf-vdi')[0]).toMatchObject({ level: 'verifier', source: { row: 4 } });
    expect(byId('ecart-cctp-mise-en-lumiere')[0].question).toContain('p. 2');
  });

  it('signale les quantités manquantes', () => {
    expect(byId('quantite-')[0].title).toContain('3');
  });

  it('repère les clauses à risque avec leur source', () => {
    const titles = res.findings.filter((f) => f.category === 'clause').map((f) => `${f.title}@${f.source?.docName}p${f.source?.page}`);
    expect(titles).toEqual(expect.arrayContaining(['Hypothèse à confirmer@CCTP.pdfp1', 'Pénalités sans plafond@CCAP.pdfp1', 'Travaux en site occupé@CCAP.pdfp1']));
    expect(titles.some((t) => t.startsWith('Pénalités@'))).toBe(false);
  });

  it('trie les constats critiques en premier et produit des identifiants stables', () => {
    const levels = res.findings.map((f) => f.level);
    expect(levels.indexOf('verifier')).toBeGreaterThan(levels.lastIndexOf('critique'));
    const again = analyse({ study: study([cctp, ccap, dpgf], ['cfo-tgbt', 'cfo-eclairage', 'cfa-vdi']), texts, dpgf: { doc: dpgf, sheets }, user: 'T' });
    expect(again.findings.map((f) => f.id)).toEqual(res.findings.map((f) => f.id));
  });

  it('signale une prestation décrite mais exclue du périmètre', () => {
    const r = analyse({ study: study([cctp], ['cfo-tgbt']), texts: [texts[0]], user: 'T' });
    expect(r.findings.some((f) => f.id === 'perimetre-baes')).toBe(true);
    expect(r.findings.some((f) => f.id === 'document-dpgf-absente')).toBe(true);
  });

  it('résume les compteurs en tenant compte des décisions', () => {
    const base = summarize(res, {});
    const crit = res.findings.find((f) => f.level === 'critique')!;
    const after = summarize(res, { [crit.id]: { status: 'traite', comment: '', by: 'T', at: '' } });
    expect(after.critical).toBe(base.critical - 1);
    expect(after.confirmed).toBe(base.confirmed + 1);
    expect(base.confirmed).toBe(res.comparison.filter((c) => c.status === 'ok').length);
    expect(docFacts(res, 'CCAP.pdf', {}).critical).toBe(1);
  });

  it('détecte un DCE modifié depuis l’analyse', () => {
    expect(dceSignature([cctp, ccap, dpgf])).toBe(res.dceSignature);
    expect(dceSignature([cctp, ccap])).not.toBe(res.dceSignature);
  });
});

describe('analyse du DCE de démonstration', () => {
  it('lit les PDF et la DPGF fictifs et trouve les écarts attendus', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const s = buildDemoStudies('T')[0];
    const texts = [];
    for (const d of s.documents.filter((x) => ['RC', 'CCAP', 'CCTP'].includes(x.category))) {
      const b = await buildDemoFile(d.id);
      const task = pdfjs.getDocument({ data: new Uint8Array(await b!.blob.arrayBuffer()), useSystemFonts: true });
      const pdf = await task.promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) pages.push(itemsToLines((await (await pdf.getPage(i)).getTextContent()).items as never).join('\n'));
      await task.destroy();
      texts.push({ doc: d, pages });
    }
    const dd = s.documents.find((d) => d.category === 'DPGF')!;
    const ExcelJS = await loadExcelJs();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await (await buildDemoFile(dd.id))!.blob.arrayBuffer());
    const ws = wb.worksheets[0];
    const rows: (string | number | null)[][] = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const row: (string | number | null)[] = [];
      for (let c = 1; c <= 6; c++) { const v = ws.getRow(r).getCell(c).value; row.push(typeof v === 'string' || typeof v === 'number' ? v : null); }
      rows.push(row);
    }
    const res = analyse({ study: s, texts, dpgf: { doc: dd, sheets: [{ name: ws.name, rows }] }, user: 'T' });
    const ids = res.findings.map((f) => f.id);
    expect(res.dpgfLines.length).toBe(23); // 12 CFO + 10 CFA + 1 PSE
    expect(ids).toEqual(expect.arrayContaining(['ecart-cctp-interphonie', 'ecart-cctp-mise-en-lumiere', 'ecart-dpgf-groupe-electrogene']));
    expect(res.findings.some((f) => f.title === 'Pénalités sans plafond')).toBe(true);
    expect(res.findings.some((f) => f.title === 'Document annexe mentionné')).toBe(true);
    expect(res.findings.some((f) => f.title === 'Quantité à établir : 13.2.7')).toBe(true);
    const sum = summarize(res, {});
    expect(sum.critical).toBeGreaterThan(5);
    expect(sum.confirmed).toBeGreaterThan(20);
  });
});
