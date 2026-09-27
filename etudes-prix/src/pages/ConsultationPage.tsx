import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { CheckCircle2, Download, Mail, Pencil, Plus, Printer, Trash2, Trophy, UserPlus } from 'lucide-react';
import { useStore } from '../state/store';
import type { Study } from '../domain/types';
import {
  compareOffers, consultationState, isLate, mailtoLink, missingLinePrices, offerLineTotal, offerTotal, STATUS_LABELS, type Consultation, type OfferFile,
} from '../domain/consultations';
import { FAMILIES } from '../domain/catalog';
import { effectiveQty, formatQty } from '../domain/metre';
import { formatDate, formatDateTime, formatEuro } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge, Tag } from '../components/ui/Badges';
import { HelpBox } from '../components/ui/Help';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Field, TextArea, TextInput } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';
import { RequestStatusBadge } from '../components/consultations/RequestStatusBadge';
import { useRequestActions } from '../components/consultations/useRequestActions';
import { downloadBlob } from '../lib/download';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';

export function ConsultationPage() {
  const { id = '', cid = '' } = useParams();
  const { getStudy } = useStore();
  const study = getStudy(id);
  const c = study?.consultations.find((x) => x.id === cid);
  if (!study || !c) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <p className="text-lg font-semibold">Consultation introuvable</p>
        <Link to={study ? `/etudes/${study.id}/consultations` : '/consultations'} className="mt-4 inline-block font-medium text-brand-700 underline">Retour aux consultations</Link>
      </Card>
    );
  }
  return <ConsultationView study={study} c={c} />;
}

