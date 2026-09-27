import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Download, Mail, Pencil, Phone, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import { FAMILIES } from '../domain/catalog';
import { isExpired, isLate, offerTotal, STATUS_LABELS } from '../domain/consultations';
import { formatDate, formatEuro } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge, Tag } from '../components/ui/Badges';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { RequestStatusBadge } from '../components/consultations/RequestStatusBadge';
import { SupplierFormModal } from '../components/consultations/SupplierFormModal';
import { downloadBlob } from '../lib/download';

/** Fiche fournisseur : coordonnées et toutes ses consultations / offres. */
export function SupplierPage() {
  const { sid = '' } = useParams();
  const { suppliers, studies, saveSupplier, deleteSupplier, getBlob } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const s = suppliers.find((x) => x.id === sid);
  const rows = useMemo(() => studies.flatMap((st) => st.consultations.flatMap((c) => c.requests.filter((r) => r.supplierId === sid).map((r) => ({ st, c, r })))), [studies, sid]);
  if (!s) {
    return <Card className="mx-auto max-w-lg p-8 text-center"><p className="text-lg font-semibold">Fournisseur introuvable</p><Link to="/fournisseurs" className="mt-4 inline-block font-medium text-brand-700 underline">Retour à l’annuaire</Link></Card>;
  }
  const received = rows.filter((x) => x.r.status === 'recue').length;

  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Fournisseurs', to: '/fournisseurs' }, { label: s.name }]} icon={<Building2 size={24} />}
        title={<span className="flex items-center gap-2">{s.name} {s.isDemo && <DemoBadge />}</span>}
        subtitle={s.kind === 'fournisseur' ? 'Fournisseur (matériel)' : 'Sous-traitant (pose / prestation)'}
        actions={<>
          <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>Modifier</Button>
          <Button variant="ghost" icon={<Trash2 size={16} />} className="text-red-700 hover:bg-red-50" onClick={() => setDeleting(true)} aria-label="Supprimer" title="Supprimer" />
        </>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Contact" />
          <dl className="space-y-2 p-5 text-sm">
            <div><dt className="text-xs text-slate-500">Nom du contact</dt><dd className="font-medium">{s.contactName || '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">E-mail</dt><dd>{s.email ? <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Mail size={14} /> {s.email}</a> : '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Téléphone</dt><dd>{s.phone ? <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Phone size={14} /> {s.phone}</a> : '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Familles</dt><dd className="mt-1 flex flex-wrap gap-1">{s.familyIds.map((f) => <Tag key={f}>{FAMILIES.find((x) => x.id === f)?.label ?? f}</Tag>)}{!s.familyIds.length && '—'}</dd></div>
            {s.notes && <div><dt className="text-xs text-slate-500">Notes</dt><dd className="text-slate-700">{s.notes}</dd></div>}
            <div className="border-t border-slate-100 pt-2 text-slate-600">{rows.length} consultation(s) · {received} offre(s) reçue(s){rows.length ? ` · taux de réponse ${Math.round((received / rows.length) * 100)} %` : ''}</div>
          </dl>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Consultations et offres" subtitle="Poste consulté, date, prix, délai, validité, exclusions, documents, commentaires." />
          <ul className="divide-y divide-slate-100">
            {rows.map(({ st, c, r }) => {
              const total = r.offer ? offerTotal(r.offer, st.metre) : null;
              return (
                <li key={r.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/etudes/${st.id}/consultations/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">{c.label}</Link>
                    <span className="text-xs text-slate-500">— {st.name}</span>
                    {st.isDemo && <DemoBadge />}
                    <span className="flex-1" />
                    {c.retainedRequestId === r.id && <span className="rounded bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-800">✓ Retenue</span>}
                    <RequestStatusBadge status={r.status} late={isLate(r, c)} />
                  </div>
                  <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:grid-cols-3">
                    <span>Consulté le : {r.sentAt ? formatDate(r.sentAt) : '—'}</span>
                    <span>Prix : <strong className="text-slate-900">{total !== null ? `${formatEuro(total)} HT` : '—'}</strong></span>
                    <span>Délai : {r.offer?.delay || '—'}</span>
                    <span>Validité : {r.offer?.validUntil ? <>{isExpired(r.offer) && '⚠ expirée '}{formatDate(r.offer.validUntil)}</> : '—'}</span>
                    <span className="sm:col-span-2">Exclusions : {r.offer?.exclusions || '—'}</span>
                    {r.offer?.comment && <span className="sm:col-span-3">Commentaire : {r.offer.comment}</span>}
                    {r.status === 'declinee' && <span className="sm:col-span-3">{STATUS_LABELS.declinee}{r.declineReason && ` — ${r.declineReason}`}</span>}
                  </div>
                  {r.offer?.files.length ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {r.offer.files.map((f) => (
                        <button key={f.id} className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline cursor-pointer"
                          onClick={async () => { const b = await getBlob(f.id); if (b) downloadBlob(b, f.name); else toast('Document introuvable'); }}>
                          <Download size={12} /> {f.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
            {rows.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">Ce fournisseur n’a encore été consulté sur aucune étude.</li>}
          </ul>
        </Card>
      </div>
      {editing && <SupplierFormModal supplier={s} onClose={() => setEditing(false)} onSave={(d) => { saveSupplier({ ...d, id: s.id, isDemo: s.isDemo }); setEditing(false); toast('Fiche mise à jour'); }} />}
      <ConfirmDialog open={deleting} danger title="Supprimer ce fournisseur de l’annuaire ?" confirmLabel="Supprimer"
        message={<>La fiche <strong>{s.name}</strong> sera supprimée.</>}
        impact={rows.length ? `Il apparaît dans ${rows.length} consultation(s) : ses offres restent enregistrées mais il sera affiché « Fournisseur supprimé ».` : undefined}
        onCancel={() => setDeleting(false)} onConfirm={() => { deleteSupplier(s.id); toast('Fournisseur supprimé'); navigate('/fournisseurs'); }} />
    </div>
  );
}
