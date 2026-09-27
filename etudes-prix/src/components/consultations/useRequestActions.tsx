import { useState, type ReactNode } from 'react';
import type { Study } from '../../domain/types';
import type { Consultation, SupplierRequest } from '../../domain/consultations';
import { compareOffers, offerTotal } from '../../domain/consultations';
import { formatEuro } from '../../domain/format';
import { useStore } from '../../state/store';
import { useToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { OfferModal } from './OfferModal';
import { RemindModal } from './RemindModal';

type Open =
  | { kind: 'offer'; c: Consultation; r: SupplierRequest }
  | { kind: 'remind'; c: Consultation; r: SupplierRequest }
  | { kind: 'decline'; c: Consultation; r: SupplierRequest }
  | { kind: 'retain'; c: Consultation; r: SupplierRequest | null }
  | { kind: 'remove'; c: Consultation; r: SupplierRequest };

/** Actions sur les demandes de prix, communes aux cartes et à la fiche consultation. */
export function useRequestActions(study: Study): {
  openOffer: (c: Consultation, r: SupplierRequest) => void;
  openRemind: (c: Consultation, r: SupplierRequest) => void;
  openDecline: (c: Consultation, r: SupplierRequest) => void;
  openRetain: (c: Consultation, r: SupplierRequest | null) => void;
  openRemove: (c: Consultation, r: SupplierRequest) => void;
  send: (c: Consultation, r: SupplierRequest) => void;
  modals: ReactNode;
} {
  const store = useStore();
  const toast = useToast();
  const [open, setOpen] = useState<Open | null>(null);
  const supplier = (id: string) => store.suppliers.find((s) => s.id === id);
  const close = () => setOpen(null);

  let modals: ReactNode = null;
  if (open?.kind === 'offer') {
    modals = <OfferModal consultation={open.c} request={open.r} supplier={supplier(open.r.supplierId)} metre={study.metre} onClose={close}
      onSave={async (offer, files) => {
        store.saveOffer(study.id, open.c.id, open.r.id, offer, open.r.offer ? 'Offre modifiée' : 'Offre reçue');
        close();
        if (files.length) {
          const res = await store.addOfferFiles(study.id, open.c.id, open.r.id, files);
          if (res.rejected.length) toast(`${res.rejected.length} document(s) non joint(s)`);
        }
        toast(`Offre enregistrée : ${formatEuro(offerTotal(offer, study.metre) ?? 0)} HT`);
      }} />;
  } else if (open?.kind === 'remind') {
    modals = <RemindModal consultation={open.c} request={open.r} supplier={supplier(open.r.supplierId)} studyName={study.name} userName={store.settings.userName}
      onClose={close} onRemind={(note) => { store.remind(study.id, open.c.id, open.r.id, note); close(); toast('Relance enregistrée'); }} />;
  } else if (open?.kind === 'decline') {
    modals = <ConfirmDialog open askReason reasonRequired title="Le fournisseur ne répond pas ?" confirmLabel="Marquer décliné"
      message={<><strong>{supplier(open.r.supplierId)?.name}</strong> sera marqué comme ayant décliné la consultation « {open.c.label} ».</>}
      onCancel={close} onConfirm={(reason) => { store.declineRequest(study.id, open.c.id, open.r.id, reason); close(); toast('Fournisseur marqué décliné'); }} />;
  } else if (open?.kind === 'retain') {
    const cmp = compareOffers(open.c, study.metre);
    const target = open.r ? cmp.find((x) => x.requestId === open.r!.id) : null;
    modals = <ConfirmDialog open askReason reasonRequired={!!(target?.rank && target.rank > 1)} title={open.r ? 'Retenir cette offre ?' : 'Annuler l’offre retenue ?'} confirmLabel={open.r ? 'Retenir' : 'Confirmer'}
      message={open.r
        ? <>L’offre de <strong>{supplier(open.r.supplierId)?.name}</strong> ({target?.total != null ? formatEuro(target.total) : '—'} HT) sera retenue pour « {open.c.label} ».</>
        : <>Plus aucune offre ne sera retenue pour « {open.c.label} ».</>}
      impact={target && target.rank && target.rank > 1 ? `Ce n’est pas l’offre la moins-disante (+${Math.round((target.gapToBest ?? 0) * 100)} %) : précisez le motif.` : target?.expired ? 'Attention : la validité de cette offre est dépassée.' : 'Le prix retenu servira de base au chiffrage (V1.6).'}
      onCancel={close} onConfirm={(reason) => { store.retainOffer(study.id, open.c.id, open.r?.id ?? null, reason); close(); toast(open.r ? 'Offre retenue' : 'Offre retenue annulée'); }} />;
  } else if (open?.kind === 'remove') {
    modals = <ConfirmDialog open danger askReason title="Retirer ce fournisseur de la consultation ?" confirmLabel="Retirer"
      message={<><strong>{supplier(open.r.supplierId)?.name}</strong> et son éventuelle offre seront retirés de « {open.c.label} ».</>}
      onCancel={close} onConfirm={(reason) => { store.removeRequest(study.id, open.c.id, open.r.id, reason); close(); toast('Fournisseur retiré'); }} />;
  }

  return {
    openOffer: (c, r) => setOpen({ kind: 'offer', c, r }),
    openRemind: (c, r) => setOpen({ kind: 'remind', c, r }),
    openDecline: (c, r) => setOpen({ kind: 'decline', c, r }),
    openRetain: (c, r) => setOpen({ kind: 'retain', c, r }),
    openRemove: (c, r) => setOpen({ kind: 'remove', c, r }),
    send: (c, r) => { store.markSent(study.id, c.id, [r.id]); toast('Demande marquée envoyée'); },
    modals,
  };
}
