import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { InfoTip } from './ui/Help';

const TONES = {
  brand: 'bg-brand-50 text-brand-700',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  violet: 'bg-violet-50 text-violet-700',
};

export function KpiCard({ label, value, icon, tone, hint, help, to }: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone: keyof typeof TONES;
  hint?: ReactNode;
  help?: string;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label} {help && <InfoTip text={help} />}
        </span>
        <span className={clsx('rounded-lg p-2', TONES[tone])}>{icon}</span>
      </div>
      <div className="mt-1 text-3xl font-bold tabular tracking-tight text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </>
  );
  const cls = 'block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition';
  return to ? (
    <Link to={to} className={clsx(cls, 'hover:border-brand-300 hover:shadow-md')}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
