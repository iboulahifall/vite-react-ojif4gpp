import clsx from 'clsx';
import { AlertOctagon, AlertTriangle, CheckCircle2, Eye, FlaskConical } from 'lucide-react';
import type { RiskLevel, StudyStatus } from '../../domain/types';
import { RISK_LABELS } from '../../domain/catalog';
import { stageOf, stageIndex } from '../../domain/workflow';

/** Niveau de risque : toujours icône + texte + couleur (jamais la couleur seule). */
const RISK_STYLE: Record<RiskLevel, { cls: string; Icon: typeof AlertOctagon }> = {
  critique: { cls: 'bg-red-50 text-red-800 ring-red-200', Icon: AlertOctagon },
  important: { cls: 'bg-orange-50 text-orange-800 ring-orange-200', Icon: AlertTriangle },
  surveiller: { cls: 'bg-yellow-50 text-yellow-800 ring-yellow-300', Icon: Eye },
  ok: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icon: CheckCircle2 },
};

export function RiskBadge({ level, label, compact }: { level: RiskLevel; label?: string; compact?: boolean }) {
  const { cls, Icon } = RISK_STYLE[level];
  const text = label ?? RISK_LABELS[level];
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', cls)}
      title={text}
    >
      <Icon size={13} aria-hidden />
      {compact ? <span className="sr-only">{text}</span> : text}
    </span>
  );
}

const STATUS_STYLE = [
  'bg-sky-50 text-sky-800 ring-sky-200',
  'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'bg-violet-50 text-violet-800 ring-violet-200',
  'bg-blue-50 text-blue-800 ring-blue-200',
  'bg-amber-50 text-amber-800 ring-amber-200',
  'bg-teal-50 text-teal-800 ring-teal-200',
  'bg-slate-100 text-slate-700 ring-slate-300',
];

export function StatusBadge({ status }: { status: StudyStatus }) {
  const i = stageIndex(status);
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset whitespace-nowrap', STATUS_STYLE[i])}>
      <span className="tabular">{i + 1}</span>
      <span aria-hidden>·</span>
      {stageOf(status).short}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-md bg-fuchsia-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-800 ring-1 ring-inset ring-fuchsia-200 whitespace-nowrap', className)}>
      <FlaskConical size={12} aria-hidden /> Démo
    </span>
  );
}

export function Tag({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'brand' }) {
  return (
    <span className={clsx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
      tone === 'brand' ? 'bg-brand-50 text-brand-800 ring-brand-200' : 'bg-slate-50 text-slate-700 ring-slate-200')}>
      {children}
    </span>
  );
}
