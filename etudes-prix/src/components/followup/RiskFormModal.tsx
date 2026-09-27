import { useState } from 'react';
import type { Risk, RiskCategory, RiskLevel3, RiskStatus } from '../../domain/risks';
import { RISK_CATEGORY_LABELS, RISK_LEVEL_LABELS, RISK_STATUS_LABELS } from '../../domain/risks';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, SelectInput, TextArea, TextInput } from '../ui/Field';

export type RiskForm = Omit<Risk, 'id' | 'number' | 'createdAt'> & { id?: string };

export function RiskFormModal({ risk, owner, onClose, onSave }: { risk?: Risk; owner: string; onClose: () => void; onSave: (r: RiskForm) => void }) {
  const [f, setF] = useState<RiskForm>(risk ?? {
    title: '', description: '', level: 'important', category: 'technique', source: { label: '' }, impact: '', amount: null, owner, action: '', status: 'ouvert',
  });
  const [amount, setAmount] = useState(risk?.amount != null ? String(risk.amount) : '');
  const [error, setError] = useState('');
  const set = (p: Partial<RiskForm>) => { setF({ ...f, ...p }); setError(''); };
  return (
    <Modal open onClose={onClose} size="lg" title={risk ? 'Modifier le risque' : 'Nouveau risque'}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => {
        if (!f.title.trim()) { setError('Indiquez l’intitulé du risque.'); return; }
        const n = amount.trim() ? Number(amount.replace(/\s/g, '').replace(',', '.')) : null;
        if (n !== null && !(n >= 0)) { setError('Montant invalide.'); return; }
        if (f.level === 'critique' && !f.action.trim()) { setError('Un risque critique doit avoir une action.'); return; }
        onSave({ ...f, title: f.title.trim(), amount: n });
      }}>Enregistrer</Button></>}>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <Field label="Intitulé" required className="sm:col-span-3"><TextInput value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex. Puissance disponible non confirmée" /></Field>
        <Field label="Niveau">
          <SelectInput value={f.level} onChange={(e) => set({ level: e.target.value as RiskLevel3 })}>
            {(Object.keys(RISK_LEVEL_LABELS) as RiskLevel3[]).map((k) => <option key={k} value={k}>{k === 'critique' ? '🔴' : k === 'important' ? '🟠' : '🟡'} {RISK_LEVEL_LABELS[k]}</option>)}
          </SelectInput>
        </Field>
        <Field label="Nature">
          <SelectInput value={f.category} onChange={(e) => set({ category: e.target.value as RiskCategory })}>
            {(Object.keys(RISK_CATEGORY_LABELS) as RiskCategory[]).map((k) => <option key={k} value={k}>{RISK_CATEGORY_LABELS[k]}</option>)}
          </SelectInput>
        </Field>
        <Field label="Statut">
          <SelectInput value={f.status} onChange={(e) => set({ status: e.target.value as RiskStatus })}>
            {(Object.keys(RISK_STATUS_LABELS) as RiskStatus[]).map((k) => <option key={k} value={k}>{RISK_STATUS_LABELS[k]}</option>)}
          </SelectInput>
        </Field>
        <Field label="Description" className="sm:col-span-3"><TextArea value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Source" hint="Ex. CCTP p.42, CCAP art. 5, visite de site"><TextInput value={f.source.label} onChange={(e) => set({ source: { ...f.source, label: e.target.value } })} /></Field>
        <Field label="Montant potentiel (€ HT)"><TextInput inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} /></Field>
        <Field label="Responsable"><TextInput value={f.owner} onChange={(e) => set({ owner: e.target.value })} /></Field>
        <Field label="Impact" className="sm:col-span-3"><TextInput value={f.impact} onChange={(e) => set({ impact: e.target.value })} placeholder="Ce qui se passe si le risque se réalise" /></Field>
        <Field label="Action" className="sm:col-span-3" required={f.level === 'critique'}><TextArea value={f.action} onChange={(e) => set({ action: e.target.value })} placeholder="Question posée, provision, réserve dans l’offre, variante…" /></Field>
        {error && <p className="font-medium text-red-700 sm:col-span-3" role="alert">⚠ {error}</p>}
      </div>
    </Modal>
  );
}
