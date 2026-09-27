import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

function parse(s: string): number | null | undefined {
  const t = s.replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Cellule quantité éditable « façon tableur » : Entrée ou sortie du champ pour valider,
 * Échap pour annuler. Une valeur invalide est refusée (bordure rouge).
 */
export function QtyInput({ value, placeholder, onCommit, disabled, label, proposed }: {
  value: number | null;
  placeholder?: number | null;
  onCommit: (v: number | null) => void;
  disabled?: boolean;
  label: string;
  proposed?: boolean;
}) {
  const fmt = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(fmt(value));
  const [invalid, setInvalid] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(fmt(value)); setInvalid(false); }, [value]);

  const commit = () => {
    const v = parse(text);
    if (v === undefined) { setInvalid(true); return; }
    setInvalid(false);
    if (v !== value) onCommit(v);
  };

  return (
    <input
      ref={ref}
      inputMode="decimal"
      value={text}
      disabled={disabled}
      aria-label={label}
      aria-invalid={invalid || undefined}
      placeholder={placeholder === null || placeholder === undefined ? '' : String(placeholder).replace('.', ',')}
      title={proposed ? 'Valeur proposée (calculée ou DPGF) — saisissez pour la remplacer' : undefined}
      onChange={(e) => { setText(e.target.value); setInvalid(false); }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); ref.current?.blur(); }
        if (e.key === 'Escape') { setText(fmt(value)); setInvalid(false); ref.current?.blur(); }
      }}
      className={clsx('w-full rounded-md border bg-white px-2 py-1 text-right text-sm tabular outline-none transition',
        'focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:border-transparent disabled:bg-transparent',
        invalid ? 'border-red-500' : 'border-slate-200 hover:border-slate-400',
        proposed && 'placeholder:italic placeholder:text-slate-500')}
    />
  );
}
