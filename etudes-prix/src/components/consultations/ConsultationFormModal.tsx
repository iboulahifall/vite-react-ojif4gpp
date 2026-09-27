import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import type { Study } from '../../domain/types';
import type { Consultation, Supplier } from '../../domain/consultations';
import { FAMILIES } from '../../domain/catalog';
import { addDays, toISODate } from '../../domain/dates';
import { effectiveQty, formatQty } from '../../domain/metre';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, SelectInput, TextArea, TextInput } from '../ui/Field';
import { useStore } from '../../state/store';
import { SupplierFormModal } from './SupplierFormModal';

export interface ConsultationForm {
  label: string;
  kind: Consultation['kind'];
  familyIds: string[];
  metreLineIds: string[];
  dueDate: string;
  notes: string;
  supplierIds: string[];
  sendNow: boolean;
}

/** Création d'une consultation : postes, lignes du métré, fournisseurs, date de réponse. */
export function ConsultationFormModal({ study, initialFamily, onClose, onCreate }: {
  study: Study;
  initialFamily?: string;
  onClose: () => void;
  onCreate: (f: ConsultationForm) => void;
}) {
  const { suppliers, saveSupplier } = useStore();
  const consultTask = study.plan.find((t) => t.stage === 'consultation');
  const defaultDue = consultTask && consultTask.dueDate >= toISODate(new Date()) ? consultTask.dueDate : toISODate(addDays(new Date(), 7));
  const fam0 = FAMILIES.find((x) => x.id === initialFamily);
  const [f, setF] = useState<ConsultationForm>({
    label: fam0?.label ?? '',
    kind: 'fournisseur',
    familyIds: initialFamily ? [initialFamily] : [],
    metreLineIds: study.metre.filter((l) => l.familyId === initialFamily && !l.removedFromDpgf).map((l) => l.id),
    dueDate: defaultDue,
    notes: '',
    supplierIds: [],
    sendNow: false,
  });
  const [error, setError] = useState('');
  const [newSupplier, setNewSupplier] = useState(false);

  const lines = useMemo(() => study.metre.filter((l) => l.familyId && f.familyIds.includes(l.familyId) && !l.removedFromDpgf), [study.metre, f.familyIds]);
  const candidates = useMemo(() => [...suppliers].sort((a, b) => {
    const score = (s: Supplier) => (s.kind === f.kind ? 2 : 0) + (s.familyIds.some((x) => f.familyIds.includes(x)) ? 4 : 0);
    return score(b) - score(a) || a.name.localeCompare(b.name, 'fr');
  }), [suppliers, f.kind, f.familyIds]);

  const toggleFamily = (id: string) => {
    const on = f.familyIds.includes(id);
    const familyIds = on ? f.familyIds.filter((x) => x !== id) : [...f.familyIds, id];
    const famLines = study.metre.filter((l) => l.familyId === id && !l.removedFromDpgf).map((l) => l.id);
    const metreLineIds = on ? f.metreLineIds.filter((x) => !famLines.includes(x)) : [...new Set([...f.metreLineIds, ...famLines])];
    const label = f.label || FAMILIES.find((x) => x.id === id)?.label || '';
    setF({ ...f, familyIds, metreLineIds, label });
  };

  return (
    <>
      <Modal open onClose={onClose} size="lg" title="Nouvelle consultation"
        footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => {
          if (!f.label.trim()) { setError('Indiquez l’objet de la consultation.'); return; }
          if (!f.dueDate) { setError('Indiquez la date de réponse attendue.'); return; }
          onCreate({ ...f, label: f.label.trim() });
        }}>Créer la consultation</Button></>}>
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem_10rem]">
            <Field label="Objet" required error={error}><TextInput value={f.label} onChange={(e) => { setF({ ...f, label: e.target.value }); setError(''); }} placeholder="Ex. TGBT, Éclairage, SSI…" /></Field>
            <Field label="Type">
              <SelectInput value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Consultation['kind'] })}>
                <option value="fournisseur">Fourniture</option>
                <option value="sous-traitant">Sous-traitance</option>
              </SelectInput>
            </Field>
            <Field label="Réponse attendue le" required><TextInput type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
          </div>

          <div>
            <p className="mb-1 font-medium text-slate-800">Postes consultés</p>
            <div className="flex flex-wrap gap-1.5">
              {FAMILIES.filter((x) => study.lots.includes(x.lot)).map((fam) => {
                const on = f.familyIds.includes(fam.id);
                return (
                  <button key={fam.id} type="button" onClick={() => toggleFamily(fam.id)} aria-pressed={on}
                    className={clsx('rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset cursor-pointer', on ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50')}>
                    {fam.lot} · {fam.label}
                  </button>
                );
              })}
            </div>
          </div>

          {lines.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-slate-800">Lignes du métré à chiffrer <span className="font-normal text-slate-500">— les fournisseurs répondront sur ces quantités</span></p>
              <ul className="max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {lines.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5">
                      <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={f.metreLineIds.includes(l.id)}
                        onChange={(e) => setF({ ...f, metreLineIds: e.target.checked ? [...f.metreLineIds, l.id] : f.metreLineIds.filter((x) => x !== l.id) })} />
                      <span className="w-16 tabular text-slate-500">{l.ref}</span>
                      <span className="flex-1 truncate">{l.designation}</span>
                      <span className="tabular text-slate-600">{formatQty(effectiveQty(l))} {l.unit}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="font-medium text-slate-800">Fournisseurs consultés <span className="font-normal text-slate-500">— les plus pertinents en premier</span></p>
              <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setNewSupplier(true)}>Nouveau</Button>
            </div>
            <ul className="max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {candidates.map((s) => {
                const match = s.familyIds.some((x) => f.familyIds.includes(x));
                return (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5">
                      <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={f.supplierIds.includes(s.id)}
                        onChange={(e) => setF({ ...f, supplierIds: e.target.checked ? [...f.supplierIds, s.id] : f.supplierIds.filter((x) => x !== s.id) })} />
                      <span className="flex-1 truncate font-medium">{s.name}</span>
                      <span className="text-xs text-slate-500">{s.kind === 'fournisseur' ? 'Fournisseur' : 'Sous-traitant'}</span>
                      {match && <span className="rounded bg-emerald-100 px-1.5 text-[11px] font-semibold text-emerald-800">habituel</span>}
                    </label>
                  </li>
                );
              })}
              {candidates.length === 0 && <li className="px-3 py-3 text-slate-500">Annuaire vide : ajoutez un fournisseur.</li>}
            </ul>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={f.sendNow} onChange={(e) => setF({ ...f, sendNow: e.target.checked })} />
              Les demandes de prix sont déjà envoyées (date d’envoi : aujourd’hui)
            </label>
          </div>

          <Field label="Notes"><TextArea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Précisions techniques, marques imposées, conditions…" /></Field>
        </div>
      </Modal>
      {newSupplier && <SupplierFormModal onClose={() => setNewSupplier(false)} onSave={(data) => {
        const sup = saveSupplier({ ...data, familyIds: data.familyIds.length ? data.familyIds : f.familyIds });
        setF((x) => ({ ...x, supplierIds: [...x.supplierIds, sup.id] }));
        setNewSupplier(false);
      }} />}
    </>
  );
}
