import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { StudyStatus } from '../domain/types';
import { STAGES, stageIndex } from '../domain/workflow';

/** Workflow horizontal : étapes terminées (✓), étape en cours (mise en évidence), à venir. */
export function WorkflowStepper({ status, onSelect }: { status: StudyStatus; onSelect?: (s: StudyStatus) => void }) {
  const current = stageIndex(status);
  return (
    <ol className="flex w-full items-start overflow-x-auto pb-1" aria-label="Avancement du workflow">
      {STAGES.map((s, i) => {
        const done = i < current || status === 'remise';
        const active = i === current && status !== 'remise';
        const state = done ? 'terminée' : active ? 'en cours' : 'à venir';
        return (
          <li key={s.id} className="relative flex min-w-[88px] flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span aria-hidden className={clsx('absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2', i <= current ? 'bg-brand-600' : 'bg-slate-200')} />
            )}
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(s.id)}
              title={`${s.label} — ${state}`}
              aria-current={active ? 'step' : undefined}
              className={clsx(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ring-4 ring-white transition',
                done && 'bg-brand-700 text-white',
                active && 'bg-amber-400 text-slate-900 scale-110 shadow-md',
                !done && !active && 'border-2 border-slate-300 bg-white text-slate-400',
                onSelect && 'cursor-pointer hover:ring-brand-100',
              )}
            >
              {done ? <Check size={16} strokeWidth={3} /> : i + 1}
            </button>
            <span className={clsx('mt-2 text-xs leading-tight', active ? 'font-bold text-slate-900' : done ? 'font-medium text-slate-700' : 'text-slate-400')}>
              {s.short}
            </span>
            <span className={clsx('text-[10px] uppercase tracking-wide', active ? 'font-semibold text-amber-700' : done ? 'text-brand-700' : 'text-slate-400')}>
              {state}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
