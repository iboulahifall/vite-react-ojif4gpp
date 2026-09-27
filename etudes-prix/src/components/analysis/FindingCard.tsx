import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleSlash, FileSearch, HelpCircle, RotateCcw } from 'lucide-react';
import type { Finding, FindingDecision, FindingStatus } from '../../domain/analysis/types';
import { sourceLabel } from '../../domain/analysis/analyse';
import { formatDateTime } from '../../domain/format';
import { RiskBadge, Tag } from '../ui/Badges';
import { Button } from '../ui/Button';

export const CATEGORY_LABELS: Record<Finding['category'], string> = {
  clause: 'Clause',
  ecart: 'Écart CCTP / DPGF',
  quantite: 'Quantité',
  perimetre: 'Périmètre',
  document: 'Document',
};

export function FindingCard({ finding, decision, studyId, locked, onDecide }: {
  finding: Finding;
  decision?: FindingDecision;
  studyId: string;
  locked?: boolean;
  onDecide: (status: FindingStatus) => void;
}) {
  const status = decision?.status ?? 'ouvert';
  const s = finding.source;
  const link = s ? `/etudes/${studyId}/dce?doc=${encodeURIComponent(s.docId)}${s.page ? `&page=${s.page}` : ''}` : null;
  return (
    <article className={clsx('rounded-xl border bg-white p-4 transition',
      status === 'ouvert' ? (finding.level === 'critique' ? 'border-red-200' : 'border-slate-200') : 'border-slate-200 bg-slate-50 opacity-80')}>
      <div className="flex flex-wrap items-start gap-2">
        {status === 'ouvert'
          ? <RiskBadge level={finding.level === 'critique' ? 'critique' : 'important'} label={finding.level === 'critique' ? 'Critique' : 'À vérifier'} />
          : status === 'traite'
            ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200"><CheckCircle2 size={13} /> Traité</span>
            : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-300"><CircleSlash size={13} /> Écarté</span>}
        <Tag>{CATEGORY_LABELS[finding.category]}</Tag>
        <h3 className={clsx('min-w-0 flex-1 basis-60 font-semibold text-slate-900', status !== 'ouvert' && 'line-through decoration-slate-400')}>{finding.title}</h3>
      </div>
      <p className="mt-1.5 text-sm text-slate-700">{finding.detail}</p>
      {finding.excerpt && (
        <blockquote className="mt-2 border-l-4 border-slate-200 pl-3 text-sm italic text-slate-600">« {finding.excerpt} »</blockquote>
      )}
      {finding.question && status === 'ouvert' && (
        <p className="mt-2 flex gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950">
          <HelpCircle size={16} className="mt-0.5 shrink-0 text-sky-700" /> <span><strong>Question proposée :</strong> {finding.question}</span>
        </p>
      )}
      {decision && (
        <p className="mt-2 text-xs text-slate-500">{status === 'traite' ? 'Traité' : 'Écarté'} par {decision.by} le {formatDateTime(decision.at)}{decision.comment && ` — ${decision.comment}`}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {link && (
          <Link to={link} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            <FileSearch size={14} /> {sourceLabel(s)}
          </Link>
        )}
        <span className="flex-1" />
        {!locked && (status === 'ouvert' ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => onDecide('ecarte')}>Écarter</Button>
            <Button size="sm" variant="secondary" icon={<CheckCircle2 size={14} />} onClick={() => onDecide('traite')}>Marquer traité</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => onDecide('ouvert')}>Rouvrir</Button>
        ))}
      </div>
    </article>
  );
}
