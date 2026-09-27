import { loadExcelJs } from '../../lib/excel';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, FileQuestion, Loader2, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { DceFile } from '../../domain/types';
import { openPdf } from '../../lib/pdf';
import { sanitizeHtml } from '../../lib/sanitize';

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-72 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-500">{children}</div>;
}

function Loading() {
  return <Centered><Loader2 className="animate-spin text-brand-600" /> Ouverture du document…</Centered>;
}

function Unreadable({ reason }: { reason: string }) {
  return (
    <Centered>
      <FileQuestion size={36} className="text-slate-400" />
      <p className="font-medium text-slate-700">Aperçu non disponible</p>
      <p>{reason}</p>
      <p className="text-xs">Utilisez « Télécharger » pour l’ouvrir avec le logiciel adapté.</p>
    </Centered>
  );
}

const toolBtn = 'rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer';

function PdfViewer({ blob, initialPage = 1 }: { blob: Blob; initialPage?: number }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let closed = false;
    let close: (() => Promise<void>) | null = null;
    setPdf(null); setError(false); setPage(1);
    openPdf(blob)
      .then((r) => {
        if (closed) { void r.close(); return; }
        close = r.close;
        setPage(Math.min(Math.max(1, initialPage), r.doc.numPages));
        setPdf(r.doc);
      })
      .catch(() => !closed && setError(true));
    return () => { closed = true; void close?.(); };
  }, [blob, initialPage]);

  useEffect(() => {
    if (!pdf || !canvas.current || !box.current) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      const p = await pdf.getPage(page);
      if (cancelled || !canvas.current || !box.current) return;
      const base = p.getViewport({ scale: 1 });
      const scale = zoom === 'fit' ? Math.max(0.3, (box.current.clientWidth - 32) / base.width) : zoom;
      const vp = p.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      const c = canvas.current;
      c.width = Math.floor(vp.width * ratio);
      c.height = Math.floor(vp.height * ratio);
      c.style.width = `${Math.floor(vp.width)}px`;
      c.style.height = `${Math.floor(vp.height)}px`;
      task = p.render({ canvas: c, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      await task.promise.catch(() => {});
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, page, zoom]);

  if (error) return <Unreadable reason="Ce PDF n’a pas pu être lu (fichier protégé ou endommagé)." />;
  const n = pdf?.numPages ?? 0;
  const currentZoom = typeof zoom === 'number' ? zoom : 1;
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-center gap-1 border-b border-slate-200 bg-white px-3 py-1.5">
        <button className={toolBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Page précédente"><ChevronLeft size={18} /></button>
        <span className="flex items-center gap-1 text-sm">
          Page
          <input type="number" min={1} max={n} value={page} aria-label="Numéro de page"
            onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= n) setPage(v); }}
            className="w-14 rounded border border-slate-300 px-1 py-0.5 text-center tabular" />
          / <span className="tabular">{n || '…'}</span>
        </span>
        <button className={toolBtn} disabled={page >= n} onClick={() => setPage((p) => p + 1)} aria-label="Page suivante"><ChevronRight size={18} /></button>
        <span className="mx-2 h-5 w-px bg-slate-200" />
        <button className={toolBtn} onClick={() => setZoom(Math.max(0.4, +(currentZoom - 0.2).toFixed(1)))} aria-label="Dézoomer"><ZoomOut size={18} /></button>
        <span className="w-14 text-center text-xs tabular text-slate-600">{zoom === 'fit' ? 'Largeur' : `${Math.round(zoom * 100)} %`}</span>
        <button className={toolBtn} onClick={() => setZoom(Math.min(3, +(currentZoom + 0.2).toFixed(1)))} aria-label="Zoomer"><ZoomIn size={18} /></button>
        <button className={clsx(toolBtn, zoom === 'fit' && 'bg-slate-100')} onClick={() => setZoom('fit')} aria-label="Ajuster à la largeur" title="Ajuster à la largeur"><Maximize2 size={16} /></button>
      </div>
      <div ref={box} className="flex-1 overflow-auto bg-slate-200/70 p-4">
        {!pdf && <Loading />}
        <canvas ref={canvas} className={clsx('mx-auto bg-white shadow-md', !pdf && 'hidden')} aria-label={`Page ${page} du document`} />
      </div>
    </div>
  );
}

type Cell = string | number | null;
interface Sheet { name: string; rows: Cell[][]; truncated: boolean; widths?: number[] }

const MAX_ROWS = 1000;
const MAX_COLS = 40;

function cellText(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
  if (v instanceof Date) return v.toLocaleDateString('fr-FR');
  if (typeof v === 'object') {
    const o = v as { result?: unknown; text?: string; richText?: { text: string }[]; error?: string; hyperlink?: string };
    if ('result' in o) return cellText(o.result);
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.text) return o.text;
    if (o.error) return o.error;
  }
  return String(v);
}

async function readSpreadsheet(blob: Blob, name: string): Promise<Sheet[]> {
  if (/\.csv$/i.test(name)) {
    const text = await blob.text();
    const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) >= (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
    const lines = text.split(/\r?\n/).filter((l) => l.length);
    return [{ name: 'CSV', rows: lines.slice(0, MAX_ROWS).map((l) => l.split(sep).slice(0, MAX_COLS)), truncated: lines.length > MAX_ROWS }];
  }
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  return wb.worksheets.map((ws) => {
    const rows: Cell[][] = [];
    const cols = Math.min(ws.columnCount, MAX_COLS);
    for (let r = 1; r <= Math.min(ws.rowCount, MAX_ROWS); r++) {
      const row = ws.getRow(r);
      const cells: Cell[] = [];
      for (let c = 1; c <= cols; c++) cells.push(cellText(row.getCell(c).value));
      rows.push(cells);
    }
    // Largeur des colonnes définie dans le classeur (en caractères), convertie en pixels.
    const widths = Array.from({ length: cols }, (_, i) => Math.round(Math.min(Math.max(ws.getColumn(i + 1).width ?? 10, 4), 80) * 7.5));
    return { name: ws.name, rows, truncated: ws.rowCount > MAX_ROWS, widths };
  });
}

