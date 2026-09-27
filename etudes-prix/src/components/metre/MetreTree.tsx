import clsx from 'clsx';
import { FAMILIES } from '../../domain/catalog';
import { gapOf, type MetreLine } from '../../domain/metre';
import type { Lot } from '../../domain/types';

export type TreeSelection = 'tous' | 'a-rattacher' | string;

interface Stats { total: number; validated: number; gaps: number; toEstablish: number }

function stats(lines: MetreLine[]): Stats {
  const g = lines.map(gapOf);
  return {
    total: lines.length,
    validated: lines.filter((l) => l.validated).length,
    gaps: g.filter((x) => x.level === 'important').length,
    toEstablish: g.filter((x) => x.level === 'a-etablir').length,
  };
}

function Row({ label, s, active, muted, onClick, indent }: { label: string; s: Stats; active: boolean; muted?: boolean; onClick: () => void; indent?: boolean }) {
  const pct = s.total ? Math.round((s.validated / s.total) * 100) : 0;
  return (
    <button onClick={onClick} aria-current={active || undefined}
      className={clsx('w-full rounded-lg px-2.5 py-1.5 text-left cursor-pointer', indent && 'pl-6', active ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50')}>
      <span className="flex items-center gap-2">
        {indent && <span aria-hidden className="-ml-3 font-mono text-slate-300">├</span>}
        <span className={clsx('flex-1 truncate text-sm', active ? 'font-semibold text-brand-900' : muted ? 'text-slate-400' : 'text-slate-800')}>{label}</span>
        {s.gaps > 0 && <span className="rounded bg-red-100 px-1 text-[11px] font-bold text-red-800" title={`${s.gaps} écart(s) > 10 %`}>▲{s.gaps}</span>}
        {s.toEstablish > 0 && <span className="rounded bg-orange-100 px-1 text-[11px] font-bold text-orange-800" title={`${s.toEstablish} quantité(s) à établir`}>⚠{s.toEstablish}</span>}
        <span className="w-10 text-right text-xs tabular text-slate-500">{s.validated}/{s.total}</span>
      </span>
      {s.total > 0 && (
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-200" aria-hidden>
          <span className={clsx('block h-full', pct === 100 ? 'bg-emerald-500' : 'bg-brand-500')} style={{ width: `${pct}%` }} />
        </span>
      )}
    </button>
  );
}

/** Arborescence des postes CFO / CFA avec avancement de validation par famille. */
export function MetreTree({ lines, lots, families, selected, onSelect }: {
  lines: MetreLine[];
  lots: Lot[];
  families: string[];
  selected: TreeSelection;
  onSelect: (s: TreeSelection) => void;
}) {
  const active = lines.filter((l) => !l.removedFromDpgf);
  const unassigned = active.filter((l) => !l.familyId);
  return (
    <nav aria-label="Postes" className="space-y-3">
      <Row label="Tous les postes" s={stats(active)} active={selected === 'tous'} onClick={() => onSelect('tous')} />
      {(['CFO', 'CFA'] as Lot[]).map((lot) => {
        const fams = FAMILIES.filter((f) => f.lot === lot && (lots.includes(lot) || active.some((l) => l.familyId === f.id)));
        if (!fams.length) return null;
        return (
          <div key={lot}>
            <button onClick={() => onSelect(lot)} className={clsx('mb-0.5 w-full rounded-lg px-2.5 py-1 text-left text-xs font-bold uppercase tracking-wide cursor-pointer',
              selected === lot ? 'bg-brand-50 text-brand-900' : 'text-slate-500 hover:bg-slate-50')}>
              {lot === 'CFO' ? '⚡ CFO' : '📡 CFA'} <span className="font-normal normal-case">({active.filter((l) => FAMILIES.find((f) => f.id === l.familyId)?.lot === lot).length})</span>
            </button>
            {fams.map((f) => {
              const own = active.filter((l) => l.familyId === f.id);
              const inScope = families.includes(f.id);
              return <Row key={f.id} indent label={`${f.label}${!inScope ? ' (hors périmètre)' : ''}`} s={stats(own)} muted={!own.length}
                active={selected === f.id} onClick={() => onSelect(f.id)} />;
            })}
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <Row label="À rattacher à une famille" s={stats(unassigned)} active={selected === 'a-rattacher'} onClick={() => onSelect('a-rattacher')} />
      )}
    </nav>
  );
}
