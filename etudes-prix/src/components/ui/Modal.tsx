import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

/** Pile des fenêtres ouvertes : seule la plus haute réagit à Échap. */
const stack: symbol[] = [];

export function Modal({ open, onClose, title, children, footer, size = 'md', icon }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const me = Symbol('modal');
    stack.push(me);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stack[stack.length - 1] === me && onClose();
    document.addEventListener('keydown', onKey);
    const first = panel.current?.querySelector<HTMLElement>('input, textarea, select, button[data-autofocus]');
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(me), 1);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className={clsx('w-full rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col',
          size === 'sm' ? 'max-w-md' : size === 'md' ? 'max-w-lg' : 'max-w-3xl')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            {icon}
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}