function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function SpreadsheetViewer({ blob, name }: { blob: Blob; name: string }) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    let alive = true;
    setSheets(null); setError(null); setActive(0);
    if (/\.xls$/i.test(name)) { setError('L’ancien format Excel .xls ne peut pas être prévisualisé. Enregistrez-le en .xlsx.'); return; }
    readSpreadsheet(blob, name).then((s) => alive && setSheets(s)).catch(() => alive && setError('Ce classeur n’a pas pu être lu.'));
    return () => { alive = false; };
  }, [blob, name]);
  if (error) return <Unreadable reason={error} />;
  if (!sheets) return <Loading />;
  const sheet = sheets[active];
  const width = Math.max(1, ...sheet.rows.map((r) => r.length));
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto bg-white">
        <table className={clsx('table-sticky border-collapse text-xs', sheet.widths && 'table-fixed')}
          style={sheet.widths ? { width: 40 + Array.from({ length: width }, (_, i) => sheet.widths![i] ?? 75).reduce((a, b) => a + b, 0) } : undefined}>
          {sheet.widths && (
            <colgroup>
              <col style={{ width: 40 }} />
              {Array.from({ length: width }, (_, i) => <col key={i} style={{ width: sheet.widths![i] ?? 75 }} />)}
            </colgroup>
          )}
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-10 border border-slate-200 bg-slate-100" />
              {Array.from({ length: width }, (_, i) => <th key={i} className="border border-slate-200 bg-slate-100 px-2 py-1 font-semibold text-slate-500">{colName(i)}</th>)}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r, i) => (
              <tr key={i}>
                <td className="sticky left-0 border border-slate-200 bg-slate-50 px-1.5 text-right text-slate-400 tabular">{i + 1}</td>
                {Array.from({ length: width }, (_, j) => {
                  const v = r[j];
                  return <td key={j} className={clsx('truncate border border-slate-100 px-2 py-1', typeof v === 'number' && 'text-right tabular')} title={v == null ? undefined : String(v)}>
                    {typeof v === 'number' ? v.toLocaleString('fr-FR') : v}
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {sheet.truncated && <p className="p-3 text-xs text-slate-500">Aperçu limité aux {MAX_ROWS} premières lignes.</p>}
      </div>
      {sheets.length > 1 || sheets[0].name !== 'CSV' ? (
        <div className="flex gap-1 overflow-x-auto border-t border-slate-200 bg-slate-50 px-2 py-1" role="tablist" aria-label="Feuilles">
          {sheets.map((s, i) => (
            <button key={s.name} role="tab" aria-selected={i === active} onClick={() => setActive(i)}
              className={clsx('rounded px-3 py-1 text-xs font-medium whitespace-nowrap cursor-pointer', i === active ? 'bg-white text-brand-800 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white')}>
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WordViewer({ blob, name }: { blob: Blob; name: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setHtml(null); setError(null);
    if (/\.doc$/i.test(name)) { setError('L’ancien format Word .doc ne peut pas être prévisualisé. Enregistrez-le en .docx.'); return; }
    (async () => {
      const mammoth = await import('mammoth/mammoth.browser.js');
      const r = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
      if (alive) setHtml(sanitizeHtml(r.value));
    })().catch(() => alive && setError('Ce document Word n’a pas pu être lu.'));
    return () => { alive = false; };
  }, [blob, name]);
  if (error) return <Unreadable reason={error} />;
  if (html === null) return <Loading />;
  return (
    <div className="h-full overflow-auto bg-slate-200/70 p-4">
      <article className="word-preview mx-auto max-w-3xl bg-white px-10 py-8 text-sm leading-relaxed text-slate-800 shadow-md" dangerouslySetInnerHTML={{ __html: html || '<p><em>Document vide.</em></p>' }} />
    </div>
  );
}

function ImageViewer({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return <div className="flex h-full items-center justify-center overflow-auto bg-slate-200/70 p-4">{url && <img src={url} alt="" className="max-w-full bg-white shadow-md" />}</div>;
}

function TextViewer({ blob }: { blob: Blob }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => { void blob.text().then(setText); }, [blob]);
  if (text === null) return <Loading />;
  return <pre className="h-full overflow-auto whitespace-pre-wrap bg-white p-6 text-xs text-slate-800">{text}</pre>;
}

/** Aperçu d'un fichier du DCE selon son type. */
export function FileViewer({ doc, blob, initialPage }: { doc: DceFile; blob: Blob; initialPage?: number }) {
  switch (doc.kind) {
    case 'pdf': return <PdfViewer blob={blob} initialPage={initialPage} />;
    case 'excel': return <SpreadsheetViewer blob={blob} name={doc.name} />;
    case 'word': return <WordViewer blob={blob} name={doc.name} />;
    case 'image': return <ImageViewer blob={blob} />;
    case 'text': return <TextViewer blob={blob} />;
    default: return <Unreadable reason={`Le format de « ${doc.name} » ne peut pas être affiché dans l’application.`} />;
  }
}
