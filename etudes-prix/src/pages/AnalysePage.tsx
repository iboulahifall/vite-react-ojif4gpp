import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  AlertOctagon, AlertTriangle, BarChart3, Check, CheckCircle2, Copy, FileText, HelpCircle, Loader2, Printer, RefreshCw, ScanSearch,
} from 'lucide-react';
import { useStore } from '../state/store';
import type { Study } from '../domain/types';
import type { ComparisonStatus, Finding, FindingStatus } from '../domain/analysis/types';
import { dceSignature, sourceLabel } from '../domain/analysis/analyse';
import { findingStatus, summarize } from '../domain/analysis/summary';
import { FAMILIES } from '../domain/catalog';
import { formatDateTime } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge, Tag } from '../components/ui/Badges';
import { GuideBanner, HelpBox, InfoTip } from '../components/ui/Help';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { CATEGORY_LABELS, FindingCard } from '../components/analysis/FindingCard';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';

export function AnalysePage() {
  const { id = '' } = useParams();
  const { getStudy } = useStore();
  const study = getStudy(id);
  if (!study) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <p className="text-lg font-semibold">Étude introuvable</p>
        <Link to="/analyse" className="mt-4 inline-block font-medium text-brand-700 underline">Choisir une étude</Link>
      </Card>
    );
  }
  return <AnalyseView study={study} />;
}

type Tab = 'points' | 'comparaison' | 'prestations' | 'dpgf' | 'questions';
type Filter = 'ouverts' | 'critique' | 'verifier' | 'traite' | 'ecarte' | 'tous';

const COMPARISON: Record<ComparisonStatus, { label: string; cls: string }> = {
  ok: { label: '✓ Concordant', cls: 'bg-emerald-100 text-emerald-800' },
  'cctp-seul': { label: '⚠ Absent de la DPGF', cls: 'bg-red-100 text-red-800' },
  'dpgf-seul': { label: '◐ Non décrit au CCTP', cls: 'bg-orange-100 text-orange-800' },
};

function SummaryCard({ tone, icon, label, value, hint, active, onClick }: {
  tone: 'red' | 'orange' | 'green' | 'sky'; icon: ReactNode; label: string; value: number; hint: string; active: boolean; onClick: () => void;
}) {
  const t = { red: 'bg-red-50 text-red-700', orange: 'bg-orange-50 text-orange-700', green: 'bg-emerald-50 text-emerald-700', sky: 'bg-sky-50 text-sky-700' }[tone];
  return (
    <button onClick={onClick} aria-pressed={active}
      className={clsx('rounded-xl border bg-white p-4 text-left shadow-sm transition cursor-pointer hover:shadow-md', active ? 'border-brand-500 ring-2 ring-brand-100' : 'border-slate-200')}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={clsx('rounded-lg p-2', t)}>{icon}</span>
      </div>
      <div className="mt-1 text-3xl font-bold tabular text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </button>
  );
}

