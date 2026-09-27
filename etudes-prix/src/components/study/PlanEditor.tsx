import clsx from 'clsx';
import type { PlanTask } from '../../domain/types';
import { daysUntil } from '../../domain/dates';
import { formatDate, formatDaysLeft } from '../../domain/format';
import { stageOf } from '../../domain/workflow';

export function PlanEditor({ plan, onChange, editDates = true, currentStage }: {
  plan: PlanTask[];
  onChange?: (plan: PlanTask[]) => void;
  editDates?: boolean;
  currentStage?: PlanTask['stage'];
}) {
  const update = (id: string, patch: Partial<PlanTask>) => onChange?.(plan.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const outOfOrder = (i: number) => i > 0 && plan[i].dueDate < plan[i - 1].dueDate;
  return (
    <ol className="space-y-2">
      {plan.map((t, i) => {
        const d = daysUntil(t.dueDate);
        const late = !t.done && d < 0;
        const current = currentStage === t.stage;
        return (
          <li key={t.id} className={clsx('flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3',
            t.done ? 'border-emerald-200 bg-emerald-50/50' : current ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white')}>
            <label className="flex flex-1 min-w-56 cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={t.done} disabled={!onChange}
                onChange={(e) => update(t.id, { done: e.target.checked })} aria-label={`Marquer « ${t.label} » comme terminée`} />
              <span>
                <span className={clsx('block text-sm font-semibold', t.done ? 'text-slate-500 line-through' : 'text-slate-900')}>{i + 1}. {t.label}</span>
                <span className="block text-xs text-slate-500">
                  Étape : {stageOf(t.stage).label}{current && <strong className="ml-1 text-amber-700">· en cours</strong>}
                </span>
              </span>
            </label>
            <div className="flex items-center gap-3">
              {editDates && onChange ? (
                <input type="date" value={t.dueDate} onChange={(e) => e.target.value && update(t.id, { dueDate: e.target.value })}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm" aria-label={`Échéance de « ${t.label} »`} />
              ) : (
                <span className="text-sm tabular text-slate-700">{formatDate(t.dueDate)}</span>
              )}
              <span className={clsx('w-28 text-right text-xs font-semibold', t.done ? 'text-emerald-700' : late ? 'text-red-700' : d < 3 ? 'text-orange-700' : 'text-slate-500')}>
                {t.done ? '✓ Terminé' : late ? `⛔ ${formatDaysLeft(d)}` : formatDaysLeft(d)}
              </span>
            </div>
            {outOfOrder(i) && <p className="w-full text-xs font-medium text-orange-700">⚠ Cette tâche est datée avant la précédente.</p>}
          </li>
        );
      })}
    </ol>
  );
}
