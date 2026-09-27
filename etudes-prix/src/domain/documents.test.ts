import { loadExcelJs } from '../lib/excel';
import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { classifyFileName, dceCompleteness, dceStatus, kindOf, syncDeclarations, validateUpload, formatFileSize } from './documents';
import { defaultDceDocs } from './studyFactory';
import type { DceFile } from './types';
import { buildPdf, textDocument } from '../data/pdfWriter';
import { buildDemoFile, demoDocuments } from '../data/demoFiles';
import { IndexedDbFileStore } from '../data/fileStore';
import { buildDemoStudies } from '../data/demo';

function file(category: DceFile['category'], name = 'f.pdf'): DceFile {
  return { id: name, name, size: 10, mime: '', kind: 'pdf', category, uploadedAt: '', uploadedBy: '', note: '' };
}

describe('classement automatique', () => {
  it.each([
    ['CCTP Lot 13 Electricite CFO-CFA.pdf', 'CCTP'],
    ['02_CCTP_lot_electricite.pdf', 'CCTP'],
    ['DPGF.xlsx', 'DPGF'],
    ['Lot13-DQE.xlsx', 'DPGF'],
    ['BPU elec.xlsx', 'DPGF'],
    ['CCAP.pdf', 'CCAP'],
    ['RC.pdf', 'RC'],
    ['Règlement de la consultation.pdf', 'RC'],
    ['Plans CFO.pdf', 'PLANS_CFO'],
    ['Plans CFA.pdf', 'PLANS_CFA'],
    ['Plan éclairage R+1.pdf', 'PLANS_CFO'],
    ['Synoptique SSI.pdf', 'PLANS_CFA'],
    ['Implantation VDI niveau 2.dwg', 'PLANS_CFA'],
    ['Courants forts - niveau RDC.pdf', 'PLANS_CFO'],
    ['Etude de sol.pdf', 'AUTRE'],
    ['photo.jpg', 'AUTRE'],
    ['Liste des points GTB.xlsx', 'PLANS_CFA'],
  ])('%s → %s', (name, expected) => {
    expect(classifyFileName(name)).toBe(expected);
  });

  it('ne confond pas « rc » à l’intérieur d’un mot', () => {
    expect(classifyFileName('Parcours incendie.pdf')).toBe('AUTRE');
  });
});

describe('type de fichier', () => {
  it('reconnaît les formats et n’ouvre jamais un SVG / HTML comme image', () => {
    expect(kindOf('a.PDF')).toBe('pdf');
    expect(kindOf('a.xlsx')).toBe('excel');
    expect(kindOf('a.docx')).toBe('word');
    expect(kindOf('a.png')).toBe('image');
    expect(kindOf('a.svg', 'image/svg+xml')).toBe('image'); // mime image/*…
    expect(kindOf('a.html', 'text/html')).toBe('other');
  });
});

describe('complétude du DCE', () => {
  const base = { dceDocs: defaultDceDocs(), lots: ['CFO', 'CFA'] as const };

  it('distingue importé, reçu sans fichier, manquant et sans objet', () => {
    const dceDocs = base.dceDocs.map((d) => (d.type === 'RC' ? { ...d, received: true } : d));
    const st = dceStatus({ documents: [file('CCTP')], dceDocs, lots: ['CFO'] });
    const get = (t: string) => st.find((s) => s.category === t)!.state;
    expect(get('CCTP')).toBe('imported');
    expect(get('RC')).toBe('declared');
    expect(get('DPGF')).toBe('missing');
    expect(get('PLANS_CFA')).toBe('na');
  });

  it('compte les pièces et les fichiers à classer', () => {
    const c = dceCompleteness({ documents: [file('CCTP'), file('AUTRE', 'x')], dceDocs: base.dceDocs, lots: [...base.lots] });
    expect(c.expected).toBe(6);
    expect(c.imported).toBe(1);
    expect(c.missing).toHaveLength(5);
    expect(c.unclassified).toBe(1);
  });

  it('déclare reçue une pièce dès qu’un fichier y est classé', () => {
    const docs = syncDeclarations({ documents: [file('DPGF')], dceDocs: base.dceDocs });
    expect(docs.find((d) => d.type === 'DPGF')!.received).toBe(true);
    expect(docs.find((d) => d.type === 'CCTP')!.received).toBe(false);
  });
});

describe('contrôle des fichiers importés', () => {
  it('refuse les fichiers vides ou trop volumineux', () => {
    expect(validateUpload({ name: 'a.pdf', size: 0 })).toMatch(/vide/);
    expect(validateUpload({ name: 'a.pdf', size: 60 * 1024 * 1024 })).toMatch(/volumineux/);
    expect(validateUpload({ name: 'a.pdf', size: 1000 })).toBeNull();
  });
  it('affiche des tailles lisibles', () => {
    expect(formatFileSize(512)).toBe('512 o');
    expect(formatFileSize(2048)).toBe('2 Ko');
  });
});

describe('fichiers de démonstration', () => {
  it('produit des PDF lisibles par pdf.js, avec accents et plusieurs pages', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const long = Array.from({ length: 80 }, (_, i) => ({ h: `Article ${i} — Éclairage`, p: 'Luminaires LED 3 400 lm, coût 1 200 € HT, œuvre. '.repeat(3) }));
    const bytes = buildPdf(textDocument('En-tête', long, 'Pied'), 'Test');
    const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
    const doc = await task.promise;
    expect(doc.numPages).toBeGreaterThan(3);
    const text = (await (await doc.getPage(1)).getTextContent()).items.map((i) => ('str' in i ? i.str : '')).join(' ');
    expect(text).toContain('Article 0 — Éclairage');
    expect(text).toContain('1 200 € HT, œuvre.');
    await task.destroy();
  });

  it('génère le DCE fictif du projet de démonstration (sauf plans CFA, manquants)', async () => {
    const study = buildDemoStudies('Test')[0];
    expect(study.documents.map((d) => d.category).sort()).toEqual(['CCAP', 'CCTP', 'DPGF', 'PLANS_CFO', 'RC']);
    expect(dceCompleteness(study).missing.map((m) => m.category)).toEqual(['PLANS_CFA']);
    for (const d of demoDocuments('demo-1', 'Test', '')) {
      const built = await buildDemoFile(d.id);
      expect(built?.blob.size).toBeGreaterThan(500);
    }
  });

  it('produit une DPGF Excel relisible', async () => {
    const ExcelJS = await loadExcelJs();
    const built = await buildDemoFile('demo-1-doc-dpgf');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await built!.blob.arrayBuffer());
    const ws = wb.worksheets[0];
    expect(ws.getCell('B4').value).toContain('TGBT');
    expect(ws.rowCount).toBeGreaterThan(20);
  });
});

describe('stockage des fichiers (IndexedDB)', () => {
  it('enregistre, relit et supprime un fichier', async () => {
    const store = new IndexedDbFileStore();
    await store.put('x', new Blob(['bonjour']));
    expect(await (await store.get('x'))!.text()).toBe('bonjour');
    await store.remove('x');
    expect(await store.get('x')).toBeNull();
  });
});

describe('résumé du contenu', () => {
  it('affiche pages, feuilles ou mots', async () => {
    const { formatFacts } = await import('./documents');
    expect(formatFacts({ pages: 12 })).toBe('12 p.');
    expect(formatFacts({ sheets: 1 })).toBe('1 feuille');
    expect(formatFacts({ sheets: 3 })).toBe('3 feuilles');
    expect(formatFacts({})).toBe('—');
  });
});
