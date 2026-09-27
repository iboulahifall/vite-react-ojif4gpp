import { useEffect, useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { calcFromDetail, effectiveQty, formatQty, gapOf, type MetreDetailRow, type MetreLine } from '../../domain/metre';
import { FAMILIES } from '../../domain/catalog';
import type { HistoryEntry } from '../../domain/types';
import type { MetreLinePatch } from '../../state/store';
import { newId } from '../../domain/studyFactory';
import { formatDateTime } from '../../domain/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, SelectInput, TextArea, TextInput } from '../ui/Field';
import { GapBadge } from './GapBadge';

/** Détail d'une ligne : calcul du métré, rattachement, commentaire et historique. */
export function MetreLineModal({ line, history, locked, onClose, onSave, onDelete }: {
  line: MetreLine | null;
  history: HistoryEntry[];
  locked?: boolean;
  onClose: () => void;
  onSave: (patch: MetreLinePatch) => void;
  onDelete: () => void;
}) {
  const [rows, setRows] = useState<MetreDetailRow[]>([]);
  const [comment, setComment] = useState('');
  const [familyId, setFamilyId] = useState<string>('');
  const [ref, setRef] = useState('');
  const [designation, setDesignation] = useState('');
  const [unit, setUnit] = useState('');
  useEffect(() => {
    if (!line) return;
    setRows(line.calcDetail);
    setComment(line.comment);
    setFamilyId(line.familyId ?? '');
    setRef(line.ref);
    setDesignation(line.designation);
    setUnit(line.unit);
  }, [line]);
  if (!line) return null;

  const total = calcFromDetail(rows);
  const manual = line.source === 'manuel';
  const setRow = (id: string, patch: Partial<MetreDetailRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const num = (s: string) => { const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : 0; };

  const save = () => {
    const patch: MetreLinePatch = {};
    if (JSON.stringify(rows) !== JSON.stringify(line.calcDetail)) {
      patch.calcDetail = rows;
      patch.calcQty = rows.length ? total : line.calcQty;
    }
    if (comment !== line.comment) patch.comment = comment;
    if ((familyId || null) !== line.familyId) patch.familyId = familyId || null;
    if (manual) {
      if (ref !== line.ref) patch.ref = ref;
      if (designation !== line.designation && designation.trim()) patch.designation = designation;
      if (unit !== line.unit) patch.unit = unit;
    }
    onSave(patch);
  };

  const preview: MetreLine = { ...line, calcQty: rows.length ? total : line.calcQty };

  return (
    <Modal open onClose={onClose} size="lg" title={<span>{line.ref && <span className="mr-2 text-slate-500">{line.ref}</span>}{line.designation}</span>}
      footer={
        <>
          {(manual || line.removedFromDpgf) && !locked && (
            <Button variant="ghost" className="mr-auto text-red-700 hover:bg-red-50" icon={<Trash2 size={14} />} onClick={onDelete}>Supprimer la ligne</Button>
          )}
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
          {!locked && <Button onClick={save}>Enregistrer</Button>}
        </>
      }>
      <div className="space-y-5 text-sm">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
          <div><div className="text-xs text-slate-500">DPGF</div><div className="font-semibold tabular">{formatQty(line.dpgfQty)} {line.unit}</div></div>
          <div><div className="text-xs text-slate-500">Calculé</div><div className="font-semibold tabular">{formatQty(preview.calcQty)} {line.unit}</div></div>
          <div><div className="text-xs text-slate-500">Retenu</div><div className="font-semibold tabular">{formatQty(effectiveQty(preview))} {line.unit}{line.retainedQty === null && <span className="ml-1 text-xs font-normal italic text-slate-500">(proposé)</span>}</div></div>
          <div><div className="text-xs text-slate-500">Écart</div><GapBadge gap={gapOf(preview)} /></div>
        </div>

        {manual && (
          <div className="grid gap-3 sm:grid-cols-[6rem_1fr_5rem]">
            <Field label="Poste"><TextInput value={ref} disabled={locked} onChange={(e) => setRef(e.target.value)} /></Field>
            <Field label="Désignation"><TextInput value={designation} disabled={locked} onChange={(e) => setDesignation(e.target.value)} /></Field>
            <Field label="Unité"><TextInput value={unit} disabled={locked} onChange={(e) => setUnit(e.target.value)} /></Field>
          </div>
        )}

        <Field label="Famille de postes" hint={line.familyId ? undefined : 'Cette ligne n’a pas été reconnue : choisissez sa famille.'}>
          <SelectInput value={familyId} disabled={locked} onChange={(e) => setFamilyId(e.target.value)}>
            <option value="">— À rattacher —</option>
            {(['CFO', 'CFA'] as const).map((lot) => (
              <optgroup key={lot} label={lot}>
                {FAMILIES.filter((f) => f.lot === lot).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </optgroup>
            ))}
          </SelectInput>
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-medium text-slate-800">Détail du métré</span>
            <span className="text-xs text-slate-500">Quantité × coefficient (ex. 12 bureaux × 4 prises)</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr><th className="pb-1 font-medium">Désignation</th><th className="w-24 pb-1 text-right font-medium">Quantité</th><th className="w-24 pb-1 text-right font-medium">Coef.</th><th className="w-24 pb-1 text-right font-medium">Sous-total</th><th className="w-8" /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1 pr-2"><TextInput value={r.label} disabled={locked} placeholder="Ex. Bureaux R+1" onChange={(e) => setRow(r.id, { label: e.target.value })} aria-label="Désignation du détail" /></td>
                  <td className="py-1 pr-2"><TextInput value={String(r.qty).replace('.', ',')} disabled={locked} inputMode="decimal" className="text-right" onChange={(e) => setRow(r.id, { qty: num(e.target.value) })} aria-label="Quantité" /></td>
                  <td className="py-1 pr-2"><TextInput value={String(r.coef).replace('.', ',')} disabled={locked} inputMode="decimal" className="text-right" onChange={(e) => setRow(r.id, { coef: num(e.target.value) })} aria-label="Coefficient" /></td>
                  <td className="py-1 pr-2 text-right tabular">{formatQty(Math.round(r.qty * r.coef * 100) / 100)}</td>
                  <td className="py-1">{!locked && <button onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="rounded p-1 text-slate-400 hover:text-red-700 cursor-pointer" aria-label="Retirer la ligne de détail"><Trash2 size={14} /></button>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-2">{!locked && <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setRows((rs) => [...rs, { id: newId('d'), label: '', qty: 0, coef: 1 }])}>Ajouter une ligne de détail</Button>}</td>
                <td colSpan={2} className="pt-2 text-right text-xs font-semibold uppercase text-slate-500">Total calculé</td>
                <td className="pt-2 text-right font-bold tabular">{rows.length ? `${formatQty(total)} ${line.unit}` : '—'}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          {!rows.length && <p className="mt-1 text-xs text-slate-500">Sans détail, la quantité calculée se saisit directement dans le tableau.</p>}
        </div>

        {line.retainedQty !== null && !locked && (
          <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={() => onSave({ retainedQty: null })}>
            Revenir à la quantité proposée ({formatQty(line.calcQty ?? line.dpgfQty)})
          </Button>
        )}

        <Field label="Commentaire"><TextArea value={comment} disabled={locked} onChange={(e) => setComment(e.target.value)} placeholder="Hypothèse, source du comptage, indice de plan…" /></Field>

        <div>
          <p className="mb-1.5 font-medium text-slate-800">Historique de la ligne</p>
          {history.length === 0 ? <p className="text-xs text-slate-500">Aucune modification enregistrée.</p> : (
            <ol className="max-h-48 space-y-1.5 overflow-y-auto">
              {history.map((h) => (
                <li key={h.id} className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs">
                  <span className="text-slate-500">{formatDateTime(h.date)} · {h.user}</span>
                  <span className="ml-2 font-medium text-slate-800">{h.field.replace(/^Métré [^—]+— /, '')}</span> :{' '}
                  <span className="text-slate-500 line-through">{h.oldValue}</span> → <span className="font-semibold">{h.newValue}</span>
                  {h.reason && h.reason !== '—' && <span className="text-slate-500"> — {h.reason}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}
