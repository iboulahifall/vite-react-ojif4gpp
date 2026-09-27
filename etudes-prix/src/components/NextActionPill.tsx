import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import type { NextAction } from '../domain/workflow';

const TONE = {
  danger: 'bg-red-600 text-white',
  warning: 'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300',
  info: 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200',
  success: 'bg-emerald-600 text-white',
};

export function NextActionPill({ action }: { action: NextAction }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap', TONE[action.tone])} title={action.reason}>
      {action.label} <ArrowRight size={12} aria-hidden />
    </span>
  );
}
