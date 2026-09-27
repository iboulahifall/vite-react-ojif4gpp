import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Circle, MessageSquare, Ruler } from 'lucide-react';
import { effectiveQty, formatQty, gapOf, isProposed, type MetreLine } from '../../domain/metre';
import { FAMILIES } from '../../domain/catalog';
import { GapBadge } from './GapBadge';
import { QtyInput } from './QtyInput';

type SortKey = 'ref' | 'designation' | 'unit' | 'dpgf' | 'calc' | 'retenu' | 'ecart' | 'etat';

const COLUMNS: { key: SortKey; label: string; width: number; align?: 'right' | 'center' }[] = [
  { key: 'ref', label: 'Poste', width: 76 },
  { key: 'designation', label: 'Désignation', width: 250 },
  { key: 'unit', label: 'Unité', width: 60, align: 'center' },
  { key: 'dpgf', label: 'DPGF', width: 76, align: 'right' },
  { key: 'calc', label: 'Calculé', width: 104, align: 'right' },
  { key: 'retenu', label: 'Retenu', width: 100, align: 'right' },
  { key: 'ecart', label: 'Écart', width: 118, align: 'right' },
  { key: 'etat', label: 'État', width: 104, align: 'center' },
];

const levelRank = { important: 0, 'a-etablir': 1, mineur: 2, 'sans-dpgf': 3, aucun: 4 };

function sortValue(l: MetreLine, k: SortKey): string | number {
  switch (k) {
    case 'ref': return l.ref;
    case 'designation': return l.designation.toLowerCase();
    case 'unit': return l.unit;
    case 'dpgf': return l.dpgfQty ?? -1;
    case 'calc': return l.calcQty ?? -1;
    case 'retenu': return effectiveQty(l) ?? -1;
    case 'ecart': { const g = gapOf(l); return levelRank[g.level] * 1e6 - Math.abs(g.pct ?? 0) * 1000; }
    case 'etat': return l.validated ? 1 : 0;
  }
}

/** Compare « 13.1.10 » après « 13.1.9 ». */
function natural(a: string, b: string): number {
  return a.localeCompare(b, 'fr', { numeric: true });
}

