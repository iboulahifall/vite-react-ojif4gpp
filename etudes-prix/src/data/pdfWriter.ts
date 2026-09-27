/**
 * Générateur PDF minimal (texte Helvetica + traits), utilisé pour produire
 * les documents fictifs de démonstration sans dépendance externe.
 */

export type PdfOp =
  | { t: 'text'; x: number; y: number; size: number; text: string; bold?: boolean }
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: number } // fill = gris 0..1
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; width?: number };

export type PdfPage = PdfOp[];

/** A4 portrait en points. */
export const A4 = { w: 595, h: 842 };

// Caractères hors Latin-1 présents en français, vers leur code WinAnsi.
const WIN_ANSI: Record<string, number> = { '€': 0x80, '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, 'œ': 0x9c, 'Œ': 0x8c, '…': 0x85, '•': 0x95 };

function encodeText(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const code = WIN_ANSI[ch] ?? ch.charCodeAt(0);
    const b = code <= 0xff ? code : 0x3f; // « ? » pour l'inconnu
    if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c); // échappe ( ) \
    out.push(b);
  }
  return out;
}

function ascii(s: string): number[] {
  return Array.from(s, (c) => c.charCodeAt(0));
}

function pageStream(ops: PdfPage): number[] {
  const bytes: number[] = [];
  for (const op of ops) {
    if (op.t === 'text') {
      bytes.push(...ascii(`BT /${op.bold ? 'F2' : 'F1'} ${op.size} Tf ${op.x} ${op.y} Td (`), ...encodeText(op.text), ...ascii(') Tj ET\n'));
    } else if (op.t === 'rect') {
      bytes.push(...ascii(op.fill !== undefined ? `${op.fill} g ${op.x} ${op.y} ${op.w} ${op.h} re f 0 g\n` : `0.5 w ${op.x} ${op.y} ${op.w} ${op.h} re S\n`));
    } else {
      bytes.push(...ascii(`${op.width ?? 0.5} w ${op.x1} ${op.y1} m ${op.x2} ${op.y2} l S\n`));
    }
  }
  return bytes;
}

export function buildPdf(pages: PdfPage[], title = 'Document'): Uint8Array {
  const objects: number[][] = [];
  const add = (body: number[]) => { objects.push(body); return objects.length; };

  const catalogId = add([]); // rempli plus bas
  const pagesId = add([]);
  const f1 = add(ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  const f2 = add(ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  const pageIds: number[] = [];
  for (const p of pages) {
    const stream = pageStream(p);
    const contentId = add([...ascii(`<< /Length ${stream.length} >>\nstream\n`), ...stream, ...ascii('\nendstream')]);
    pageIds.push(add(ascii(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentId} 0 R >>`)));
  }
  objects[catalogId - 1] = ascii(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects[pagesId - 1] = ascii(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  const infoId = add([...ascii('<< /Title ('), ...encodeText(title), ...ascii(') /Producer (Etudes de Prix CFO-CFA) >>')]);

  const out: number[] = ascii('%PDF-1.4\n');
  out.push(0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a);
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out.push(...ascii(`${i + 1} 0 obj\n`), ...body, ...ascii('\nendobj\n'));
  });
  const xref = out.length;
  out.push(...ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
  for (const o of offsets) out.push(...ascii(`${String(o).padStart(10, '0')} 00000 n \n`));
  out.push(...ascii(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return new Uint8Array(out);
}

/** Met en page un texte simple (titres + paragraphes) sur autant de pages A4 que nécessaire. */
export function textDocument(header: string, blocks: { h?: string; p?: string }[], footer: string): PdfPage[] {
  const pages: PdfPage[] = [];
  const margin = 56;
  const maxChars = 92;
  let page: PdfPage = [];
  let y = 0;
  const newPage = () => {
    page = [
      { t: 'text', x: margin, y: A4.h - 40, size: 8, text: header },
      { t: 'line', x1: margin, y1: A4.h - 46, x2: A4.w - margin, y2: A4.h - 46 },
    ];
    pages.push(page);
    y = A4.h - 76;
  };
  const ensure = (h: number) => { if (y - h < 60) newPage(); };
  newPage();
  for (const b of blocks) {
    if (b.h) {
      ensure(40);
      y -= 8;
      page.push({ t: 'text', x: margin, y, size: 11.5, text: b.h, bold: true });
      y -= 18;
    }
    if (b.p) {
      const words = b.p.split(' ');
      let line = '';
      for (const w of words) {
        if ((line + ' ' + w).trim().length > maxChars) {
          ensure(14);
          page.push({ t: 'text', x: margin, y, size: 9.5, text: line.trim() });
          y -= 13;
          line = w;
        } else line += ' ' + w;
      }
      if (line.trim()) { ensure(14); page.push({ t: 'text', x: margin, y, size: 9.5, text: line.trim() }); y -= 13; }
      y -= 6;
    }
  }
  pages.forEach((p, i) => {
    p.push({ t: 'line', x1: margin, y1: 44, x2: A4.w - margin, y2: 44 });
    p.push({ t: 'text', x: margin, y: 32, size: 8, text: footer });
    p.push({ t: 'text', x: A4.w - margin - 50, y: 32, size: 8, text: `Page ${i + 1} / ${pages.length}` });
  });
  return pages;
}
