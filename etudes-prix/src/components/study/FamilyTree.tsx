import clsx from 'clsx';
import type { Lot } from '../../domain/types';
import { familiesOfLots } from '../../domain/catalog';

/** Arborescence CFO / CFA des familles de postes, avec cases à cocher. */
export function FamilyTree({ lots, selected, onChange, readOnly }: {
  lots: Lot[];
  selected: string[];
  onChange?: (ids: string[]) => void;
  readOnly?: boolean;
}) {
  const toggle = (id: string) => onChange?.(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {lots.map((lot) => {
        const fams = familiesOfLots([lot]);
        const all = fams.every((f) => selected.includes(f.id));
        return (
          <div key={lot} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <span className="font-bold text-slate-900">{lot === 'CFO' ? '⚡ CFO' : '📡 CFA'} <span className="font-normal text-slate-500">— {fams.filter((f) => selected.includes(f.id)).length}/{fams.length} familles</span></span>
              {!readOnly && (
                <button type="button" className="text-xs font-medium text-brand-700 hover:underline cursor-pointer"
                  onClick={() => onChange?.(all ? selected.filter((id) => !fams.some((f) => f.id === id)) : [...new Set([...selected, ...fams.map((f) => f.id)])])}>
                  {all ? 'Tout décocher' : 'Tout cocher'}
                </button>
              )}
            </div>
            <ul className="px-4 py-2">
              {fams.map((f, i) => {
                const on = selected.includes(f.id);
                return (
                  <li key={f.id} className="relative flex items-start gap-2 py-1.5 pl-5">
                    <span aria-hidden className="absolute left-1 top-0 font-mono text-slate-300">{i === fams.length - 1 ? '└' : '├'}</span>
                    <label className={clsx('flex flex-1 items-start gap-2', !readOnly && 'cursor-pointer')}>
                      <input type="checkbox" checked={on} disabled={readOnly} onChange={() => toggle(f.id)} className="mt-0.5 h-4 w-4 accent-brand-700" />
                      <span>
                        <span className={clsx('block text-sm font-medium', on ? 'text-slate-900' : 'text-slate-400 line-through')}>{f.label}</span>
                        <span className="block text-xs text-slate-500">{f.description}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
