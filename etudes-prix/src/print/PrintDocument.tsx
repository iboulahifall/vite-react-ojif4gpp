import type { ReactNode } from 'react';
import { useStore } from '../state/store';

/**
 * Mise en page dédiée à l'impression (A4) : en-tête et pied de page répétés
 * sur chaque page grâce à thead / tfoot ; numéro de page via @page.
 * Invisible à l'écran.
 */
export function PrintDocument({ title, reference, version = 'V1', demo, children }: {
  title: string;
  reference?: string;
  version?: string;
  demo?: boolean;
  children: ReactNode;
}) {
  const { settings } = useStore();
  const printedAt = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <div className="print-only text-[10.5pt] text-black">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <td>
              <div className="mb-4 flex items-end justify-between border-b-2 border-slate-800 pb-2">
                <div>
                  <div className="text-[9pt] uppercase tracking-wider text-slate-600">{settings.companyName}</div>
                  <div className="text-[13pt] font-bold">{title}</div>
                </div>
                <div className="text-right text-[9pt] text-slate-700">
                  {reference && <div>Réf. affaire : <strong>{reference}</strong></div>}
                  <div>Version : {version}</div>
                </div>
              </div>
              {demo && (
                <div className="mb-3 border border-fuchsia-400 px-2 py-1 text-center text-[9pt] font-bold uppercase text-fuchsia-800">
                  Données de démonstration — document fictif
                </div>
              )}
            </td>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td>
              <div className="mt-4 flex justify-between border-t border-slate-400 pt-1.5 text-[8.5pt] text-slate-600">
                <span>Imprimé le {printedAt} par {settings.userName}</span>
                <span>{reference ?? 'Portefeuille des études'} · {version}</span>
              </div>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr><td>{children}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function PrintSection({ title, children, breakBefore }: { title: string; children: ReactNode; breakBefore?: boolean }) {
  return (
    <section className={breakBefore ? 'print-break-before mb-5' : 'mb-5'}>
      <h2 style={{ breakAfter: 'avoid' }} className="mb-2 border-b border-slate-300 pb-1 text-[11.5pt] font-bold uppercase tracking-wide text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

export function PrintTable({ head, rows, align, foot }: { head: string[]; rows: ReactNode[][]; align?: ('left' | 'right' | 'center')[]; foot?: ReactNode[] }) {
  return (
    <table className="w-full border-collapse text-[9pt]">
      <thead>
        <tr>{head.map((h, i) => <th key={i} className="border border-slate-400 bg-slate-100 px-1.5 py-1" style={{ textAlign: align?.[i] ?? 'left' }}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} className="border border-slate-300 px-1.5 py-1 align-top tabular" style={{ textAlign: align?.[j] ?? 'left' }}>{c}</td>)}</tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr>{foot.map((c, j) => <td key={j} className="border border-slate-400 bg-slate-50 px-1.5 py-1 font-bold tabular" style={{ textAlign: align?.[j] ?? 'left' }}>{c}</td>)}</tr>
        </tfoot>
      )}
    </table>
  );
}
