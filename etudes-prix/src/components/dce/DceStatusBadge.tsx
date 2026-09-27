import clsx from 'clsx';
import type { CategoryState } from '../../domain/documents';

const STYLE: Record<CategoryState, { cls: string; text: string }> = {
  imported: { cls: 'bg-emerald-100 text-emerald-800', text: '✓ Importé' },
  declared: { cls: 'bg-sky-100 text-sky-800', text: '◐ Reçu, non importé' },
  missing: { cls: 'bg-red-100 text-red-800', text: '⚠ Manquant' },
  na: { cls: 'bg-slate-200 text-slate-600', text: '— Sans objet' },
};

export function DceStatusBadge({ state }: { state: CategoryState }) {
  const s = STYLE[state];
  return <span className={clsx('whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold', s.cls)}>{s.text}</span>;
}
