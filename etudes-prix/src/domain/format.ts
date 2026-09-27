import { parseISODate } from './dates';

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function formatEuro(n: number): string {
  return eur.format(n);
}

/** 2 480 000 → « 2,48 M€ », 420 000 → « 420 k€ ». */
export function formatEuroCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M€`;
  }
  if (Math.abs(n) >= 10_000) {
    return `${Math.round(n / 1000).toLocaleString('fr-FR')} k€`;
  }
  return formatEuro(n);
}

export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} — ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatDaysLeft(days: number): string {
  if (days < 0) return `En retard de ${-days} j`;
  if (days === 0) return 'Aujourd’hui';
  if (days === 1) return 'Demain';
  return `J-${days}`;
}
