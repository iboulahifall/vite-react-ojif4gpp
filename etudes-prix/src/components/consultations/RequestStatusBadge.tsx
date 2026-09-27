import clsx from 'clsx';
import { CheckCircle2, Clock, Mail, RotateCw, Send, XCircle } from 'lucide-react';
import { STATUS_LABELS, type RequestStatus } from '../../domain/consultations';

const STYLE: Record<RequestStatus, { cls: string; Icon: typeof Clock }> = {
  'a-envoyer': { cls: 'bg-slate-100 text-slate-700 ring-slate-300', Icon: Mail },
  envoyee: { cls: 'bg-sky-50 text-sky-800 ring-sky-200', Icon: Clock },
  relancee: { cls: 'bg-violet-50 text-violet-800 ring-violet-200', Icon: RotateCw },
  recue: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icon: CheckCircle2 },
  declinee: { cls: 'bg-slate-100 text-slate-500 ring-slate-300', Icon: XCircle },
};

/** Statut d'une demande de prix : icône + texte (+ « en retard »). */
export function RequestStatusBadge({ status, late }: { status: RequestStatus; late?: boolean }) {
  const { cls, Icon } = late ? { cls: 'bg-red-50 text-red-800 ring-red-200', Icon: Send } : STYLE[status];
  return (
    <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', cls)}>
      <Icon size={12} aria-hidden /> {late ? '⏳ En retard — à relancer' : STATUS_LABELS[status]}
    </span>
  );
}
