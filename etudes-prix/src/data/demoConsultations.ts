import type { Consultation, Offer, Supplier } from '../domain/consultations';
import { addDays, toISODate } from '../domain/dates';

/** Annuaire fictif (noms et coordonnées inventés). */
export function buildDemoSuppliers(): Supplier[] {
  const s = (id: string, name: string, kind: Supplier['kind'], contactName: string, familyIds: string[], notes = ''): Supplier => ({
    id: `demo-sup-${id}`, name, kind, contactName, email: `contact@${id}.exemple-demo.fr`, phone: '04 00 00 00 00', familyIds, notes, isDemo: true,
  });
  return [
    s('electro-negoce', 'Électro-Négoce Démo', 'fournisseur', 'Mme Martin (fictif)', ['cfo-tgbt', 'cfo-tableaux', 'cfo-distribution', 'cfo-eclairage', 'cfo-prises'], 'Distributeur généraliste — remise habituelle 30 à 35 %.'),
    s('distrib-elec', 'Distrib’Élec Démo', 'fournisseur', 'M. Bernard (fictif)', ['cfo-tgbt', 'cfo-tableaux', 'cfo-eclairage', 'cfo-force']),
    s('lumiere-co', 'Lumière & Co Démo', 'fournisseur', 'Mme Petit (fictif)', ['cfo-eclairage'], 'Spécialiste éclairage — études photométriques offertes.'),
    s('securite-incendie', 'Sécurité Incendie Démo', 'sous-traitant', 'M. Robert (fictif)', ['cfa-ssi'], 'Installateur SSI certifié (fictif).'),
    s('protect-feu', 'Protect Feu Démo', 'sous-traitant', 'M. Richard (fictif)', ['cfa-ssi']),
    s('reseaux-vdi', 'Réseaux VDI Démo', 'sous-traitant', 'Mme Durand (fictif)', ['cfa-vdi', 'cfa-video', 'cfa-acces']),
    s('cablage-pro', 'Câblage Pro Démo', 'sous-traitant', 'M. Moreau (fictif)', ['cfa-vdi']),
    s('gtb-systemes', 'GTB Systèmes Démo', 'sous-traitant', 'M. Laurent (fictif)', ['cfa-gtb']),
  ];
}

/** Consultations du projet de démonstration, datées par rapport à aujourd'hui. */
export function buildDemoConsultations(studyId: string, owner: string, today = new Date()): Consultation[] {
  const d = (n: number) => toISODate(addDays(today, n));
  const m = (i: number) => `${studyId}-m${i}`;
  const sup = (id: string) => `demo-sup-${id}`;
  const offer = (o: Partial<Offer>): Offer => ({
    receivedAt: d(-2), reference: '', amount: null, lines: [], delay: '4 semaines', validUntil: d(60), exclusions: '', comment: '', files: [], ...o,
  });
  return [
    {
      id: `${studyId}-c1`, label: 'TGBT', kind: 'fournisseur', familyIds: ['cfo-tgbt'], metreLineIds: [m(0)], createdAt: d(-9), dueDate: d(-1), notes: 'TGBT forme 2 — 400 A, comptages, parafoudre (CCTP §2).',
      requests: [
        { id: `${studyId}-r1`, supplierId: sup('electro-negoce'), status: 'recue', sentAt: d(-9), reminders: [],
          offer: offer({ reference: 'DEV-2026-0412 (fictif)', lines: [{ metreLineId: m(0), unitPrice: 23800 }], delay: '6 semaines', exclusions: 'Raccordement des câbles d’arrivée non compris.', comment: 'Prix catalogue 34 000 € — remise 30 %.' }) },
        { id: `${studyId}-r2`, supplierId: sup('distrib-elec'), status: 'envoyee', sentAt: d(-9), reminders: [] },
      ],
    },
    {
      id: `${studyId}-c2`, label: 'Éclairage', kind: 'fournisseur', familyIds: ['cfo-eclairage'], metreLineIds: [m(4), m(5), m(6)], createdAt: d(-8), dueDate: d(1), notes: '',
      requests: [
        { id: `${studyId}-r3`, supplierId: sup('lumiere-co'), status: 'recue', sentAt: d(-8), reminders: [],
          offer: offer({ reference: 'OF-8841 (fictif)', lines: [{ metreLineId: m(4), unitPrice: 86 }, { metreLineId: m(5), unitPrice: 48 }, { metreLineId: m(6), unitPrice: 62 }], delay: '5 semaines', comment: 'Luminaires UGR<19 conformes CCTP.' }) },
        { id: `${studyId}-r4`, supplierId: sup('electro-negoce'), status: 'recue', sentAt: d(-8), reminders: [],
          offer: offer({ reference: 'DEV-2026-0415 (fictif)', lines: [{ metreLineId: m(4), unitPrice: 79 }, { metreLineId: m(5), unitPrice: 51 }, { metreLineId: m(6), unitPrice: 58 }], delay: '3 semaines', validUntil: d(-3),
            exclusions: 'Détecteurs DALI : modèle équivalent, non conforme à la marque citée.', comment: 'Offre expirée — demander une prolongation.' }) },
        { id: `${studyId}-r5`, supplierId: sup('distrib-elec'), status: 'relancee', sentAt: d(-8), reminders: [{ at: new Date(addDays(today, -2).setHours(10, 30)).toISOString(), by: owner, note: 'Relance téléphonique — réponse promise sous 48 h.' }] },
      ],
    },
    {
      id: `${studyId}-c3`, label: 'SSI (sous-traitance)', kind: 'sous-traitant', familyIds: ['cfa-ssi'], metreLineIds: [m(12), m(13), m(14), m(15)], createdAt: d(-10), dueDate: d(-3), notes: 'Pose, raccordement et mise en service compris.',
      retainedRequestId: `${studyId}-r6`,
      requests: [
        { id: `${studyId}-r6`, supplierId: sup('securite-incendie'), status: 'recue', sentAt: d(-10), reminders: [],
          offer: offer({ receivedAt: d(-4), reference: 'ST-SSI-77 (fictif)', amount: 58400, delay: '8 semaines', exclusions: 'Coordinateur SSI non compris.', comment: 'Forfait global.' }) },
        { id: `${studyId}-r7`, supplierId: sup('protect-feu'), status: 'declinee', sentAt: d(-10), reminders: [], declineReason: 'Plan de charge complet.' },
      ],
    },
    {
      id: `${studyId}-c4`, label: 'Précâblage VDI', kind: 'sous-traitant', familyIds: ['cfa-vdi'], metreLineIds: [m(16), m(17), m(18)], createdAt: d(-3), dueDate: d(3), notes: '',
      requests: [
        { id: `${studyId}-r8`, supplierId: sup('reseaux-vdi'), status: 'envoyee', sentAt: d(-3), reminders: [] },
        { id: `${studyId}-r9`, supplierId: sup('cablage-pro'), status: 'a-envoyer', reminders: [] },
      ],
    },
  ];
}
