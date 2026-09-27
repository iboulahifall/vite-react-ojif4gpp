import { useState } from 'react';
import type { Supplier } from '../../domain/consultations';
import { FAMILIES } from '../../domain/catalog';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, SelectInput, TextArea, TextInput } from '../ui/Field';

export function SupplierFormModal({ supplier, onClose, onSave }: {
  supplier?: Supplier;
  onClose: () => void;
  onSave: (s: Omit<Supplier, 'id'> & { id?: string }) => void;
}) {
  const [f, setF] = useState<Omit<Supplier, 'id'> & { id?: string }>(supplier ?? { name: '', kind: 'fournisseur', contactName: '', email: '', phone: '', familyIds: [], notes: '' });
  const [error, setError] = useState('');
  const toggle = (id: string) => setF((x) => ({ ...x, familyIds: x.familyIds.includes(id) ? x.familyIds.filter((y) => y !== id) : [...x.familyIds, id] }));
  return (
    <Modal open onClose={onClose} size="lg" title={supplier ? `Modifier ${supplier.name}` : 'Nouveau fournisseur / sous-traitant'}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => {
        if (!f.name.trim()) { setError('Indiquez le nom.'); return; }
        if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) { setError('Adresse e-mail invalide.'); return; }
        onSave({ ...f, name: f.name.trim() });
      }}>Enregistrer</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" required error={error} className="sm:col-span-2"><TextInput value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setError(''); }} /></Field>
        <Field label="Type">
          <SelectInput value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Supplier['kind'] })}>
            <option value="fournisseur">Fournisseur (matériel)</option>
            <option value="sous-traitant">Sous-traitant (pose / prestation)</option>
          </SelectInput>
        </Field>
        <Field label="Contact"><TextInput value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} /></Field>
        <Field label="E-mail"><TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Téléphone"><TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-medium text-slate-800">Familles habituellement consultées</p>
          <div className="flex flex-wrap gap-1.5">
            {FAMILIES.map((fam) => {
              const on = f.familyIds.includes(fam.id);
              return (
                <button key={fam.id} type="button" onClick={() => toggle(fam.id)} aria-pressed={on}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset cursor-pointer ${on ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'}`}>
                  {fam.lot} · {fam.label}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Notes" className="sm:col-span-2"><TextArea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Conditions habituelles, remises, délais…" /></Field>
      </div>
    </Modal>
  );
}
