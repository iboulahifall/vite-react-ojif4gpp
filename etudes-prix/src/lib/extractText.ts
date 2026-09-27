import { openPdf } from './pdf';
import { loadExcelJs } from './excel';
import type { DceFile } from '../domain/types';

/** Texte d'un document, page par page (une seule « page » pour Word / texte). */
export interface ExtractedText {
  pages: string[];
}

interface PdfTextItem { str: string; transform: number[]; width: number; hasEOL?: boolean }

/** Regroupe les fragments pdf.js en lignes (même ordonnée), dans l'ordre de lecture. */
export function itemsToLines(items: PdfTextItem[]): string[] {
  const rows: { y: number; parts: { x: number; w: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
    if (!row) { row = { y, parts: [] }; rows.push(row); }
    row.parts.push({ x, w: it.width, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.parts.sort((a, b) => a.x - b.x);
    let line = '';
    let end = -Infinity;
    for (const p of r.parts) {
      if (line && p.x - end > 1.5 && !line.endsWith(' ') && !p.s.startsWith(' ')) line += ' ';
      line += p.s;
      end = p.x + p.w;
    }
    return line.trim();
  }).filter(Boolean);
}

export async function extractText(blob: Blob, doc: Pick<DceFile, 'kind' | 'name'>): Promise<ExtractedText> {
  if (doc.kind === 'pdf') {
    const { doc: pdf, close } = await openPdf(blob);
    try {
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent();
        pages.push(itemsToLines(content.items as PdfTextItem[]).join('\n'));
      }
      return { pages };
    } finally {
      await close();
    }
  }
  if (doc.kind === 'word' && /\.docx$/i.test(doc.name)) {
    const mammoth = await import('mammoth/mammoth.browser.js');
    const { value } = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() });
    return { pages: [value] };
  }
  if (doc.kind === 'text') return { pages: [await blob.text()] };
  return { pages: [] };
}

export type SheetRows = (string | number | null)[][];

function cellValue(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (v instanceof Date) return v.toLocaleDateString('fr-FR');
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
    if ('result' in o) return cellValue(o.result);
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.text) return o.text;
    return null;
  }
  return String(v);
}

/** Lignes de toutes les feuilles d'un classeur (DPGF). */
export async function extractSheets(blob: Blob, name: string): Promise<{ name: string; rows: SheetRows }[]> {
  if (/\.csv$/i.test(name)) {
    const text = await blob.text();
    const first = text.split('\n')[0];
    const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ';' : ',';
    return [{ name: 'CSV', rows: text.split(/\r?\n/).filter(Boolean).map((l) => l.split(sep).map((c) => {
      const n = Number(c.replace(/\s/g, '').replace(',', '.'));
      return c.trim() === '' ? null : Number.isFinite(n) && /^[\d\s.,-]+$/.test(c.trim()) ? n : c.trim();
    })) }];
  }
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  return wb.worksheets.map((ws) => {
    const rows: SheetRows = [];
    for (let r = 1; r <= Math.min(ws.rowCount, 5000); r++) {
      const row = ws.getRow(r);
      const cells: (string | number | null)[] = [];
      for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) cells.push(cellValue(row.getCell(c).value));
      rows.push(cells);
    }
    return { name: ws.name, rows };
  });
}
