import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, BarChart3, Calculator, Factory, FileText, HelpCircle, Ruler, SearchCheck } from 'lucide-react';
import type { Study } from '../domain/types';
import { dceCompleteness } from '../domain/documents';
import { summarize } from '../domain/analysis/summary';
import { metreSummary } from '../domain/metre';
import { consultationSummary } from '../domain/consultations';
import { buildUp } from '../domain/chiffrage';
import { questionSummary, riskSummary } from '../domain/risks';
import { formatEuroCompact } from '../domain/format';
import { isReviewStale, scoreOf } from '../domain/review';

/** Barre des modules d'une étude, avec un état court pour chacun. */
export function StudyModulesNav({ study }: { study: Study }) {
  const dce = dceCompleteness(study);
  const a = study.analysis ? summarize(study.analysis, study.analysisDecisions) : null;
  const m = metreSummary(study.metre);
  const c = consultationSummary(study.consultations);
  const b = study.chiffrage.lines.length ? buildUp(study.metre, study.chiffrage) : null;
  const r = riskSummary(study.risks);
  const q = questionSummary(study.questions);
  const rv = study.review ? scoreOf(study.review.checks, study.reviewJustifications) : null;
  const rvStale = isReviewStale(study);
  const items = [
    { to: 'dce', label: 'DCE', Icon: FileText, state: `${study.documents.length} fichier(s)`, warn: dce.missing.length > 0 },
    { to: 'analyse', label: 'Analyse', Icon: BarChart3, state: a ? `${a.critical} critique(s)` : 'à lancer', warn: !!a?.critical },
    { to: 'metre', label: 'Métré', Icon: Ruler, state: m.total ? `${Math.round((m.validated / m.total) * 100)} % validé` : 'à créer', warn: m.majorGaps > 0 },
    { to: 'consultations', label: 'Consultations', Icon: Factory, state: c.consultations ? `${c.received}/${c.requests} offres` : 'aucune', warn: c.late > 0 },
    { to: 'chiffrage', label: 'Chiffrage', Icon: Calculator, state: b ? formatEuroCompact(b.salePrice) : 'à faire', warn: !!b?.missing },
    { to: 'risques', label: 'Risques', Icon: AlertTriangle, state: study.risks.length ? `${r.critical} critique(s)` : 'aucun', warn: r.critical > 0 },
    { to: 'questions', label: 'Questions', Icon: HelpCircle, state: study.questions.length ? `${q.open} ouverte(s)` : 'aucune', warn: q.late > 0 },
    { to: 'revue', label: 'Revue', Icon: SearchCheck, state: rv ? (rvStale ? `${rv.score} % · à relancer` : `${rv.score} % · ${rv.blocking} bloquant(s)`) : 'à lancer', warn: !!rv && (rv.blocking > 0 || rvStale) },
  ];
  return (
    <nav aria-label="Modules de l’étude" className="no-print grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-8">
      {items.map(({ to, label, Icon, state, warn }) => (
        <NavLink key={to} to={`/etudes/${study.id}/${to}`}
          className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition hover:border-brand-300 hover:shadow-md">
          <span className="rounded-lg bg-brand-50 p-1.5 text-brand-700 group-hover:bg-brand-100"><Icon size={16} /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">{label}</span>
            <span className={clsx('block truncate text-xs', warn ? 'font-semibold text-orange-700' : 'text-slate-500')}>{warn && '⚠ '}{state}</span>
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
