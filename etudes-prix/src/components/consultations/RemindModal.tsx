import { useState } from 'react';
import { Mail } from 'lucide-react';
import type { Consultation, Supplier, SupplierRequest } from '../../domain/consultations';
import { mailtoLink } from '../../domain/consultations';
import { formatDate } from '../../domain/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, TextArea } from '../ui/Field';

/** Relance d'un fournisseur : note enregistrée et courriel prérempli. */
export function RemindModal({ consultation, request, supplier, studyName, userName, onClose, onRemind }: {
  consultation: Consultation;
  request: SupplierRequest;
  supplier?: Supplier;
  studyName: string;
  userName: string;
  onClose: () => void;
  onRemind: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  const subject = `Relance — demande de prix ${consultation.label} — ${studyName}`;
  const body = `Bonjour${supplier?.contactName ? ` ${supplier.contactName}` : ''},\n\nSauf erreur de notre part, nous n’avons pas encore reçu votre offre pour « ${consultation.label} » (demande du ${request.sentAt ? formatDate(request.sentAt) : '—'}).\nPourriez-vous nous la transmettre avant le ${formatDate(consultation.dueDate)} ?\n\nCordialement,\n${userName}`;
  return (
    <Modal open onClose={onClose} title={`Relancer ${supplier?.name ?? 'le fournisseur'}`}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => onRemind(note)}>Enregistrer la relance</Button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-700">Demande envoyée le <strong>{request.sentAt ? formatDate(request.sentAt) : '—'}</strong> · réponse attendue le <strong>{formatDate(consultation.dueDate)}</strong> · {request.reminders.length} relance(s) déjà faite(s).</p>
        {supplier?.email ? (
          <a href={mailtoLink(supplier.email, subject, body)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-medium text-brand-700 hover:bg-slate-50">
            <Mail size={16} /> Préparer le courriel de relance
          </a>
        ) : <p className="text-xs text-slate-500">Aucune adresse e-mail dans la fiche du fournisseur{supplier?.phone ? ` — téléphone : ${supplier.phone}` : ''}.</p>}
        <Field label="Note de relance" hint="Conservée dans l’historique (ex. « appel, réponse promise vendredi »)."><TextArea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
