import clsx from 'clsx';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Field({ label, hint, error, required, children, className }: { label: string; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-slate-800">
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-700" role="alert">⚠ {error}</span>
        : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

const base = 'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100 placeholder:text-slate-400';

export function TextInput({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={clsx(base, invalid ? 'border-red-400' : 'border-slate-300', className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function SelectInput({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(base, 'border-slate-300 cursor-pointer', className)} {...rest}>{children}</select>;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(base, 'border-slate-300 min-h-20', className)} {...rest} />;
}
