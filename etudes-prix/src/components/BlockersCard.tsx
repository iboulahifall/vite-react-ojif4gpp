import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, OctagonAlert } from 'lucide-react';
import type { Study } from '../domain/types';
import { studyBlockers } from '../domain/blockers';
import { Card, CardHeader } from './ui/Card';
import { RiskBadge } from './ui/Badges';

/** « Qu'est-ce qui bloque ? » : liste cliquable des blocages de l'étude. */
export function BlockersCard({ study }: { study: Study }) {
  const blockers = studyBlockers(study);
  return (
    <Card>
      <CardHeader icon={<OctagonAlert size={18} className={blockers.length ? 'text-red-600' : 'text-emerald-600'} />} title="Ce qui bloque"
        subtitle={blockers.length ? `${blockers.filter((b) => b.level === 'critique').length} critique(s) · ${blockers.filter((b) => b.level === 'important').length} important(s)` : undefined} />
      {blockers.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-emerald-800"><CheckCircle2 size={16} /> Aucun blocage identifié.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
          {blockers.map((b) => (
            <li key={b.id}>
              <Link to={b.to} className="flex items-start gap-3 px-5 py-2.5 hover:bg-slate-50">
                <RiskBadge level={b.level} compact />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">{b.label}</span>
                  <span className="block truncate text-xs text-slate-500">{b.detail}</span>
                </span>
                <ArrowRight size={14} className="mt-1 shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
