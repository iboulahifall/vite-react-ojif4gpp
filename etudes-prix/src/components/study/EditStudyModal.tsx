import { useEffect, useState } from 'react';
import type { Study } from '../../domain/types';
import { familiesOfLots, MARKET_LABELS, RISK_LABELS } from '../../domain/catalog';
import { validateProjectStep, type DraftErrors } from '../../domain/studyFactory';
import { formatDate, formatEuro } from '../../domain/format';
import type { TrackedChange } from '../../state/store';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ProjectFields } from './ProjectFields';

type Form = Pick<Study, 'name' | 'client' | 'reference' | 'location' | 'marketType' | 'dueDate' | 'dueTime' | 'owner' | 'estimatedAmount' | 'riskLevel' | 'lots' | 'notes'>;

const FIELDS: { key: keyof Form; label: string; fmt?: (v: never) => string }[] = [
  { key: 'name', label: 'Nom du projet' },
  { key: 'client', label: 'Client' },
  { key: 'reference', label: 'Référence' },
  { key: 'location', label: 'Localisation' },
  { key: 'marketType', label: 'Type de marché', fmt: (v: Form['marketType']) => MARKET_LABELS[v] },
  { key: 'dueDate', label: 'Date de remise', fmt: (v: string) => formatDate(v) },
  { key: 'dueTime', label: 'Heure de remise' },
  { key: 'owner', label: 'Responsable' },
  { key: 'estimatedAmount', label: 'Montant estimé', fmt: (v: number) => formatEuro(v) },
  { key: 'riskLevel', label: 'Niveau de risque', fmt: (v: Form['riskLevel']) => RISK_LABELS[v] },
  { key: 'lots', label: 'Lots', fmt: (v: string[]) => v.join(' + ') },
  { key: 'notes', label: 'Notes' },
];

export function diffStudy(before: Form, after: Form): TrackedChange[] {
  return FIELDS.filter((f) => JSON.stringify(before[f.key]) !== JSON.stringify(after[f.key])).map((f) => {
    const fmt = (f.fmt ?? ((v: unknown) => String(v || '—'))) as (v: unknown) => string;
    return { field: f.label, oldValue: fmt(before[f.key]), newValue: fmt(after[f.key]) };
  });
}

function pick(s: Study): Form {
  const { name, client, reference, location, marketType, dueDate, dueTime, owner, estimatedAmount, riskLevel, lots, notes } = s;
  return { name, client, reference, location, marketType, dueDate, dueTime, owner, estimatedAmount, riskLevel, lots, notes };
}

/** Formulaire d'édition. Les modifications sont soumises à confirmation (avec motif) par l'appelant. */
export function EditStudyModal({ study, open, onClose, onSubmit }: {
  study: Study;
  open: boolean;
  onClose: () => void;
  onSubmit: (patch: Partial<Study>, changes: TrackedChange[]) => void;
}) {
  const [form, setForm] = useState<Form>(pick(study));
  const [errors, setErrors] = useState<DraftErrors>({});
  useEffect(() => { if (open) { setForm(pick(study)); setErrors({}); } }, [open, study]);

  const save = () => {
    const e = validateProjectStep({ ...study, ...form });
    setErrors(e);
    if (Object.keys(e).length) return;
    const changes = diffStudy(pick(study), form);
    if (!changes.length) { onClose(); return; }
    const families = [
      ...study.families.filter((id) => familiesOfLots(form.lots).some((f) => f.id === id)),
      ...familiesOfLots(form.lots.filter((l) => !study.lots.includes(l))).map((f) => f.id),
    ];
    onSubmit({ ...form, families }, changes);
  };

  return (
    <Modal open={open} onClose={onClose} title="Modifier les informations de l’étude" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save}>Enregistrer…</Button></>}>
      <ProjectFields value={form} errors={errors} onChange={(p) => setForm((f) => ({ ...f, ...p }))} />
    </Modal>
  );
}
