import { useRef, useState } from 'react';
import clsx from 'clsx';
import { UploadCloud } from 'lucide-react';
import { ACCEPTED_EXTENSIONS } from '../../domain/documents';

/** Zone de dépôt : glisser-déposer ou clic pour choisir des fichiers. */
export function DropZone({ onFiles, compact, disabled, label = 'Glissez vos fichiers ici' }: {
  onFiles: (files: File[]) => void;
  compact?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled && e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={clsx('rounded-xl border-2 border-dashed text-center transition',
        over ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50/60',
        disabled ? 'opacity-50' : 'hover:border-brand-400',
        compact ? 'px-3 py-3' : 'px-6 py-8')}
    >
      <UploadCloud className={clsx('mx-auto text-brand-600', compact ? 'mb-1' : 'mb-2')} size={compact ? 22 : 32} aria-hidden />
      <p className={clsx('font-medium text-slate-800', compact ? 'text-xs' : 'text-sm')}>
        {label} ou{' '}
        <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="font-semibold text-brand-700 underline hover:no-underline cursor-pointer">
          parcourir
        </button>
      </p>
      {!compact && <p className="mt-1 text-xs text-slate-500">PDF, Excel, Word, images, DWG, ZIP — 50 Mo maximum par fichier. Le classement est proposé automatiquement.</p>}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={ACCEPTED_EXTENSIONS.join(',')}
        data-testid="dce-file-input"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
    </div>
  );
}