function ConsultationView({ study, c }: { study: Study; c: Consultation }) {
  const store = useStore();
  const { suppliers } = store;
  const toast = useToast();
  const navigate = useNavigate();
  const actions = useRequestActions(study);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const locked = study.status === 'remise';
  const cmp = useMemo(() => compareOffers(c, study.metre), [c, study.metre]);
  const state = consultationState(c);
  const lines = c.metreLineIds.map((id) => study.metre.find((m) => m.id === id)).filter((m) => !!m);
  const priced = c.requests.filter((r) => r.offer && r.offer.lines.some((l) => l.unitPrice !== null));
  const sup = (id: string) => suppliers.find((s) => s.id === id);
  const history = study.history.filter((h) => h.target === c.id);

  const openFile = async (f: OfferFile) => {
    const blob = await store.getBlob(f.id);
    if (!blob) { toast('Document introuvable dans ce navigateur'); return; }
    downloadBlob(blob, f.name);
  };

  const requestMail = (email: string, contact: string) => {
    const body = `Bonjour${contact ? ` ${contact}` : ''},\n\nDans le cadre de l’appel d’offres « ${study.name} » (réf. ${study.reference}), nous vous consultons pour : ${c.label}.\n\n${lines.map((l) => `- ${l.ref} ${l.designation} : ${formatQty(effectiveQty(l))} ${l.unit}`).join('\n')}\n\nMerci de nous transmettre votre meilleure offre (prix unitaires HT, délai, validité, exclusions) avant le ${formatDate(c.dueDate)}.\n\nCordialement,\n${store.settings.userName}`;
    return mailtoLink(email, `Demande de prix — ${c.label} — ${study.name}`, body);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'Consultations', to: `/etudes/${study.id}/consultations` }, { label: c.label }]}
        title={<span className="flex flex-wrap items-center gap-2">{c.label} {study.isDemo && <DemoBadge />}</span>}
        subtitle={<>{c.kind === 'fournisseur' ? 'Fourniture' : 'Sous-traitance'} · réponse attendue le <strong>{formatDate(c.dueDate)}</strong> · {c.familyIds.map((f) => <Tag key={f}>{FAMILIES.find((x) => x.id === f)?.label ?? f}</Tag>)}</>}
        actions={
          <>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer</Button>
            <Button variant="secondary" icon={<Pencil size={16} />} disabled={locked} onClick={() => setEditing(true)}>Modifier</Button>
            <Button variant="ghost" icon={<Trash2 size={16} />} disabled={locked} className="text-red-700 hover:bg-red-50" onClick={() => setDeleting(true)} aria-label="Supprimer la consultation" title="Supprimer la consultation" />
          </>
        }
      />

      <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm">
        <span className="font-semibold">État :</span> <span>{state.label}</span>
        {c.notes && <span className="text-slate-600">· {c.notes}</span>}
      </div>

      <Card className="no-print">
        <CardHeader icon={<Trophy size={18} />} title="Comparaison des offres" subtitle={cmp.length ? 'Classement par montant HT, de la moins-disante à la plus chère.' : 'Aucune offre reçue pour le moment.'} />
        {cmp.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2">Rang</th><th className="px-3 py-2">Fournisseur</th><th className="px-3 py-2 text-right">Montant HT</th><th className="px-3 py-2 text-right">Écart</th>
                  <th className="px-3 py-2">Délai</th><th className="px-3 py-2">Validité</th><th className="px-3 py-2">Exclusions</th><th className="px-3 py-2">Documents</th><th className="px-4 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cmp.map((o) => {
                  const r = c.requests.find((x) => x.id === o.requestId)!;
                  const retained = c.retainedRequestId === r.id;
                  const missing = missingLinePrices(r.offer!, c);
                  return (
                    <tr key={o.requestId} className={clsx(retained && 'bg-emerald-50')}>
                      <td className="px-4 py-2.5 font-bold tabular">{o.rank === 1 ? '🥇 1' : o.rank ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-900">{sup(r.supplierId)?.name ?? '—'}</div>
                        <div className="text-xs text-slate-500">{r.offer!.reference || 'Sans référence'} · reçue le {formatDate(r.offer!.receivedAt)}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular">{o.total !== null ? formatEuro(o.total) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular">{o.gapToBest === 0 ? <span className="font-semibold text-emerald-700">moins-disant</span> : o.gapToBest !== null ? `+${Math.round(o.gapToBest * 100)} %` : '—'}</td>
                      <td className="px-3 py-2.5">{r.offer!.delay || '—'}</td>
                      <td className="px-3 py-2.5">{r.offer!.validUntil ? <span className={clsx(o.expired && 'font-semibold text-red-700')}>{o.expired ? '⚠ expirée ' : ''}{formatDate(r.offer!.validUntil)}</span> : '—'}</td>
                      <td className="max-w-56 px-3 py-2.5 text-xs text-slate-700">
                        {r.offer!.exclusions || '—'}
                        {missing.length > 0 && <div className="font-semibold text-orange-700">⚠ {missing.length} ligne(s) non chiffrée(s)</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.offer!.files.length ? r.offer!.files.map((f) => (
                          <button key={f.id} onClick={() => void openFile(f)} className="flex items-center gap-1 text-xs text-brand-700 hover:underline cursor-pointer"><Download size={12} /> {f.name}</button>
                        )) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {retained
                          ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> Retenue {!locked && <button className="ml-1 text-xs font-normal text-slate-500 underline cursor-pointer" onClick={() => actions.openRetain(c, null)}>annuler</button>}</span>
                          : !locked && <Button size="sm" variant={o.rank === 1 ? 'success' : 'secondary'} onClick={() => actions.openRetain(c, r)}>Retenir</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {lines.length > 0 && priced.length > 0 && (
        <Card className="no-print">
          <CardHeader title="Comparaison ligne par ligne" subtitle="Prix unitaires HT sur les quantités retenues du métré — le meilleur prix de chaque ligne est marqué ✓." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Poste</th><th className="px-3 py-2">Désignation</th><th className="px-3 py-2 text-right">Quantité</th>
                  {priced.map((r) => <th key={r.id} className="px-3 py-2 text-right">{sup(r.supplierId)?.name ?? '—'}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => {
                  const pus = priced.map((r) => r.offer!.lines.find((x) => x.metreLineId === l!.id)?.unitPrice ?? null);
                  const best = Math.min(...pus.filter((p): p is number => p !== null));
                  return (
                    <tr key={l!.id}>
                      <td className="px-4 py-2 tabular text-slate-500">{l!.ref}</td>
                      <td className="px-3 py-2">{l!.designation}</td>
                      <td className="px-3 py-2 text-right tabular">{formatQty(effectiveQty(l!))} {l!.unit}</td>
                      {priced.map((r, i) => {
                        const pu = pus[i];
                        const tot = offerLineTotal({ metreLineId: l!.id, unitPrice: pu }, study.metre);
                        return (
                          <td key={r.id} className={clsx('px-3 py-2 text-right tabular', pu === best && pus.filter((p) => p !== null).length > 1 && 'bg-emerald-50 font-semibold text-emerald-800')}>
                            {pu === null ? <span className="text-orange-700">non chiffré</span> : <>{pu === best && pus.filter((p) => p !== null).length > 1 && '✓ '}{formatEuro(pu)}<div className="text-[11px] font-normal text-slate-500">{tot !== null ? formatEuro(tot) : ''}</div></>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right">Total HT</td>
                  {priced.map((r) => <td key={r.id} className="px-3 py-2 text-right tabular">{formatEuro(offerTotal(r.offer!, study.metre) ?? 0)}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <Card className="no-print">
        <CardHeader title="Fournisseurs consultés" subtitle={`${c.requests.length} demande(s) de prix`}
          actions={!locked && <Button size="sm" variant="secondary" icon={<UserPlus size={14} />} onClick={() => setAdding(true)}>Ajouter un fournisseur</Button>} />
        <ul className="divide-y divide-slate-100">
          {c.requests.map((r) => {
            const s = sup(r.supplierId);
            const late = isLate(r, c);
            return (
              <li key={r.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-48 flex-1">
                    <Link to={`/fournisseurs/${r.supplierId}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">{s?.name ?? 'Fournisseur supprimé'}</Link>
                    <div className="text-xs text-slate-500">{[s?.contactName, s?.email, s?.phone].filter(Boolean).join(' · ') || 'Coordonnées non renseignées'}</div>
                  </div>
                  <RequestStatusBadge status={r.status} late={late} />
                  <span className="text-xs text-slate-500">{r.sentAt ? `Envoyée le ${formatDate(r.sentAt)}` : 'Non envoyée'}</span>
                  {!locked && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.status === 'a-envoyer' && (
                        <>
                          {s?.email && <a href={requestMail(s.email, s.contactName)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Mail size={14} /> Préparer le courriel</a>}
                          <Button size="sm" onClick={() => actions.send(c, r)}>Marquer envoyée</Button>
                        </>
                      )}
                      {(r.status === 'envoyee' || r.status === 'relancee') && <Button size="sm" variant={late ? 'danger' : 'secondary'} onClick={() => actions.openRemind(c, r)}>Relancer</Button>}
                      {r.status !== 'declinee' && <Button size="sm" variant="secondary" onClick={() => actions.openOffer(c, r)}>{r.offer ? 'Modifier l’offre' : 'Saisir l’offre'}</Button>}
                      {r.status !== 'recue' && r.status !== 'declinee' && <Button size="sm" variant="ghost" onClick={() => actions.openDecline(c, r)}>Décliné</Button>}
                      <Button size="sm" variant="ghost" className="text-red-700" onClick={() => actions.openRemove(c, r)} aria-label="Retirer"><Trash2 size={14} /></Button>
                    </div>
                  )}
                </div>
                {r.declineReason && <p className="mt-1 text-xs text-slate-500">Motif : {r.declineReason}</p>}
                {r.reminders.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                    {r.reminders.map((m, i) => <li key={i}>↻ Relance n°{i + 1} le {formatDateTime(m.at)} par {m.by}{m.note && ` — ${m.note}`}</li>)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {history.length > 0 && (
        <Card className="no-print">
          <CardHeader title="Historique de la consultation" />
          <ol className="divide-y divide-slate-100 text-sm">
            {history.map((h) => (
              <li key={h.id} className="px-5 py-2">
                <span className="text-xs text-slate-500">{formatDateTime(h.date)} · {h.user}</span> — <span className="font-medium">{h.field}</span> :{' '}
                <span className="text-slate-500">{h.oldValue}</span> → <strong>{h.newValue}</strong>{h.reason && h.reason !== '—' && <span className="text-slate-500"> ({h.reason})</span>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <HelpBox>
        <p>Les offres sont classées de la <strong>moins-disante</strong> à la plus chère. Vérifiez aussi le <strong>délai</strong>, la <strong>validité</strong> (une offre expirée doit être prolongée) et les <strong>exclusions</strong> avant de retenir une offre : retenir une offre qui n’est pas la moins chère demande un motif.</p>
        <p>L’offre retenue servira de prix fournisseur dans le chiffrage (V1.6), avec la trace de sa source (fournisseur, référence, document).</p>
      </HelpBox>

      {actions.modals}
      {editing && <EditModal c={c} onClose={() => setEditing(false)} onSave={(patch) => { store.updateConsultation(study.id, c.id, patch, 'Modification'); setEditing(false); toast('Consultation modifiée'); }} />}
      {adding && <AddSupplierModal c={c} onClose={() => setAdding(false)} onAdd={(ids) => { store.addRequests(study.id, c.id, ids); setAdding(false); toast(`${ids.length} fournisseur(s) ajouté(s)`); }} />}
      <ConfirmDialog open={deleting} danger askReason title="Supprimer cette consultation ?" confirmLabel="Supprimer"
        message={<>La consultation <strong>{c.label}</strong>, ses demandes et ses offres seront supprimées.</>} impact="Cette action est irréversible."
        onCancel={() => setDeleting(false)} onConfirm={(reason) => { store.deleteConsultation(study.id, c.id, reason); toast('Consultation supprimée'); navigate(`/etudes/${study.id}/consultations`); }} />

      <PrintDocument title={`Consultation — ${c.label}`} reference={study.reference} demo={study.isDemo}>
        <div className="mb-3 text-[13pt] font-bold">{study.name}</div>
        <p className="mb-3">{c.kind === 'fournisseur' ? 'Fourniture' : 'Sous-traitance'} · réponse attendue le {formatDate(c.dueDate)} · état : {state.label}</p>
        <PrintSection title="Comparaison des offres">
          <PrintTable head={['Rang', 'Fournisseur', 'Montant HT', 'Écart', 'Délai', 'Validité', 'Exclusions']} align={['center', 'left', 'right', 'right', 'left', 'left', 'left']}
            rows={cmp.map((o) => {
              const r = c.requests.find((x) => x.id === o.requestId)!;
              return [o.rank ?? '—', <>{sup(r.supplierId)?.name}{c.retainedRequestId === r.id && <strong> (RETENUE)</strong>}</>, o.total !== null ? formatEuro(o.total) : '—',
                o.gapToBest === 0 ? 'moins-disant' : o.gapToBest !== null ? `+${Math.round(o.gapToBest * 100)} %` : '—', r.offer!.delay || '—',
                r.offer!.validUntil ? `${o.expired ? 'EXPIRÉE ' : ''}${formatDate(r.offer!.validUntil)}` : '—', r.offer!.exclusions || '—'];
            })} />
        </PrintSection>
        <PrintSection title="Suivi des demandes">
          <PrintTable head={['Fournisseur', 'Statut', 'Envoyée le', 'Relances']}
            rows={c.requests.map((r) => [sup(r.supplierId)?.name ?? '—', isLate(r, c) ? 'EN RETARD' : STATUS_LABELS[r.status], r.sentAt ? formatDate(r.sentAt) : '—', r.reminders.length])} />
        </PrintSection>
      </PrintDocument>
    </div>
  );
}

function EditModal({ c, onClose, onSave }: { c: Consultation; onClose: () => void; onSave: (p: Pick<Consultation, 'label' | 'dueDate' | 'notes'>) => void }) {
  const [label, setLabel] = useState(c.label);
  const [dueDate, setDueDate] = useState(c.dueDate);
  const [notes, setNotes] = useState(c.notes);
  return (
    <Modal open onClose={onClose} title="Modifier la consultation"
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button disabled={!label.trim() || !dueDate} onClick={() => onSave({ label: label.trim(), dueDate, notes })}>Enregistrer</Button></>}>
      <div className="space-y-3">
        <Field label="Objet" required><TextInput value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Field label="Réponse attendue le" required><TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function AddSupplierModal({ c, onClose, onAdd }: { c: Consultation; onClose: () => void; onAdd: (ids: string[]) => void }) {
  const { suppliers } = useStore();
  const [ids, setIds] = useState<string[]>([]);
  const available = suppliers.filter((s) => !c.requests.some((r) => r.supplierId === s.id));
  return (
    <Modal open onClose={onClose} title="Ajouter des fournisseurs"
      footer={<><Link to="/fournisseurs" className="mr-auto self-center text-sm text-brand-700 underline">Gérer l’annuaire</Link><Button variant="secondary" onClick={onClose}>Annuler</Button><Button disabled={!ids.length} icon={<Plus size={14} />} onClick={() => onAdd(ids)}>Ajouter</Button></>}>
      <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
        {available.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-center gap-2 px-3 py-2">
              <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={ids.includes(s.id)} onChange={(e) => setIds(e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id))} />
              <span className="flex-1 font-medium">{s.name}</span>
              {s.familyIds.some((f) => c.familyIds.includes(f)) && <span className="rounded bg-emerald-100 px-1.5 text-[11px] font-semibold text-emerald-800">habituel</span>}
            </label>
          </li>
        ))}
        {available.length === 0 && <li className="px-3 py-3 text-slate-500">Tous les fournisseurs de l’annuaire sont déjà consultés.</li>}
      </ul>
    </Modal>
  );
}
