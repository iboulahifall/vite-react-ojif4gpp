import { loadExcelJs } from './excel';
import type { DceFile } from '../domain/types';
import { openPdf } from './pdf';

export type FileFacts = Pick<DceFile, 'pages' | 'sheets' | 'words'>;

/** Informations lues dans le fichier après import (pages, feuilles, mots). Silencieux en cas d'échec. */
export async function inspectFile(blob: Blob, kind: DceFile['kind'], name: string): Promise<FileFacts> {
  try {
    if (kind === 'pdf') {
      const { doc, close } = await openPdf(blob);
      const pages = doc.numPages;
      await close();
      return { pages };
    }
    if (kind === 'excel' && /\.xlsx$|\.xlsm$/i.test(name)) {
      const ExcelJS = await loadExcelJs();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await blob.arrayBuffer());
      return { sheets: wb.worksheets.length };
    }
    if (kind === 'word' && /\.docx$/i.test(name)) {
      const mammoth = await import('mammoth/mammoth.browser.js');
      const { value } = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() });
      return { words: value.split(/\s+/).filter(Boolean).length };
    }
  } catch {
    /* fichier illisible : l'aperçu l'indiquera */
  }
  return {};
}
