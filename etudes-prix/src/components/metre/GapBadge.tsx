import clsx from 'clsx';
import { formatGap, type Gap } from '../../domain/metre';

/** Écart visuel : symbole + texte + couleur (jamais la couleur seule). */
export function GapBadge({ gap }: { gap: Gap }) {
  const style = {
    aucun: 'text-emerald-700',
    mineur: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
    important: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200',
    'sans-dpgf': 'text-slate-500',
    'a-etablir': 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-200',
  }[gap.level];
  const icon = { aucun: '✓', mineur: gap.abs! > 0 ? '▲' : '▼', important: gap.abs !== null && gap.abs > 0 ? '▲' : '▼', 'sans-dpgf': '', 'a-etablir': '⚠' }[gap.level];
  const title = {
    aucun: 'Identique à la DPGF',
    mineur: 'Écart inférieur à 10 %',
    important: 'Écart supérieur à 10 %',
    'sans-dpgf': 'Pas de quantité DPGF',
    'a-etablir': 'Quantité à établir',
  }[gap.level];
  return (
    <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold tabular', style)} title={title}>
      {icon && <span aria-hidden>{icon}</span>}
      {gap.level === 'sans-dpgf' ? 'hors DPGF' : formatGap(gap)}
    </span>
  );
}
