import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import type { Study, HistoryEntry } from '../../domain/types';
import { lineCost, netFromCatalog, SOURCE_LABELS, STATUS_LABELS, type PriceLine, type PriceSource, type SourceKind, type SourceStatus } from '../../domain/chiffrage';
import { effectiveQty, formatQty, type MetreLine } from '../../domain/metre';
import { formatDateTime, formatEuro } from '../../domain/format';
import { useStore } from '../../state/store';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, SelectInput, TextArea, TextInput } from '../ui/Field';
import { SourceBadge } from './SourceBadge';

function parse(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
const show = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

/** Trace et saisie du prix d'une ligne : « aucun prix important ne doit être inexplicable ». */
export function PriceLineModal({ study, line, price, history, onClose, onSave }: {
  study: Study;
  line: MetreLine;
  price?: PriceLine;
  history: HistoryEntry[];
  onClose: () => void;
  onSave: (patch: Omit<PriceLine, 'metreLineId'>) => void;
}) {
  const { suppliers } = useStore();
  const locked = study.status === 'remise';
  const [mat, setMat] = useState(show(price?.materialUnit));
  const [hours, setHours] = useState(show(price?.laborHoursUnit));
  const [sub, setSub] = useState(show(price?.subcontractUnit));
  const [src, setSrc] = useState<PriceSource>(price?.source ?? { kind: 'catalogue', status: 'a-confirmer' });
  const [catalog, setCatalog] = useState(show(price?.source.catalogPrice));
  const [discount, setDiscount] = useState(show(price?.source.discountPct));
  const [comment, setComment] = useState(price?.comment ?? '');
  const [error, setError] = useState('');
  useEffect(() => setError(''), [mat, hours, sub, catalog, discount]);

  const qty = effectiveQty(line);
  const draft: PriceLine = {
    metreLineId: line.id,
    materialUnit: Number.isNaN(parse(mat)) ? null : parse(mat),
    laborHoursUnit: Number.isNaN(parse(hours)) ? null : parse(hours),
    subcontractUnit: Number.isNaN(parse(sub)) ? null : parse(sub),
    source: src,
    comment,
  };
  const cost = lineCost(line, draft, study.chiffrage.params);
  const before = lineCost(line, price, study.chiffrage.params);
  const supplier = suppliers.find((s) => s.id === src.supplierId);
  const consultation = study.consultations.find((c) => c.id === src.consultationId);
  const offerFiles = useMemo(() => study.consultations.flatMap((c) => c.requests.flatMap((r) => r.offer?.files.map((f) => f.name) ?? [])), [study.consultations]);

  const applyCatalog = () => {
    const c = parse(catalog);
    const d = parse(discount) ?? 0;
    if (c === null || Number.isNaN(c) || Number.isNaN(d) || d > 100) { setError('Prix catalogue ou remise invalide.'); return; }
    setMat(show(netFromCatalog(c, d)));
    setSrc({ ...src, catalogPrice: c, discountPct: d, kind: src.kind === 'base' ? 'catalogue' : src.kind });
  };

  const save = () => {
    if ([mat, hours, sub, catalog, discount].some((v) => Number.isNaN(parse(v)))) { setError('Une valeur saisie est invalide.'); return; }
    onSave({
      materialUnit: draft.materialUnit,
      laborHoursUnit: draft.laborHoursUnit,
      subcontractUnit: draft.subcontractUnit,
      source: { ...src, catalogPrice: parse(catalog), discountPct: parse(discount) },
      comment,
    });
  };

  return (
    <Modal open onClose={onClose} size="lg" title={<span><span className="mr-2 text-slate-500">{line.ref}</span>{line.designation}</span>}
      footer={<><Button variant="secondary" onClick={onClose}>Fermer</Button>{!locked && <Button onClick={save}>Enregistrer…</Button>}</>}>
      <div className="space-y-5 text-sm">
        {/* Trace du prix (§20) */}
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Source du prix</h3>
            <SourceBadge status={cost.missing ? 'manquant' : src.status} />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Origine</dt><dd className="font-semibold">{SOURCE_LABELS[src.kind]}</dd></div>
            <div><dt className="text-xs text-slate-500">Fournisseur</dt><dd className="font-semibold">{supplier ? <Link to={`/fournisseurs/${supplier.id}`} className="text-brand-700 hover:underline">{supplier.name}</Link> : '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Référence</dt><dd className="font-semibold">{src.reference || '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Prix catalogue</dt><dd className="font-semibold tabular">{src.catalogPrice != null ? formatEuro(src.catalogPrice) : '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Remise</dt><dd className="font-semibold tabular">{src.discountPct != null ? `${src.discountPct} %` : '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Prix retenu (unitaire)</dt><dd className="font-bold tabular text-slate-900">{draft.subcontractUnit !== null ? `${formatEuro(draft.subcontractUnit)} ST` : draft.materialUnit !== null ? formatEuro(draft.materialUnit) : '—'}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-slate-500">Document</dt><dd className="flex items-center gap-1 font-semibold">{src.documentName ? <><FileText size={14} className="text-red-600" /> {src.documentName}</> : '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Consultation</dt><dd className="font-semibold">{consultation ? <Link to={`/etudes/${study.id}/consultations/${consultation.id}`} className="text-brand-700 hover:underline">{consultation.label}</Link> : '—'}</dd></div>
          </dl>
          {src.note && <p className="mt-2 text-xs text-slate-600">{src.note}</p>}
        </section>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-5">
          <div><div className="text-xs text-slate-500">Quantité</div><div className="font-semibold tabular">{formatQty(qty)} {line.unit}</div></div>
          <div><div className="text-xs text-slate-500">Matériel</div><div className="font-semibold tabular">{formatEuro(cost.material)}</div></div>
          <div><div className="text-xs text-slate-500">Main-d’œuvre</div><div className="font-semibold tabular">{formatEuro(cost.labor)} <span className="text-xs font-normal text-slate-500">({formatQty(cost.laborHours)} h)</span></div></div>
          <div><div className="text-xs text-slate-500">Sous-traitance</div><div className="font-semibold tabular">{formatEuro(cost.subcontract)}</div></div>
          <div><div className="text-xs text-slate-500">Déboursé sec</div><div className="font-bold tabular">{formatEuro(cost.total)}</div>
            {cost.total !== before.total && <div className="text-xs text-orange-700">avant : {formatEuro(before.total)}</div>}</div>
        </div>

        {!locked && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Fourniture (€ HT / unité)"><TextInput inputMode="decimal" value={mat} invalid={Number.isNaN(parse(mat))} onChange={(e) => setMat(e.target.value)} /></Field>
              <Field label="Pose (heures / unité)" hint={`Taux : ${study.chiffrage.params.hourlyRate} €/h`}><TextInput inputMode="decimal" value={hours} invalid={Number.isNaN(parse(hours))} onChange={(e) => setHours(e.target.value)} /></Field>
              <Field label="Sous-traitance (€ HT / unité)" hint="Pose comprise"><TextInput inputMode="decimal" value={sub} invalid={Number.isNaN(parse(sub))} onChange={(e) => setSub(e.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
              <Field label="Prix catalogue (€)" className="w-40"><TextInput inputMode="decimal" value={catalog} onChange={(e) => setCatalog(e.target.value)} /></Field>
              <Field label="Remise (%)" className="w-28"><TextInput inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
              <Button variant="secondary" onClick={applyCatalog}>Calculer le prix net → fourniture</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Origine du prix">
                <SelectInput value={src.kind} onChange={(e) => setSrc({ ...src, kind: e.target.value as SourceKind })}>
                  {(Object.keys(SOURCE_LABELS) as SourceKind[]).map((k) => <option key={k} value={k}>{SOURCE_LABELS[k]}</option>)}
                </SelectInput>
              </Field>
              <Field label="Statut">
                <SelectInput value={src.status} onChange={(e) => setSrc({ ...src, status: e.target.value as SourceStatus })}>
                  {(Object.keys(STATUS_LABELS) as SourceStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
                </SelectInput>
              </Field>
              <Field label="Fournisseur">
                <SelectInput value={src.supplierId ?? ''} onChange={(e) => setSrc({ ...src, supplierId: e.target.value || undefined })}>
                  <option value="">—</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </SelectInput>
              </Field>
              <Field label="Référence (devis, tarif)"><TextInput value={src.reference ?? ''} onChange={(e) => setSrc({ ...src, reference: e.target.value })} /></Field>
              <Field label="Document justificatif" className="sm:col-span-2">
                <TextInput list="offer-docs" value={src.documentName ?? ''} onChange={(e) => setSrc({ ...src, documentName: e.target.value || undefined })} placeholder="Ex. Offre fournisseur 2026-09-27.pdf" />
                <datalist id="offer-docs">{offerFiles.map((f) => <option key={f} value={f} />)}</datalist>
              </Field>
            </div>
            <Field label="Commentaire"><TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Hypothèse, marque, variante…" /></Field>
            {error && <p className="font-medium text-red-700" role="alert">⚠ {error}</p>}
          </>
        )}

        <div>
          <p className="mb-1.5 font-medium text-slate-800">Historique du prix</p>
          {history.length === 0 ? <p className="text-xs text-slate-500">Aucune modification enregistrée.</p> : (
            <ol className="max-h-40 space-y-1.5 overflow-y-auto">
              {history.map((h) => (
                <li key={h.id} className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs">
                  <span className="text-slate-500">{formatDateTime(h.date)} · {h.user}</span> — <span className="font-medium">{h.field}</span> :{' '}
                  <span className="text-slate-500 line-through">{h.oldValue}</span> → <strong>{h.newValue}</strong>{h.reason && h.reason !== '—' && <span className="text-slate-500"> — {h.reason}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}
