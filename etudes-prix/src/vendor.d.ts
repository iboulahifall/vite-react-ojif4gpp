declare module 'mammoth/mammoth.browser.js' {
  interface Result { value: string; messages: { type: string; message: string }[] }
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<Result>;
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<Result>;
}

declare module 'exceljs/dist/exceljs.bare.min.js';
