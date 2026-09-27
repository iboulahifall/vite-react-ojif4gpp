import type { Chiffrage, PriceLine } from '../domain/chiffrage';
import { DEFAULT_PARAMS, netFromCatalog } from '../domain/chiffrage';
import type { MetreLine } from '../domain/metre';
import type { Consultation } from '../domain/consultations';
import { baseLineFor, importRetainedOffers } from '../domain/priceBase';

/** Chiffrage fictif du projet de démonstration : base de prix, catalogue, offre retenue, un prix manquant. */
export function buildDemoChiffrage(metre: MetreLine[], consultations: Consultation[]): Chiffrage {
  let lines: PriceLine[] = metre.map(baseLineFor).filter((l): l is PriceLine => l !== null);
  const byRef = (ref: string) => metre.find((m) => m.ref === ref)!;
  const replace = (ref: string, patch: Partial<PriceLine>) => {
    const id = byRef(ref).id;
    lines = lines.map((l) => (l.metreLineId === id ? { ...l, ...patch } : l));
  };
  // TGBT : tarif catalogue du distributeur, remise négociée (offre reçue, non encore retenue).
  replace('13.1.1', {
    materialUnit: netFromCatalog(34000, 30),
    source: { kind: 'catalogue', status: 'a-confirmer', supplierId: 'demo-sup-electro-negoce', reference: 'DEV-2026-0412 (fictif)', catalogPrice: 34000, discountPct: 30,
      note: 'Offre reçue ; comparaison en cours avec un second fournisseur.' },
  });
  // Luminaires : prix catalogue remisé.
  replace('13.1.5', {
    materialUnit: netFromCatalog(113, 30),
    source: { kind: 'catalogue', status: 'a-confirmer', supplierId: 'demo-sup-electro-negoce', reference: 'Tarif 2026 (fictif)', catalogPrice: 113, discountPct: 30 },
  });
  // Groupe électrogène : non décrit au CCTP, question posée — pas encore de prix.
  lines = lines.filter((l) => l.metreLineId !== byRef('13.1.12').id);
  // SSI : offre de sous-traitance retenue (forfait).
  const imported = importRetainedOffers(consultations, metre, lines);
  return { params: { ...DEFAULT_PARAMS }, lines: imported.lines };
}
