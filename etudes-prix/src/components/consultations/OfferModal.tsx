import { useMemo, useState } from 'react';
import { Paperclip } from 'lucide-react';
import type { Consultation, Offer, Supplier, SupplierRequest } from '../../domain/consultations';
import { offerTotal } from '../../domain/consultations';
import { effectiveQty, formatQty, round, type MetreLine } from '../../domain/metre';
import { addDays, toISODate } from '../../domain/dates';
import { formatEuro } from '../../domain/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';

function num(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/**
 * Saisie d'une offre : prix unitaires sur les lignes du métré consultées
 * (comparaison sur des quantités identiques) ou montant global.
 */
export function OfferModal({ consultation, request, supplier, metre, onClose, onSave }: {
  consultation: Consultation;
  request: SupplierRequest;
  supplier?: Supplier;
  metre: MetreLine[];
  onClose: () => void;
  onSave: (offer: Offer, files: File[]) => void;
}) {
  const prev = request.offer;
  const lines = consultation.metreLineIds.map((id) => metre.find((m) => m.id === id)).filter((m): m is MetreLine => !!m);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, String(prev?.lines.find((x) => x.metreLineId === l.id)?.unitPrice ?? '').replace('.', ',')])));
  const [amount, setAmount] = useState(prev?.amount != null ? String(prev.amount).replace('.', ',') : '');
  const [receivedAt, setReceivedAt] = useState(prev?.receivedAt ?? toISODate(new Date()));
  const [reference, setReference] = useState(prev?.reference ?? '');
  const [delay, setDelay] = useState(prev?.delay ?? '');
  const [validUntil, setValidUntil] = useState(prev?.validUntil ?? toISODate(addDays(new Date(), 30)));
  const [exclusions, setExclusions] = useState(prev?.exclusions ?? '');
  const [comment, setComment] = useState(prev?.comment ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  const draft: Offer = useMemo(() => ({
    receivedAt, reference, delay, validUntil, exclusions, comment, files: prev?.files ?? [],
    amount: Number.isNaN(num(amount)) ? null : num(amount),
    lines: lines.map((l) => ({ metreLineId: l.id, unitPrice: Number.isNaN(num(prices[l.id] ?? '')) ? null : num(prices[l.id] ?? '') })),
  }), [receivedAt, reference, delay, validUntil, exclusions, comment, amount, prices, lines, prev?.files]);
  const total = offerTotal(draft, metre);
  const usesLines = draft.lines.some((l) => l.unitPrice !== null);

  const save = () => {
    if (Object.values(prices).some((p) => Number.isNaN(num(p))) || Number.isNaN(num(amount))) { setError('Un prix saisi est invalide.'); return; }
    if (total === null) { setError('Saisissez au moins un prix unitaire ou le montant global.'); return; }
    if (!receivedAt) { setError('Indiquez la date de réception.'); return; }
    onSave(draft, files);
  };

  return (
    <Modal open onClose={onClose} size="lg" title={`Offre de ${supplier?.name ?? 'fournisseur'} — ${consultation.label}`}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save}>Enregistrer l’offre</Button></>}>
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Reçue le" required><TextInput type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} /></Field>
          <Field label="Référence du devis"><TextInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. DEV-2026-0412" /></Field>
          <Field label="Validité jusqu’au"><TextInput type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
        </div>

        {lines.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-slate-800">Prix unitaires HT <span className="font-normal text-slate-500">— sur les quantités retenues du métré</span></p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr><th className="pb-1 font-medium">Poste</th><th className="pb-1 font-medium">Désignation</th><th className="pb-1 text-right font-medium">Quantité</th><th className="w-32 pb-1 text-right font-medium">PU HT (€)</th><th className="w-28 pb-1 text-right font-medium">Total HT</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => {
                  const pu = num(prices[l.id] ?? '');
                  const q = effectiveQty(l);
                  return (
                    <tr key={l.id}>
                      <td className="py-1 pr-2 tabular text-slate-500">{l.ref}</td>
                      <td className="max-w-64 truncate py-1 pr-2" title={l.designation}>{l.designation}</td>
                      <td className="py-1 pr-2 text-right tabular">{formatQty(q)} {l.unit}</td>
                      <td className="py-1 pr-2">
                        <TextInput inputMode="decimal" className="text-right" value={prices[l.id] ?? ''} aria-label={`Prix unitaire ${l.ref}`}
                          invalid={Number.isNaN(pu)} onChange={(e) => { setPrices({ ...prices, [l.id]: e.target.value }); setError(''); }} />
                      </td>
                      <td className="py-1 text-right tabular">{pu !== null && !Number.isNaN(pu) && q !== null ? formatEuro(round(pu * q)) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <Field label={lines.length ? 'Ou montant global HT (€)' : 'Montant HT (€)'} hint={usesLines ? 'Ignoré : le total est calculé à partir des prix unitaires.' : undefined}>
            <TextInput inputMode="decimal" value={amount} invalid={Number.isNaN(num(amount))} onChange={(e) => { setAmount(e.target.value); setError(''); }} />
          </Field>
          <div className="rounded-lg bg-slate-50 px-4 py-2">
            <div className="text-xs text-slate-500">Total de l’offre</div>
            <div className="text-xl font-bold tabular text-slate-900">{total === null ? '—' : formatEuro(total)} <span className="text-sm font-normal text-slate-500">HT</span></div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Délai"><TextInput value={delay} onChange={(e) => setDelay(e.target.value)} placeholder="Ex. 6 semaines après commande" /></Field>
          <Field label="Exclusions / réserves"><TextInput value={exclusions} onChange={(e) => setExclusions(e.target.value)} placeholder="Ex. raccordements non compris" /></Field>
        </div>
        <Field label="Commentaire"><TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Prix catalogue, remise, conditions…" /></Field>

        <div>
          <p className="mb-1 font-medium text-slate-800">Documents de l’offre</p>
          {prev?.files.length ? <p className="mb-1 text-xs text-slate-600">Déjà joints : {prev.files.map((x) => x.name).join(', ')}</p> : null}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-slate-700 hover:border-brand-400">
            <Paperclip size={16} /> {files.length ? `${files.length} fichier(s) à joindre : ${files.map((x) => x.name).join(', ')}` : 'Joindre le devis (PDF, Excel…)'}
            <input type="file" multiple hidden data-testid="offer-files" onChange={(e) => { if (e.target.files) setFiles([...files, ...Array.from(e.target.files)]); e.target.value = ''; }} />
          </label>
        </div>
        {error && <p className="font-medium text-red-700" role="alert">⚠ {error}</p>}
      </div>
    </Modal>
  );
}
