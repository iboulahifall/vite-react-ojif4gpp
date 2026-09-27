import clsx from 'clsx';

export function ProgressBar({ value, size = 'md', showLabel = true, className }: { value: number; size?: 'sm' | 'md' | 'lg'; showLabel?: boolean; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const color = v >= 90 ? 'bg-emerald-500' : v >= 50 ? 'bg-brand-600' : 'bg-sky-500';
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className={clsx('flex-1 overflow-hidden rounded-full bg-slate-200', size === 'sm' ? 'h-1.5' : size === 'md' ? 'h-2' : 'h-3.5')}
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Avancement ${v} %`}
      >
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${v}%` }} />
      </div>
      {showLabel && <span className="w-10 text-right text-sm font-semibold tabular text-slate-700">{v} %</span>}
    </div>
  );
}