/** Tableau de métré : tri, colonnes redimensionnables, saisie en ligne, validation. */
export function MetreTable({ lines, locked, showFamily, revision = 0, onCommit, onToggleValidated, onOpen }: {
  lines: MetreLine[];
  /** Change quand une saisie est annulée : les cellules reprennent la valeur enregistrée. */
  revision?: number;
  locked?: boolean;
  showFamily?: boolean;
  onCommit: (line: MetreLine, field: 'calcQty' | 'retainedQty', value: number | null) => void;
  onToggleValidated: (line: MetreLine) => void;
  onOpen: (line: MetreLine) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'ref', dir: 1 });
  const [widths, setWidths] = useState(() => COLUMNS.map((c) => c.width));
  const drag = useRef<{ i: number; x: number; w: number } | null>(null);

  const rows = useMemo(() => [...lines].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    const c = typeof va === 'string' && typeof vb === 'string' ? natural(va, vb) : (va as number) - (vb as number);
    return c * sort.dir || natural(a.ref, b.ref);
  }), [lines, sort]);

  const startResize = (i: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { i, x: e.clientX, w: widths[i] };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      setWidths((ws) => ws.map((w, j) => (j === d.i ? Math.max(50, d.w + ev.clientX - d.x) : w)));
    };
    const up = () => { drag.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const total = widths.reduce((a, b) => a + b, 0) + 44;
  const validated = lines.filter((l) => l.validated).length;

  return (
    <div className="max-h-[calc(100vh-15rem)] min-h-64 overflow-auto rounded-b-xl">
      <table className="table-sticky table-fixed border-collapse text-sm" style={{ width: total, minWidth: '100%' }}>
        <colgroup>
          {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
          <col style={{ width: 44 }} />
        </colgroup>
        <thead>
          <tr className="[&>th]:bg-slate-100">
            {COLUMNS.map((c, i) => {
              const active = sort.key === c.key;
              return (
                <th key={c.key} className="relative border-b border-slate-200 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 select-none"
                  aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} style={{ textAlign: c.align ?? 'left' }}>
                  <button className="inline-flex items-center gap-1 uppercase cursor-pointer hover:text-slate-900"
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 1 ? -1 : 1 }))}>
                    {c.label}
                    {active ? (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
                  </button>
                  <span onPointerDown={(e) => startResize(i, e)} role="separator" aria-orientation="vertical" title="Glisser pour redimensionner"
                    className="absolute right-0 top-1 bottom-1 w-1.5 cursor-col-resize rounded hover:bg-brand-300" />
                </th>
              );
            })}
            <th className="border-b border-slate-200" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((l) => {
            const g = gapOf(l);
            const fam = FAMILIES.find((f) => f.id === l.familyId);
            return (
              <tr key={l.id} className={clsx('group', l.validated ? 'bg-emerald-50/40' : g.level === 'important' ? 'bg-red-50/30' : 'bg-white', l.removedFromDpgf && 'opacity-60')}>
                <td className="truncate px-2 py-1.5 tabular text-slate-600" title={l.ref}>{l.ref || <span className="text-slate-300">—</span>}</td>
                <td className="px-2 py-1.5">
                  <button onClick={() => onOpen(l)} className="block w-full truncate text-left text-slate-900 hover:text-brand-700 hover:underline cursor-pointer" title={l.designation}>
                    {l.designation}
                  </button>
                  <span className="flex items-center gap-1.5 truncate text-[11px] text-slate-500">
                    {showFamily && <span>{fam ? `${fam.lot} · ${fam.label}` : '⚠ à rattacher'}</span>}
                    {l.source === 'manuel' && <span className="rounded bg-violet-100 px-1 font-semibold text-violet-800">ajoutée</span>}
                    {l.removedFromDpgf && <span className="rounded bg-slate-200 px-1 font-semibold text-slate-700">retirée de la DPGF</span>}
                    {l.comment && <span className="flex items-center gap-0.5" title={l.comment}><MessageSquare size={11} /> {l.comment}</span>}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center text-slate-700">{l.unit}</td>
                <td className="px-2 py-1.5 text-right tabular text-slate-700">{formatQty(l.dpgfQty)}</td>
                <td className="px-2 py-1">
                  {l.calcDetail.length > 0 ? (
                    <button onClick={() => onOpen(l)} className="flex w-full items-center justify-end gap-1 rounded-md px-2 py-1 text-right tabular text-slate-900 hover:bg-slate-100 cursor-pointer" title="Voir le détail du calcul">
                      <Ruler size={12} className="text-brand-600" /> {formatQty(l.calcQty)}
                    </button>
                  ) : (
                    <QtyInput key={`c${revision}`} value={l.calcQty} disabled={locked} label={`Quantité calculée ${l.ref}`} onCommit={(v) => onCommit(l, 'calcQty', v)} />
                  )}
                  {l.retainedQty !== null && l.calcQty !== null && l.calcQty !== l.retainedQty && (
                    <span className="block pr-2 text-right text-[11px] font-semibold text-orange-700" title="La quantité calculée diffère de la quantité retenue">≠ retenu</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  <QtyInput key={`r${revision}`} value={l.retainedQty} placeholder={effectiveQty(l)} proposed={isProposed(l)} disabled={locked}
                    label={`Quantité retenue ${l.ref}`} onCommit={(v) => onCommit(l, 'retainedQty', v)} />
                </td>
                <td className="px-2 py-1.5 text-right"><GapBadge gap={g} /></td>
                <td className="px-2 py-1.5 text-center">
                  <button disabled={locked || (!l.validated && effectiveQty(l) === null)} onClick={() => onToggleValidated(l)}
                    title={l.validated ? `Validée par ${l.validatedBy ?? '—'} — cliquer pour dévalider` : effectiveQty(l) === null ? 'Saisir une quantité avant de valider' : 'Valider la quantité retenue'}
                    className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                      l.validated ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-brand-100 hover:text-brand-800')}>
                    {l.validated ? <><CheckCircle2 size={13} /> Validée</> : <><Circle size={13} /> Valider</>}
                  </button>
                </td>
                <td className="px-1 text-center">
                  <button onClick={() => onOpen(l)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer" aria-label={`Détail de ${l.ref || l.designation}`} title="Détail, commentaire, historique">⋯</button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">Aucune ligne dans cette sélection.</td></tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="sticky bottom-0 bg-slate-50 text-xs font-semibold text-slate-700">
            <tr>
              <td colSpan={9} className="border-t-2 border-slate-200 px-3 py-2">
                {rows.length} ligne(s) · {validated} validée(s) · {rows.filter((l) => gapOf(l).level === 'important').length} écart(s) &gt; 10 % · {rows.filter((l) => gapOf(l).level === 'a-etablir').length} à établir
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
