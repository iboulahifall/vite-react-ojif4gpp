import { useState, type ReactNode } from 'react';
import { ChevronDown, Compass, Info, X } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../../state/store';

/** Encadré « À quoi ça sert ? » présent sur chaque écran. Ouvert par défaut en mode guidé. */
export function HelpBox({ title = 'À quoi ça sert ?', children }: { title?: string; children: ReactNode }) {
  const { settings } = useStore();
  const [open, setOpen] = useState(settings.guidedMode);
  return (
    <div className="no-print rounded-xl border border-sky-200 bg-sky-50/70">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-sky-900 cursor-pointer"
        aria-expanded={open}
      >
        <Info size={16} aria-hidden />
        <span className="flex-1">ℹ️ {title}</span>
        <ChevronDown size={16} className={clsx('transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <div className="px-4 pb-3 text-sm leading-relaxed text-sky-950 space-y-1.5">{children}</div>}
    </div>
  );
}

/** Petit « i » avec définition au survol / focus. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" className="rounded-full text-slate-400 hover:text-brand-700 focus:text-brand-700 cursor-help" aria-label={text}>
        <Info size={14} />
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal normal-case tracking-normal leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

/** Bandeau du mode guidé : étape, explication, prochaine action. Masqué en mode expert. */
export function GuideBanner({ step, title, children, action }: { step?: string; title: string; children: ReactNode; action?: ReactNode }) {
  const { settings, updateSettings } = useStore();
  if (!settings.guidedMode) return null;
  return (
    <div className="no-print flex flex-col gap-3 rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4 sm:flex-row sm:items-center">
      <span className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white"><Compass size={20} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-brand-900">
          {step && <span className="mr-1.5 rounded bg-brand-700 px-1.5 py-0.5 text-xs text-white">{step}</span>}
          {title}
        </p>
        <div className="mt-0.5 text-sm text-slate-700">{children}</div>
      </div>
      <div className="flex items-center gap-2">
        {action}
        <button
          onClick={() => updateSettings({ guidedMode: false })}
          className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 cursor-pointer"
          title="Passer en mode expert (masquer le guide)"
          aria-label="Masquer le guide"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
