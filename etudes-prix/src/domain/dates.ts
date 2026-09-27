/** Utilitaires de dates en jours calendaires locaux (format AAAA-MM-JJ). */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Nombre de jours entre aujourd'hui et la date (négatif si passée). */
export function daysUntil(iso: string, today = new Date()): number {
  const ms = parseISODate(iso).getTime() - startOfDay(today).getTime();
  return Math.round(ms / 86_400_000);
}

/** Ramène un samedi / dimanche au vendredi précédent. */
export function previousWorkingDay(d: Date): Date {
  const day = d.getDay();
  if (day === 6) return addDays(d, -1);
  if (day === 0) return addDays(d, -2);
  return d;
}
