import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Confirmation des actions importantes. Si `askReason`, un motif est demandé
 * et conservé dans l'historique.
 */
export function ConfirmDialog({ open, title, message, impact, confirmLabel = 'Confirmer', danger, askReason, reasonRequired, onCancel, onConfirm }: {
  open: boolean;
  title: string;
  message: ReactNode;
  impact?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  askReason?: boolean;
  reasonRequired?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const blocked = askReason && reasonRequired && !reason.trim();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      title={title}
      icon={<span className={danger ? 'rounded-full bg-red-100 p-2 text-red-700' : 'rounded-full bg-amber-100 p-2 text-amber-700'}><AlertTriangle size={20} /></span>}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} data-autofocus>Annuler</Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => onConfirm(reason)}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        <div>{message}</div>
        {impact && <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-inset ring-amber-200">{impact}</div>}
        {askReason && (
          <label className="block">
            <span className="mb-1 block font-medium text-slate-800">Motif {reasonRequired ? <span className="text-red-600">*</span> : <span className="font-normal text-slate-500">(conservé dans l’historique)</span>}</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. : nouvelle offre fournisseur"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 outline-none"
            />
          </label>
        )}
      </div>
    </Modal>
  );
}
