import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { CheckCircle2, Clock, FileSearch, HelpCircle, ListPlus, Lock, Mail, Plus, Printer, Send, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import type { Study } from '../domain/types';
import {
  isQuestionLate, isQuestionOpen, questionCode, questionsLetter, questionSummary, QUESTION_STATUS_LABELS, type Question,
} from '../domain/risks';
import { mailtoLink } from '../domain/consultations';
import { findingStatus } from '../domain/analysis/summary';
import { addDays, toISODate } from '../domain/dates';
import { formatDate, formatDateTime } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/ui/Badges';
import { GuideBanner, HelpBox } from '../components/ui/Help';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { KpiCard } from '../components/KpiCard';
import { AnswerModal, QuestionFormModal, RemindQuestionModal, SendQuestionsModal } from '../components/followup/QuestionModals';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';

export function QuestionsPage() {
  const { id = '' } = useParams();
  const study = useStore().getStudy(id);
  if (!study) return <Card className="mx-auto max-w-lg p-8 text-center"><p className="text-lg font-semibold">Étude introuvable</p><Link to="/questions" className="mt-4 inline-block font-medium text-brand-700 underline">Choisir une étude</Link></Card>;
  return <QuestionsView study={study} />;
}

type Filter = 'ouvertes' | 'bloquantes' | 'retard' | 'repondues' | 'toutes';

function StatusBadge({ q }: { q: Question }) {
  const late = isQuestionLate(q);
  const map = {
    'a-envoyer': ['bg-slate-100 text-slate-700', '✉ À envoyer'],
    'en-attente': ['bg-sky-50 text-sky-800', '⏳ En attente'],
    relancee: ['bg-violet-50 text-violet-800', '↻ Relancée'],
    repondue: ['bg-emerald-50 text-emerald-800', '✓ Répondue'],
    'sans-objet': ['bg-slate-100 text-slate-500', '— Sans objet'],
  } as const;
  const [cls, text] = late ? ['bg-red-50 text-red-800', '⏳ En retard — à relancer'] : map[q.status];
  return <span className={clsx('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide', cls)}>{text}</span>;
}

function QuestionsView({ study }: { study: Study }) {
  const store = useStore();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('ouvertes');
  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const [answering, setAnswering] = useState<Question | null>(null);
  const [reminding, setReminding] = useState<Question | null>(null);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<{ kind: 'delete' | 'sans-objet' | 'rouvrir'; q: Question } | null>(null);
  const locked = study.status === 'remise';
  const sum = questionSummary(study.questions);
  const toSend = study.questions.filter((q) => q.status === 'a-envoyer');
  const proposals = useMemo(() => (study.analysis?.findings ?? []).filter((f) =>
    f.question && findingStatus(f, study.analysisDecisions) === 'ouvert' && !study.questions.some((q) => q.source.findingId === f.id)), [study]);
  const letter = questionsLetter(study.questions, study.name, study.reference, store.settings.userName);

  const rows = study.questions.filter((q) => {
    switch (filter) {
      case 'ouvertes': return isQuestionOpen(q);
      case 'bloquantes': return isQuestionOpen(q) && q.blocking;
      case 'retard': return isQuestionLate(q);
      case 'repondues': return q.status === 'repondue';
      default: return true;
    }
  }).sort((a, b) => Number(isQuestionLate(b)) - Number(isQuestionLate(a)) || Number(b.blocking) - Number(a.blocking) || a.number - b.number);

  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'Questions' }]} icon={<HelpCircle size={24} />}
        title={<span className="flex flex-wrap items-center gap-2">Questions — {study.name} {study.isDemo && <DemoBadge />}</span>}
        subtitle="Questions et demandes de précision au maître d’ouvrage : envoi, relances, réponses."
        actions={<>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer la liste</Button>
          {!locked && toSend.length > 0 && <Button variant="secondary" icon={<Send size={16} />} onClick={() => setSending(true)}>Envoyer ({toSend.length})</Button>}
          <Button icon={<Plus size={16} />} disabled={locked} onClick={() => setEditing('new')}>Nouvelle question</Button>
        </>} />

      <GuideBanner title="Questions : lever les incertitudes avant de chiffrer">
        Rédigez les questions (ou importez celles proposées par l’analyse), <strong>envoyez</strong>-les au maître d’ouvrage, <strong>relancez</strong> sans réponse,
        puis <strong>résolvez</strong>-les en saisissant la réponse. Les questions <strong>bloquantes</strong> conditionnent le prix.
      </GuideBanner>

      <div className="no-print grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Questions ouvertes" value={sum.open} icon={<HelpCircle size={18} />} tone="brand" hint={`dont ${sum.toSend} à envoyer`} />
        <KpiCard label="Bloquantes" value={sum.blocking} icon={<Lock size={18} />} tone="red" hint="La réponse conditionne le prix" />
        <KpiCard label="En retard" value={sum.late} icon={<Clock size={18} />} tone="amber" hint="Réponse attendue dépassée" />
        <KpiCard label="Répondues" value={sum.answered} icon={<CheckCircle2 size={18} />} tone="emerald" hint={`sur ${study.questions.length} question(s)`} />
      </div>

      {proposals.length > 0 && !locked && (
        <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-5 py-3">
          <span className="text-sm font-semibold text-violet-900">{proposals.length} question(s) proposée(s) par l’analyse du DCE</span>
          <Button size="sm" variant="secondary" icon={<ListPlus size={14} />} onClick={() => toast(`${store.questionsFromFindings(study.id, proposals.map((f) => f.id))} question(s) créée(s) — à envoyer`)}>
            Toutes les importer
          </Button>
          <Link to={`/etudes/${study.id}/analyse?onglet=questions`} className="text-sm text-violet-900 underline">Les voir dans l’analyse</Link>
        </div>
      )}

      <div className="no-print flex flex-wrap gap-2">
        {([['ouvertes', `Ouvertes (${sum.open})`], ['bloquantes', `Bloquantes (${sum.blocking})`], ['retard', `En retard (${sum.late})`], ['repondues', `Répondues (${sum.answered})`], ['toutes', 'Toutes']] as [Filter, string][]).map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={clsx('rounded-full px-3 py-1 text-sm font-medium cursor-pointer', filter === f ? 'bg-brand-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50')}>{l}</button>
        ))}
      </div>

      <div className="no-print grid gap-4 xl:grid-cols-2">
        {rows.map((q) => (
          <Card key={q.id} className={clsx('p-4', q.blocking && isQuestionOpen(q) && 'border-l-4 border-l-red-500')}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold tabular text-slate-900">{questionCode(q)}</span>
              {q.blocking && <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800"><Lock size={11} /> Bloquante</span>}
              <span className="flex-1" />
              <StatusBadge q={q} />
            </div>
            <dl className="mt-2 grid gap-1.5 text-sm">
              <div className="grid grid-cols-[6rem_1fr]"><dt className="text-slate-500">Sujet</dt><dd className="font-semibold text-slate-900">{q.subject}</dd></div>
              <div className="grid grid-cols-[6rem_1fr]"><dt className="text-slate-500">Source</dt><dd>
                {q.source.docId ? <Link to={`/etudes/${study.id}/dce?doc=${encodeURIComponent(q.source.docId)}${q.source.page ? `&page=${q.source.page}` : ''}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><FileSearch size={13} /> {q.source.label}</Link> : q.source.label || '—'}
              </dd></div>
              <div className="grid grid-cols-[6rem_1fr]"><dt className="text-slate-500">Question</dt><dd className="text-slate-900">{q.text}</dd></div>
              <div className="grid grid-cols-[6rem_1fr]"><dt className="text-slate-500">Impact</dt><dd className="text-slate-700">{q.impact || '—'}</dd></div>
              <div className="grid grid-cols-[6rem_1fr]"><dt className="text-slate-500">Suivi</dt><dd className="text-xs text-slate-600">
                {q.sentAt ? `Envoyée le ${formatDate(q.sentAt)}` : 'Non envoyée'}{q.dueDate ? ` · réponse attendue le ${formatDate(q.dueDate)}` : ''}
                {q.reminders.map((r, i) => <div key={i}>↻ Relance n°{i + 1} le {formatDateTime(r.at)}{r.note && ` — ${r.note}`}</div>)}
              </dd></div>
              {q.answer && (
                <div className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                  <span className="font-semibold">Réponse du {formatDate(q.answer.date)} :</span> {q.answer.text}
                </div>
              )}
            </dl>
            {!locked && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(q)}>Modifier</Button>
                {(q.status === 'en-attente' || q.status === 'relancee') && <Button size="sm" variant={isQuestionLate(q) ? 'danger' : 'secondary'} onClick={() => setReminding(q)}>Relancer</Button>}
                {isQuestionOpen(q) && <Button size="sm" variant="success" onClick={() => setAnswering(q)}>Résoudre</Button>}
                {q.status === 'repondue' && <Button size="sm" variant="ghost" onClick={() => setAnswering(q)}>Modifier la réponse</Button>}
                <span className="flex-1" />
                {isQuestionOpen(q) && <button className="text-xs text-slate-500 underline cursor-pointer" onClick={() => setPending({ kind: 'sans-objet', q })}>Sans objet</button>}
                {!isQuestionOpen(q) && q.status !== 'repondue' && <button className="text-xs text-slate-500 underline cursor-pointer" onClick={() => setPending({ kind: 'rouvrir', q })}>Rouvrir</button>}
                <button onClick={() => setPending({ kind: 'delete', q })} className="rounded p-1 text-slate-400 hover:text-red-700 cursor-pointer" aria-label={`Supprimer ${questionCode(q)}`}><Trash2 size={14} /></button>
              </div>
            )}
          </Card>
        ))}
        {rows.length === 0 && <Card className="p-8 text-center text-sm text-slate-500 xl:col-span-2">Aucune question dans cette sélection.</Card>}
      </div>

      <HelpBox>
        <p>Posez une question dès qu’un point du dossier est ambigu, contradictoire ou manquant : puissance disponible, répartition entre lots, marque imposée, quantités…</p>
        <p>Une question <strong>bloquante</strong> sans réponse apparaît dans « Ce qui bloque » de l’étude et, si elle est en retard, dans les alertes du tableau de bord. Après la réponse, reportez-la dans le métré ou le chiffrage.</p>
      </HelpBox>

      {editing && <QuestionFormModal question={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSave={(f) => {
        const q = store.saveQuestion(study.id, f, editing === 'new' ? 'Nouvelle question' : 'Modification');
        setEditing(null);
        if (q) toast(`${questionCode(q)} enregistrée`);
      }} />}
      {answering && <AnswerModal question={answering} onClose={() => setAnswering(null)} onSave={(text, date) => { store.answerQuestion(study.id, answering.id, text, date); setAnswering(null); toast(`${questionCode(answering)} résolue`); }} />}
      {reminding && <RemindQuestionModal question={reminding} onClose={() => setReminding(null)} onSave={(note) => { store.remindQuestion(study.id, reminding.id, note); setReminding(null); toast('Relance enregistrée'); }} />}
      {sending && <SendQuestionsModal count={toSend.length} defaultDue={toISODate(addDays(new Date(), 5))}
        mailto={mailtoLink('', questionsLetter(toSend, study.name, study.reference, store.settings.userName).subject, questionsLetter(toSend, study.name, study.reference, store.settings.userName).body)}
        onClose={() => setSending(false)} onSend={(due) => { store.sendQuestions(study.id, toSend.map((q) => q.id), due); setSending(false); toast(`${toSend.length} question(s) marquée(s) envoyée(s)`); }} />}
      {pending && (
        <ConfirmDialog open askReason danger={pending.kind === 'delete'} reasonRequired={pending.kind !== 'rouvrir'}
          title={pending.kind === 'delete' ? `Supprimer ${questionCode(pending.q)} ?` : pending.kind === 'sans-objet' ? `${questionCode(pending.q)} sans objet ?` : `Rouvrir ${questionCode(pending.q)} ?`}
          message={<strong>{pending.q.subject}</strong>} confirmLabel={pending.kind === 'delete' ? 'Supprimer' : 'Confirmer'}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => {
            if (pending.kind === 'delete') store.deleteQuestion(study.id, pending.q.id, reason);
            else store.setQuestionStatus(study.id, pending.q.id, pending.kind === 'sans-objet' ? 'sans-objet' : 'a-envoyer', reason || 'Réouverture');
            setPending(null);
            toast('Question mise à jour');
          }} />
      )}

      <PrintDocument title="Questions au maître d’ouvrage" reference={study.reference} demo={study.isDemo}>
        <div className="mb-3 text-[13pt] font-bold">{study.name}</div>
        <PrintSection title={`Questions ouvertes (${sum.open})`}>
          <PrintTable head={['N°', 'Sujet', 'Source', 'Question', 'Statut']}
            rows={study.questions.filter(isQuestionOpen).map((q) => [questionCode(q), <>{q.subject}{q.blocking && <strong> (bloquante)</strong>}</>, q.source.label || '—', q.text,
              isQuestionLate(q) ? 'EN RETARD' : QUESTION_STATUS_LABELS[q.status]])} />
        </PrintSection>
        {sum.answered > 0 && (
          <PrintSection title={`Questions répondues (${sum.answered})`}>
            <PrintTable head={['N°', 'Sujet', 'Question', 'Réponse', 'Date']}
              rows={study.questions.filter((q) => q.status === 'repondue').map((q) => [questionCode(q), q.subject, q.text, q.answer?.text ?? '', q.answer ? formatDate(q.answer.date) : ''])} />
          </PrintSection>
        )}
      </PrintDocument>
      {/* Lien de messagerie global (hors impression) pour toutes les questions ouvertes */}
      {sum.open > 0 && <a href={mailtoLink('', letter.subject, letter.body)} className="no-print inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><Mail size={14} /> Préparer un courriel avec toutes les questions ouvertes</a>}
    </div>
  );
}
