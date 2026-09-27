import clsx from 'clsx';
import { CheckCircle2, CircleDashed, MinusCircle } from 'lucide-react';
import type { DceDocDeclaration, Lot } from '../../domain/types';
import { dceDocInfo, isDocRelevant } from '../../domain/catalog';

export function DceChecklist({ docs, lots, onToggle, readOnly }: {
  docs: DceDocDeclaration[];
  lots: Lot[];
  onToggle?: (type: DceDocDeclaration['type']) => void;
  readOnly?: boolean;
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {docs.map((d) => {
        const info = dceDocInfo(d.type);
        const relevant = isDocRelevant(d.type, lots);
        const state = !relevant ? 'na' : d.received ? 'ok' : 'missing';
        return (
          <li key={d.type}>
            <button
              type="button"
              disabled={readOnly || !relevant}
              onClick={() => onToggle?.(d.type)}
              aria-pressed={d.received}
              className={clsx('flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                state === 'ok' && 'border-emerald-300 bg-emerald-50/60',
                state === 'missing' && 'border-slate-200 bg-white',
                state === 'na' && 'border-dashed border-slate-200 bg-slate-50 opacity-70',
                !readOnly && relevant && 'cursor-pointer hover:border-brand-400')}
            >
              {state === 'ok' ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                : state === 'na' ? <MinusCircle size={20} className="mt-0.5 shrink-0 text-slate-400" />
                : <CircleDashed size={20} className="mt-0.5 shrink-0 text-slate-400" />}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                  📄 {info.label}
                  <span className={clsx('rounded px-1.5 py-0.5 text-[11px] font-semibold',
                    state === 'ok' ? 'bg-emerald-100 text-emerald-800' : state === 'na' ? 'bg-slate-200 text-slate-600' : info.essential ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800')}>
                    {state === 'ok' ? 'Reçu' : state === 'na' ? 'Sans objet' : info.essential ? 'Manquant — indispensable' : 'Manquant'}
                  </span>
                </span>
                <span className="block text-xs text-slate-500">{info.role}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
