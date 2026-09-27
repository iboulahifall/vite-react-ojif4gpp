import clsx from 'clsx';
import type { Lot, StudyDraft } from '../../domain/types';
import type { DraftErrors } from '../../domain/studyFactory';
import { MARKET_LABELS, RISK_LABELS } from '../../domain/catalog';
import { Field, SelectInput, TextArea, TextInput } from '../ui/Field';
import { InfoTip } from '../ui/Help';

type Editable = Pick<StudyDraft, 'name' | 'client' | 'reference' | 'location' | 'marketType' | 'dueDate' | 'dueTime' | 'owner' | 'estimatedAmount' | 'riskLevel' | 'lots' | 'notes'>;

export function ProjectFields({ value, errors = {}, onChange, showLots = true }: {
  value: Editable;
  errors?: DraftErrors;
  onChange: (patch: Partial<Editable>) => void;
  showLots?: boolean;
}) {
  const toggleLot = (lot: Lot) =>
    onChange({ lots: value.lots.includes(lot) ? value.lots.filter((l) => l !== lot) : [...value.lots, lot].sort() as Lot[] });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Nom du projet" required error={errors.name} className="md:col-span-2" hint="Ex. : Rénovation électrique — Immeuble X">
        <TextInput value={value.name} invalid={!!errors.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Nom de l’opération" />
      </Field>
      <Field label="Client / maître d’ouvrage" required error={errors.client}>
        <TextInput value={value.client} invalid={!!errors.client} onChange={(e) => onChange({ client: e.target.value })} placeholder="Ex. : Ville de …" />
      </Field>
      <Field label="Référence affaire" required error={errors.reference} hint="Proposée automatiquement, modifiable.">
        <TextInput value={value.reference} invalid={!!errors.reference} onChange={(e) => onChange({ reference: e.target.value })} />
      </Field>
      <Field label="Localisation">
        <TextInput value={value.location} onChange={(e) => onChange({ location: e.target.value })} placeholder="Ville, adresse" />
      </Field>
      <Field label="Type de marché">
        <SelectInput value={value.marketType} onChange={(e) => onChange({ marketType: e.target.value as Editable['marketType'] })}>
          {Object.entries(MARKET_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectInput>
      </Field>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Date de remise" required error={errors.dueDate}>
          <TextInput type="date" value={value.dueDate} invalid={!!errors.dueDate} onChange={(e) => onChange({ dueDate: e.target.value })} />
        </Field>
        <Field label="Heure">
          <TextInput type="time" value={value.dueTime} onChange={(e) => onChange({ dueTime: e.target.value })} />
        </Field>
      </div>
      <Field label="Responsable de l’étude" required error={errors.owner}>
        <TextInput value={value.owner} invalid={!!errors.owner} onChange={(e) => onChange({ owner: e.target.value })} />
      </Field>
      <Field label="Montant estimé (€ HT)" error={errors.estimatedAmount} hint="Ordre de grandeur, affiné lors du chiffrage.">
        <TextInput type="number" min={0} step={1000} value={value.estimatedAmount || ''} invalid={!!errors.estimatedAmount}
          onChange={(e) => onChange({ estimatedAmount: Math.max(0, Number(e.target.value) || 0) })} placeholder="0" />
      </Field>
      <Field label="Niveau de risque pressenti">
        <SelectInput value={value.riskLevel} onChange={(e) => onChange({ riskLevel: e.target.value as Editable['riskLevel'] })}>
          {Object.entries(RISK_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectInput>
      </Field>
      {showLots && (
        <div className="md:col-span-2">
          <span className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-800">
            Lots à chiffrer <span className="text-red-600">*</span>
            <InfoTip text="CFO = courants forts (distribution électrique, éclairage, prises, force). CFA = courants faibles (sécurité incendie, VDI, contrôle d’accès, vidéo, GTB)." />
          </span>
          <div className="flex flex-wrap gap-3">
            {(['CFO', 'CFA'] as Lot[]).map((lot) => {
              const on = value.lots.includes(lot);
              return (
                <button key={lot} type="button" onClick={() => toggleLot(lot)} aria-pressed={on}
                  className={clsx('flex min-w-56 flex-1 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition cursor-pointer',
                    on ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <span className={clsx('flex h-5 w-5 items-center justify-center rounded border-2 text-xs font-bold', on ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300')}>{on ? '✓' : ''}</span>
                  <span>
                    <span className="block font-semibold">{lot === 'CFO' ? '⚡ CFO — Courants forts' : '📡 CFA — Courants faibles'}</span>
                    <span className="block text-xs text-slate-500">{lot === 'CFO' ? 'TGBT, tableaux, distribution, éclairage, prises, force' : 'SSI, VDI, contrôle d’accès, vidéo, GTB'}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.lots && <span className="mt-1 block text-xs font-medium text-red-700" role="alert">⚠ {errors.lots}</span>}
        </div>
      )}
      <Field label="Notes" className="md:col-span-2">
        <TextArea value={value.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Visite de site, contacts, remarques…" />
      </Field>
    </div>
  );
}
