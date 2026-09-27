import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface Crumb { label: string; to?: string }

/** En-tête de page : fil d'Ariane (« Où suis-je ? »), titre et actions. */
export function PageHeader({ title, subtitle, crumbs, actions, icon }: { title: ReactNode; subtitle?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="no-print flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Fil d’Ariane" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} aria-hidden />}
                {c.to ? <Link to={c.to} className="hover:text-brand-700 hover:underline">{c.label}</Link> : <span className="text-slate-700">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
          {icon && <span className="text-brand-700">{icon}</span>}
          <span className="min-w-0">{title}</span>
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
