import { useState } from 'react';
import type { Question } from '../../domain/risks';
import { questionCode } from '../../domain/risks';
import { toISODate } from '../../domain/dates';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';

export type QuestionForm = Pick<Question, 'subject' | 'text' | 'impact' | 'blocking' | 'source'> & { id?: string };

export function QuestionFormModal({ question, onClose, onSave }: { question?: Question; onClose: () => void; onSave: (q: QuestionForm) => void }) {
  const [f, setF] = useState<QuestionForm>(question ?? { subject: '', text: '', impact: '', blocking: false, source: { label: '' } });
  const [error, setError] = useState('');
  return (
    <Modal open onClose={onClose} size="lg" title={question ? `Modifier ${questionCode(question)}` : 'Nouvelle question'}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => {
        if (!f.subject.trim() || !f.text.trim()) { setError('Indiquez le sujet et la question.'); return; }
        onSave({ ...f, subject: f.subject.trim(), text: f.text.trim() });
      }}>Enregistrer</Button></>}>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <Field label="Sujet" required><TextInput value={f.subject} onChange={(e) => { setF({ ...f, subject: e.target.value }); setError(''); }} placeholder="Ex. Alimentation TGBT" /></Field>
        <Field label="Source" hint="Ex. CCTP p.42"><TextInput value={f.source.label} onChange={(e) => setF({ ...f, source: { ...f.source, label: e.target.value } })} /></Field>
        <Field label="Question" required className="sm:col-span-2"><TextArea value={f.text} onChange={(e) => { setF({ ...f, text: e.target.value }); setError(''); }} placeholder="Ex. Confirmer la puissance disponible." /></Field>
        <Field label="Impact sur le prix" className="sm:col-span-2"><TextInput value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })} placeholder="Ex. Prix du TGBT + câble principal." /></Field>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 accent-red-600" checked={f.blocking} onChange={(e) => setF({ ...f, blocking: e.target.checked })} />
          <span><strong>Question bloquante</strong> — la réponse conditionne le prix (signalée dans « Ce qui bloque »)</span>
        </label>
        {error && <p className="font-medium text-red-700 sm:col-span-2" role="alert">⚠ {error}</p>}
      </div>
    </Modal>
  );
}

export function AnswerModal({ question, onClose, onSave }: { question: Question; onClose: () => void; onSave: (text: string, date: string) => void }) {
  const [text, setText] = useState(question.answer?.text ?? '');
  const [date, setDate] = useState(question.answer?.date ?? toISODate(new Date()));
  return (
    <Modal open onClose={onClose} title={`Résoudre ${questionCode(question)} — ${question.subject}`}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button variant="success" disabled={!text.trim() || !date} onClick={() => onSave(text.trim(), date)}>Enregistrer la réponse</Button></>}>
      <div className="space-y-3 text-sm">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">{question.text}</p>
        <Field label="Réponse du maître d’ouvrage" required><TextArea value={text} onChange={(e) => setText(e.target.value)} className="min-h-28" /></Field>
        <Field label="Reçue le" required><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {question.impact && <p className="text-xs text-amber-800">Impact annoncé : {question.impact} — pensez à reporter la réponse dans le métré ou le chiffrage.</p>}
      </div>
    </Modal>
  );
}

export function RemindQuestionModal({ question, onClose, onSave }: { question: Question; onClose: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <Modal open onClose={onClose} title={`Relancer ${questionCode(question)} — ${question.subject}`}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => onSave(note)}>Enregistrer la relance</Button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-700">{question.reminders.length} relance(s) déjà faite(s).</p>
        <Field label="Note de relance" hint="Conservée dans l’historique (ex. « appel au maître d’œuvre »)."><TextArea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function SendQuestionsModal({ count, defaultDue, mailto, onClose, onSend }: { count: number; defaultDue: string; mailto: string; onClose: () => void; onSend: (due: string) => void }) {
  const [due, setDue] = useState(defaultDue);
  return (
    <Modal open onClose={onClose} title={`Envoyer ${count} question(s) au maître d’ouvrage`}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button disabled={!due} onClick={() => onSend(due)}>Marquer envoyées</Button></>}>
      <div className="space-y-3 text-sm">
        <a href={mailto} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-medium text-brand-700 hover:bg-slate-50">✉ Préparer le courriel avec toutes les questions</a>
        <p className="text-xs text-slate-500">Le courriel s’ouvre dans votre messagerie : ajoutez le destinataire (maître d’ouvrage ou maître d’œuvre) puis envoyez-le. Vous pouvez aussi imprimer la liste des questions.</p>
        <Field label="Réponse attendue le" required><TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
