import clsx from 'clsx';
import type { SourceStatus } from '../../domain/chiffrage';

const STYLE: Record<SourceStatus | 'manquant', { cls: string; text: string }> = {
  confirme: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', text: '🟢 Confirmé' },
  'a-confirmer': { cls: 'bg-orange-50 text-orange-800 ring-orange-200', text: '🟠 À confirmer' },
  estime: { cls: 'bg-yellow-50 text-yellow-800 ring-yellow-300', text: '🟡 Estimé' },
  manquant: { cls: 'bg-red-50 text-red-800 ring-red-200', text: '🔴 Manquant' },
};

/** Statut d'un prix : pastille + texte. */
export function SourceBadge({ status }: { status: SourceStatus | 'manquant' }) {
  const s = STYLE[status];
  return <span className={clsx('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', s.cls)}>{s.text}</span>;
}