function AnalyseView({ study }: { study: Study }) {
  const { runAnalysis, decideFinding } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('onglet') as Tab) || 'points';
  const filter = (params.get('filtre') as Filter) || 'ouverts';
  const [category, setCategory] = useState<string>('');
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [running, setRunning] = useState<string[] | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{ finding: Finding; status: FindingStatus } | null>(null);
  const a = study.analysis;
  const locked = study.status === 'remise';
  const decisions = study.analysisDecisions;
  const summary = useMemo(() => (a ? summarize(a, decisions) : null), [a, decisions]);
  const stale = a && a.dceSignature !== dceSignature(study.documents);
  const hasCctp = study.documents.some((d) => d.category === 'CCTP');
  const hasDpgf = study.documents.some((d) => d.category === 'DPGF');

  const go = (t: Tab, f?: Filter) => {
    const p = new URLSearchParams(params);
    p.set('onglet', t);
    if (f) p.set('filtre', f); else p.delete('filtre');
    setParams(p, { replace: true });
  };

  const launch = async () => {
    setRunning([]);
    const started = Date.now();
    try {
      await runAnalysis(study.id, (label) => setRunning((r) => [...(r ?? []), label]));
      // Laisse le temps de lire les étapes (l'analyse elle-même est rapide).
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - started))));
      toast('Analyse terminée');
      go('points', 'ouverts');
    } catch {
      toast('L’analyse n’a pas pu être réalisée');
    } finally {
      setRunning(null);
    }
  };

  const visible = useMemo(() => {
    if (!a) return [];
    return a.findings.filter((f) => {
      const st = findingStatus(f, decisions);
      if (category && f.category !== category) return false;
      switch (filter) {
        case 'ouverts': return st === 'ouvert';
        case 'critique': return st === 'ouvert' && f.level === 'critique';
        case 'verifier': return st === 'ouvert' && f.level === 'verifier';
        case 'traite': return st === 'traite';
        case 'ecarte': return st === 'ecarte';
        default: return true;
      }
    });
  }, [a, decisions, filter, category]);

  const questions = useMemo(() => (a ? a.findings.filter((f) => f.question && findingStatus(f, decisions) === 'ouvert') : []), [a, decisions]);

  const copyQuestions = async () => {
    const text = questions.map((q, i) => `Q-${String(i + 1).padStart(3, '0')} — ${q.title}\nSource : ${sourceLabel(q.source) || '—'}\n${q.question}`).join('\n\n');
    try { await navigator.clipboard.writeText(text); toast('Questions copiées dans le presse-papiers'); } catch { toast('Copie impossible dans ce navigateur'); }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = a ? [
    { id: 'points', label: 'Points à traiter', count: (summary?.critical ?? 0) + (summary?.toCheck ?? 0) },
    { id: 'comparaison', label: 'Comparaison CCTP / DPGF', count: a.comparison.filter((c) => c.status !== 'ok').length },
    { id: 'prestations', label: 'Prestations détectées', count: a.prestations.length },
    { id: 'dpgf', label: 'Lignes DPGF', count: a.dpgfLines.length },
    { id: 'questions', label: 'Questions', count: questions.length },
  ] : [];

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Mes études', to: '/etudes' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'Analyse' }]}
        icon={<BarChart3 size={24} />}
        title={<span className="flex flex-wrap items-center gap-2">Analyse — {study.name} {study.isDemo && <DemoBadge />}</span>}
        subtitle="Analyse automatique du CCTP et de la DPGF : prestations, écarts, clauses à risque et questions."
        actions={a && (
          <>
            <Button variant="secondary" icon={<FileText size={16} />} onClick={() => navigate(`/etudes/${study.id}/dce`)}>DCE</Button>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer</Button>
            <Button icon={<RefreshCw size={16} />} disabled={!!running || locked} onClick={() => void launch()}>Relancer l’analyse</Button>
          </>
        )}
      />

      <GuideBanner step="Étape 1/7" title="Analyse du dossier">
        {a
          ? <>Traitez les <strong>points critiques</strong> en premier : pour chacun, vérifiez l’extrait dans le document source, puis <strong>marquez-le traité</strong> ou <strong>écartez-le</strong>. Les questions retenues pourront être envoyées au maître d’ouvrage.</>
          : <>L’application va lire le CCTP, la DPGF et les pièces administratives, puis comparer CCTP et DPGF. Cliquez sur <strong>Lancer l’analyse</strong>.</>}
      </GuideBanner>

      {running && (
        <Card className="no-print p-6">
          <div className="mx-auto max-w-md space-y-2 font-mono text-sm">
            {running.map((s) => (
              <div key={s} className="flex items-center justify-between gap-4"><span>{s}</span><Check size={16} className="text-emerald-600" /></div>
            ))}
            <div className="flex items-center gap-2 text-slate-500"><Loader2 size={16} className="animate-spin" /> Analyse en cours…</div>
          </div>
        </Card>
      )}

      {!a && !running && (
        <Card className="no-print p-8">
          <div className="mx-auto max-w-xl text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><ScanSearch size={28} /></span>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Aucune analyse pour cette étude</h2>
            <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left text-sm">
              <li className="flex items-center gap-2">{hasCctp ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-orange-500" />} CCTP {hasCctp ? 'importé' : 'non importé — prestations non détectables'}</li>
              <li className="flex items-center gap-2">{hasDpgf ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-orange-500" />} DPGF {hasDpgf ? 'importée' : 'non importée — comparaison impossible'}</li>
            </ul>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {!hasCctp && <Button variant="secondary" onClick={() => navigate(`/etudes/${study.id}/dce`)}>Importer des pièces</Button>}
              <Button size="lg" icon={<ScanSearch size={18} />} disabled={locked} onClick={() => void launch()}>Lancer l’analyse</Button>
            </div>
          </div>
        </Card>
      )}

      {a && summary && !running && (
        <>
          {stale && (
            <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900">
              <AlertTriangle size={18} /> Le DCE a été modifié depuis cette analyse (fichier ajouté, supprimé ou reclassé).
              <Button size="sm" onClick={() => void launch()} disabled={locked}>Relancer l’analyse</Button>
            </div>
          )}
          <p className="no-print text-sm text-slate-600">
            Analyse du {formatDateTime(a.runAt)} par {a.runBy} · {a.cctp ? `CCTP (${a.cctp.pages} p.)` : 'sans CCTP'} · {a.dpgf ? `DPGF (${a.dpgf.lines} lignes)` : 'sans DPGF'} · {a.documentsRead.length} pièce(s) écrite(s) lue(s)
          </p>

          <div className="no-print grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryCard tone="red" icon={<AlertOctagon size={18} />} label="🔴 Points critiques" value={summary.critical} hint="À traiter avant de chiffrer"
              active={tab === 'points' && filter === 'critique'} onClick={() => go('points', 'critique')} />
            <SummaryCard tone="orange" icon={<AlertTriangle size={18} />} label="🟠 À vérifier" value={summary.toCheck} hint="Points d’attention"
              active={tab === 'points' && filter === 'verifier'} onClick={() => go('points', 'verifier')} />
            <SummaryCard tone="green" icon={<CheckCircle2 size={18} />} label="🟢 Confirmés" value={summary.confirmed} hint="Prestations concordantes + points traités"
              active={tab === 'comparaison'} onClick={() => go('comparaison')} />
            <SummaryCard tone="sky" icon={<HelpCircle size={18} />} label="❓ Questions" value={summary.questions} hint="Proposées au maître d’ouvrage"
              active={tab === 'questions'} onClick={() => go('questions')} />
          </div>

          <p className="no-print flex items-start gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            <InfoTip text="Les règles reconnaissent environ 35 prestations CFO/CFA et 16 types de clauses (hypothèses à confirmer, pénalités, site occupé, PSE, annexes…)." />
            Analyse automatique par règles métier : elle signale des points à examiner et ne remplace pas la lecture complète du dossier. Chaque point renvoie à sa source.
          </p>

          <Card className="no-print">
            <div role="tablist" className="flex overflow-x-auto border-b border-slate-200 px-3">
              {tabs.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => go(t.id, t.id === 'points' ? filter : undefined)}
                  className={clsx('flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium cursor-pointer',
                    tab === t.id ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                  {t.label} {t.count !== undefined && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span>}
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === 'points' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {([['ouverts', 'Ouverts'], ['critique', 'Critiques'], ['verifier', 'À vérifier'], ['traite', 'Traités'], ['ecarte', 'Écartés'], ['tous', 'Tous']] as [Filter, string][]).map(([f, l]) => (
                      <button key={f} onClick={() => go('points', f)} aria-pressed={filter === f}
                        className={clsx('rounded-full px-3 py-1 text-sm font-medium cursor-pointer', filter === f ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>{l}</button>
                    ))}
                    <span className="flex-1" />
                    <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Type de point"
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                      <option value="">Tous les types</option>
                      {Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                  {visible.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Aucun point dans cette sélection.</p>}
                  <div className="grid gap-3 xl:grid-cols-2">
                    {visible.map((f) => (
                      <FindingCard key={f.id} finding={f} decision={decisions[f.id]} studyId={study.id} locked={locked}
                        onDecide={(status) => status === 'ouvert' ? decideFinding(study.id, f.id, 'ouvert', 'Réouverture') : setPendingDecision({ finding: f, status })} />
                    ))}
                  </div>
                </div>
              )}

              {tab === 'comparaison' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} className="h-4 w-4 accent-brand-700" /> Afficher uniquement les écarts</label>
                  {a.comparison.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">Comparaison impossible : il faut un CCTP lisible et une DPGF au format Excel.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <tr><th className="px-3 py-2">Famille</th><th className="px-3 py-2">Prestation</th><th className="px-3 py-2">CCTP</th><th className="px-3 py-2">DPGF</th><th className="px-3 py-2">Résultat</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {a.comparison.filter((c) => !onlyGaps || c.status !== 'ok').map((c) => {
                            const fam = FAMILIES.find((f) => f.id === c.familyId);
                            return (
                              <tr key={c.ruleId}>
                                <td className="px-3 py-2 text-slate-600">{fam ? `${fam.lot} · ${fam.label}` : c.familyId}</td>
                                <td className="px-3 py-2 font-medium text-slate-900">{c.label}</td>
                                <td className="px-3 py-2">
                                  {c.cctpPages.length ? c.cctpPages.map((p) => (
                                    <Link key={p} to={`/etudes/${study.id}/dce?doc=${encodeURIComponent(a.cctp!.docId)}&page=${p}`} className="mr-1 text-brand-700 hover:underline">p.{p}</Link>
                                  )) : <span className="text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2 tabular">{c.dpgfRefs.join(', ') || <span className="text-slate-400">—</span>}</td>
                                <td className="px-3 py-2"><span className={clsx('whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold', COMPARISON[c.status].cls)}>{COMPARISON[c.status].label}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === 'prestations' && (
                a.prestations.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucune prestation détectée (CCTP absent ou illisible).</p> : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {(['CFO', 'CFA'] as const).map((lot) => (
                      <div key={lot} className="rounded-xl border border-slate-200">
                        <div className="border-b border-slate-100 px-4 py-2.5 font-bold">{lot === 'CFO' ? '⚡ CFO' : '📡 CFA'}</div>
                        <ul className="divide-y divide-slate-100">
                          {FAMILIES.filter((f) => f.lot === lot).map((fam) => {
                            const items = a.prestations.filter((p) => p.familyId === fam.id);
                            const inScope = study.families.includes(fam.id);
                            return (
                              <li key={fam.id} className="px-4 py-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={clsx('text-sm font-semibold', items.length ? 'text-slate-900' : 'text-slate-400')}>{fam.label}</span>
                                  {!inScope && items.length > 0 && <Tag>Hors périmètre</Tag>}
                                  {items.length === 0 && <span className="text-xs text-slate-400">non décrit</span>}
                                </div>
                                {items.map((p) => (
                                  <div key={p.ruleId} className="mt-1 flex items-start gap-2 pl-3 text-sm">
                                    <span className="text-slate-300">└</span>
                                    <span className="flex-1 text-slate-700" title={p.excerpt}>{p.label}</span>
                                    <span className="text-xs text-slate-500">p. {p.pages.join(', ')}</span>
                                  </div>
                                ))}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'dpgf' && (
                a.dpgfLines.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucune ligne de DPGF lue.</p> : (
                  <div className="max-h-[60vh] overflow-auto">
                    <table className="table-sticky w-full min-w-[760px] text-sm">
                      <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr className="[&>th]:bg-slate-50"><th className="px-3 py-2">N°</th><th className="px-3 py-2">Désignation</th><th className="px-3 py-2">Unité</th><th className="px-3 py-2 text-right">Quantité</th><th className="px-3 py-2">Famille reconnue</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {a.dpgfLines.map((l, i) => (
                          <FragmentRow key={`${l.row}`} showSection={i === 0 || a.dpgfLines[i - 1].section !== l.section} section={l.section}>
                            <td className="px-3 py-2 tabular text-slate-600">{l.ref}</td>
                            <td className="px-3 py-2 text-slate-900">{l.designation}</td>
                            <td className="px-3 py-2">{l.unit}</td>
                            <td className="px-3 py-2 text-right tabular">{l.qty === null ? <span className="font-semibold text-orange-700">à établir</span> : l.qty.toLocaleString('fr-FR')}</td>
                            <td className="px-3 py-2 text-slate-600">{FAMILIES.find((f) => f.id === l.familyId)?.label ?? <span className="text-orange-700">non rattachée</span>}</td>
                          </FragmentRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {tab === 'questions' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-600">Questions issues des points encore ouverts. Le suivi (envoi, relance, réponse) arrive avec le module Questions (V1.7).</p>
                    <Button size="sm" variant="secondary" icon={<Copy size={14} />} disabled={!questions.length} onClick={() => void copyQuestions()}>Copier les questions</Button>
                  </div>
                  <ol className="space-y-2">
                    {questions.map((q, i) => (
                      <li key={q.id} className="rounded-xl border border-slate-200 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 font-bold text-sky-800">Q-{String(i + 1).padStart(3, '0')}</span>
                          <span className="font-semibold text-slate-700">{q.title}</span>
                          <span>· Source : {sourceLabel(q.source) || '—'}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-900">{q.question}</p>
                      </li>
                    ))}
                    {questions.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Aucune question ouverte.</p>}
                  </ol>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      <HelpBox>
        <p>L’analyse lit le <strong>CCTP</strong> (description technique), la <strong>DPGF</strong> (cadre de prix) et les pièces administratives (<strong>RC, CCAP</strong>).</p>
        <p><strong>Écart CCTP / DPGF</strong> : une prestation décrite au CCTP sans ligne de prix dans la DPGF risque d’être oubliée ; une ligne de DPGF non décrite au CCTP manque de spécifications.</p>
        <p><strong>Clauses</strong> : hypothèses « à confirmer », pénalités, site occupé, PSE, variantes, pièces annexes citées… Chaque point indique sa source ; cliquez dessus pour ouvrir le document à la bonne page.</p>
        <p>Vos décisions (traité / écarté) sont conservées si vous relancez l’analyse.</p>
      </HelpBox>

      {pendingDecision && (
        <ConfirmDialog open askReason reasonRequired={pendingDecision.status === 'ecarte'}
          title={pendingDecision.status === 'traite' ? 'Marquer ce point comme traité ?' : 'Écarter ce point ?'}
          message={<><strong>{pendingDecision.finding.title}</strong><br />{pendingDecision.status === 'traite' ? 'Indiquez comment le point a été pris en compte (optionnel).' : 'Indiquez pourquoi ce point ne s’applique pas.'}</>}
          confirmLabel={pendingDecision.status === 'traite' ? 'Marquer traité' : 'Écarter'}
          onCancel={() => setPendingDecision(null)}
          onConfirm={(reason) => {
            decideFinding(study.id, pendingDecision.finding.id, pendingDecision.status, reason);
            setPendingDecision(null);
            toast(pendingDecision.status === 'traite' ? 'Point marqué traité' : 'Point écarté');
          }} />
      )}

      {a && summary && (
        <PrintDocument title="Analyse du DCE" reference={study.reference} version={`Analyse du ${formatDateTime(a.runAt)}`} demo={study.isDemo}>
          <div className="mb-3 text-[13pt] font-bold">{study.name}</div>
          <PrintSection title="Synthèse">
            <PrintTable head={['Points critiques', 'À vérifier', 'Confirmés', 'Questions', 'Traités', 'Écartés']} align={['center', 'center', 'center', 'center', 'center', 'center']}
              rows={[[summary.critical, summary.toCheck, summary.confirmed, summary.questions, summary.treated, summary.dismissed]]} />
            <p className="mt-2 text-[9pt]">Sources : {a.cctp ? `${a.cctp.docName} (${a.cctp.pages} p.)` : 'CCTP absent'} · {a.dpgf ? `${a.dpgf.docName} (${a.dpgf.lines} lignes)` : 'DPGF non lue'} · Analyse automatique par règles, à vérifier par le responsable.</p>
          </PrintSection>
          <PrintSection title="Points ouverts">
            <PrintTable head={['Niveau', 'Type', 'Point', 'Source']}
              rows={a.findings.filter((f) => findingStatus(f, decisions) === 'ouvert').map((f) => [
                f.level === 'critique' ? 'CRITIQUE' : 'À vérifier', CATEGORY_LABELS[f.category],
                <><strong>{f.title}</strong><br />{f.excerpt ? `« ${f.excerpt} »` : f.detail}</>, sourceLabel(f.source) || '—'])} />
          </PrintSection>
          <PrintSection title="Comparaison CCTP / DPGF">
            <PrintTable head={['Prestation', 'CCTP', 'DPGF', 'Résultat']}
              rows={a.comparison.map((c) => [c.label, c.cctpPages.map((p) => `p.${p}`).join(', ') || '—', c.dpgfRefs.join(', ') || '—', COMPARISON[c.status].label.replace(/^[^ ]+ /, '')])} />
          </PrintSection>
          <PrintSection title={`Questions proposées (${questions.length})`}>
            <PrintTable head={['N°', 'Question', 'Source']}
              rows={questions.map((q, i) => [`Q\u2011${String(i + 1).padStart(3, '0')}`, q.question, sourceLabel(q.source) || '—'])} />
          </PrintSection>
        </PrintDocument>
      )}
    </div>
  );
}

function FragmentRow({ showSection, section, children }: { showSection: boolean; section: string; children: ReactNode }) {
  return (
    <>
      {showSection && section && (
        <tr><td colSpan={5} className="bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">{section}</td></tr>
      )}
      <tr>{children}</tr>
    </>
  );
}
