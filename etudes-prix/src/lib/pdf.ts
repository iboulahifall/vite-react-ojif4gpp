import type { PDFDocumentProxy } from 'pdfjs-dist';

// Build « legacy » : compatible avec les navigateurs qui n'ont pas encore les API JS les plus récentes.
let loader: Promise<typeof import('pdfjs-dist')> | null = null;

/** Charge pdf.js à la demande (le bundle principal reste léger). */
export function loadPdfJs() {
  if (!loader) {
    loader = (async () => {
      const [lib, worker] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
      ]);
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    })();
  }
  return loader;
}

/** Ouvre un PDF ; `close` libère le worker associé. */
export async function openPdf(blob: Blob): Promise<{ doc: PDFDocumentProxy; close: () => Promise<void> }> {
  const lib = await loadPdfJs();
  const task = lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const doc = await task.promise;
  return { doc, close: () => task.destroy() };
}
