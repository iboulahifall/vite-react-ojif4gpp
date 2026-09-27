import clsx from 'clsx';
import { daysUntil } from '../domain/dates';
import { formatDate, formatDaysLeft } from '../domain/format';

export function DueDate({ iso, done }: { iso: string; done?: boolean }) {
  const d = daysUntil(iso);
  return (
    <span className="flex flex-col leading-tight">
      <span className="tabular text-sm text-slate-900">{formatDate(iso)}</span>
      {!done && (
        <span className={clsx('whitespace-nowrap text-xs font-semibold tabular', d < 0 ? 'text-red-700' : d < 3 ? 'text-red-600' : d < 7 ? 'text-orange-700' : 'text-slate-500')}>
          {d < 0 ? '⛔ ' : d < 7 ? '⏰ ' : ''}{formatDaysLeft(d)}
        </span>
      )}
    </span>
  );
}
