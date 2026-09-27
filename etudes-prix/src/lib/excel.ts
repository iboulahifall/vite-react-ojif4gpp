import type ExcelJSNamespace from 'exceljs';

/**
 * Charge ExcelJS à la demande. Dans le navigateur, on utilise le bundle « bare » :
 * le bundle standard embarque des polyfills globaux qui perturbent pdf.js.
 */
export async function loadExcelJs(): Promise<typeof ExcelJSNamespace> {
  if (typeof window === 'undefined') return (await import('exceljs')).default;
  const mod = (await import('exceljs/dist/exceljs.bare.min.js')) as unknown as { default?: typeof ExcelJSNamespace } & typeof ExcelJSNamespace;
  return mod.default ?? mod;
}
