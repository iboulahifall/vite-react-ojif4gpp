import { useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Maximize, X } from 'lucide-react';
import { useStore } from '../state/store';
import { isActive, nextAction, stageOf, STAGES, stageIndex } from '../domain/workflow';
import { amountOf, sortByPriority } from '../domain/kpi';
import { isQuestionOpen, isRiskActive, questionCode, questionSummary, riskCode, riskSummary } from '../domain/risks';
import { studyBlockers } from '../domain/blockers';
import { daysUntil } from '../domain/dates';
import { formatDate, formatEuro } from '../domain/format';

/**
 * Mode présentation (réunion, vidéoprojecteur) : une étude par écran, en grand —
 * projet, montant, avancement, risques, questions, prochaines actions.
 * Flèches ← → pour changer d'étude, Échap pour quitter.
 */
export function PresentationPage() {
  const { id } = useParams();
  const { studies } = useStore();
  const navigate = useNavigate();
  const list = useMemo(() => {
    const active = sortByPriority(studies);
    const current = studies.find((s) => s.id === id);
    return current && !isActive(current) ? [...active, current] : active;
  }, [studies, id]);
  const idx = Math.max(0, list.findIndex((s) => s.id === id));
  const s = list[idx];

  const go = useCallback((d: number) => {
    if (!list.length) return;
    navigate(`/presentation/${list[(idx + d + list.length) % list.length].id}`, { replace: true });
  }, [list, idx, navigate]);
  const quit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    navigate(s ? `/etudes/${s.id}` : '/');
  }, [navigate, s]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape' && !document.fullscreenElement) quit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, quit]);

  if (!s) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <p className="text-3xl font-bold">Aucune étude en cours à présenter.</p>
        <Link to="/" className="text-xl text-sky-300 underline">Retour au tableau de bord</Link>
      </div>
    );
  }

  const na = nextAction(s);
  const blockers = studyBlockers(s).slice(0, 3);
  const r = riskSummary(s.risks);
  const q = questionSummary(s.questions);
  const risks = s.risks.filter((x) => isRiskActive(x) && x.level !== 'surveiller').sort((a, b) => (a.level === b.level ? (b.amount ?? 0) - (a.amount ?? 0) : a.level === 'critique' ? -1 : 1)).slice(0, 3);
  const questions = s.questions.filter(isQuestionOpen).sort((a, b) => Number(b.blocking) - Number(a.blocking)).slice(0, 3);
  const days = daysUntil(s.dueDate);
  const critical = s.risks.length ? r.critical : s.indicators.criticalRisks;
  const openQ = s.questions.length ? q.open : s.indicators.openQuestions;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 px-10 py-6 text-white">
      <header className="flex items-center gap-3 text-lg text-slate-300">
        <span className="font-semibold">📺 Mode présentation</span>
        {s.isDemo && <span className="rounded bg-fuchsia-600 px-2 py-0.5 text-sm font-bold uppercase text-white">Démo — données fictives</span>}
        <span className="flex-1" />
        <button onClick={() => go(-1)} className="cursor-pointer rounded-lg p-2 hover:bg-white/10" aria-label="Étude précédente"><ChevronLeft size={28} /></button>
        <span className="tabular" aria-live="polite">{idx + 1} / {list.length}</span>
        <button onClick={() => go(1)} className="cursor-pointer rounded-lg p-2 hover:bg-white/10" aria-label="Étude suivante"><ChevronRight size={28} /></button>
        <button onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})} className="cursor-pointer rounded-lg p-2 hover:bg-white/10" aria-label="Plein écran" title="Plein écran"><Maximize size={22} /></button>
        <button onClick={quit} className="flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 hover:bg-white/10"><X size={22} /> Quitter <kbd className="ml-1 rounded bg-white/10 px-1.5 text-sm">Échap</kbd></button>
      </header>

      <main className="mt-6 flex flex-1 flex-col gap-6">
        <div>
          <h1 className="text-5xl font-extrabold leading-tight">{s.name}</h1>
          <p className="mt-2 text-2xl text-slate-300">{s.client} · {s.reference}</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-xl uppercase tracking-wide text-slate-400">{s.chiffrage.lines.length ? 'Prix de vente' : 'Montant estimé'}</div>
            <div className="mt-2 text-6xl font-extrabold tabular">{formatEuro(amountOf(s))}</div>
            <div className="mt-1 text-xl text-slate-400">HT{s.validation ? ` · validé V${s.validation.version}` : ''}</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-xl uppercase tracking-wide text-slate-400">Avancement</div>
            <div className="mt-2 text-6xl font-extrabold tabular">{s.progress} %</div>
            <div className="mt-3 h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-sky-400" style={{ width: `${s.progress}%` }} /></div>
            <div className="mt-2 text-xl text-slate-300">Étape {stageIndex(s.status) + 1}/{STAGES.length} : <strong>{stageOf(s.status).label}</strong></div>
          </div>
          <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-xl uppercase tracking-wide text-slate-400">Remise</div>
            <div className="mt-2 text-6xl font-extrabold tabular">{formatDate(s.dueDate).slice(0, 5)}</div>
            <div className={clsx('mt-1 text-2xl font-semibold', s.status === 'remise' ? 'text-emerald-300' : days < 0 ? 'text-red-400' : days <= 3 ? 'text-orange-300' : 'text-slate-300')}>
              {s.status === 'remise' ? '✓ Offre remise' : days < 0 ? `⛔ En retard de ${-days} j` : days === 0 ? 'Aujourd’hui' : `Dans ${days} jour(s)`} · {s.dueTime}
            </div>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-6">
          <section className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <h2 className="text-2xl font-bold">⚠️ Risques</h2>
            <p className="mt-2 text-3xl"><span className={critical ? 'font-extrabold text-red-400' : 'text-emerald-300'}>🔴 {critical} critique(s)</span>{s.risks.length > 0 && <span className="text-orange-300"> · 🟠 {r.important}</span>}</p>
            <ul className="mt-3 space-y-2 text-xl text-slate-200">
              {risks.map((x) => <li key={x.id}>{x.level === 'critique' ? '🔴' : '🟠'} {riskCode(x)} {x.title}{x.amount ? <span className="text-slate-400"> — {formatEuro(x.amount)}</span> : ''}</li>)}
            </ul>
          </section>
          <section className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <h2 className="text-2xl font-bold">❓ Questions</h2>
            <p className="mt-2 text-3xl">{openQ} ouverte(s){s.questions.length > 0 && q.blocking > 0 && <span className="font-extrabold text-red-400"> · {q.blocking} bloquante(s)</span>}</p>
            <ul className="mt-3 space-y-2 text-xl text-slate-200">
              {questions.map((x) => <li key={x.id}>{x.blocking ? '⛔' : '•'} {questionCode(x)} {x.subject}</li>)}
            </ul>
          </section>
          <section className="rounded-2xl bg-sky-500/10 p-6 ring-1 ring-sky-400/30">
            <h2 className="text-2xl font-bold">➡️ Prochaines actions</h2>
            <p className="mt-2 text-3xl font-extrabold text-sky-300">{na.label}</p>
            <p className="mt-1 text-xl text-slate-300">{na.reason}</p>
            <ul className="mt-3 space-y-2 text-xl text-slate-200">
              {blockers.filter((b) => b.label !== na.label).map((b) => <li key={b.id}>{b.level === 'critique' ? '🔴' : '🟠'} {b.label}</li>)}
            </ul>
          </section>
        </div>
      </main>
      <footer className="mt-4 text-center text-base text-slate-500">← → : étude précédente / suivante · Échap : quitter</footer>
    </div>
  );
}
