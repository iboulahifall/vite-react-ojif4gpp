// ─────────────────────────────────────────────────────────────────────────────
//  IBOU BERGER — contenu éditable du site
//  Tout le texte, les appels à l'action, la timeline du vol et les médias sont ici.
//  Les éléments entre [crochets] sont des emplacements à remplacer par les vraies
//  informations du restaurant : rien n'a été inventé (adresse, horaires, prix, avis).
// ─────────────────────────────────────────────────────────────────────────────

const HF = 'https://d8j0ntlcm91z4.cloudfront.net/user_3K2SiYrVa3xPykNguAMiJwaAJGL/';
const hf = (id) => `${HF}${id}_min.webp`;

export const site = {
  name: 'Ibou Berger',
  tagline: 'Cuisine de braise — Dakar',
  demo: true, // affiche le bandeau « maquette » tant que les infos réelles ne sont pas saisies
  nav: [
    { label: 'La visite', href: '#vol' },
    { label: 'La carte', href: '#carte' },
    { label: "L'expérience", href: '#experience' },
    { label: 'Infos', href: '#infos' },
  ],
  primaryCta: { label: 'Réserver', href: '#reserver' },
};

// ── Médias ───────────────────────────────────────────────────────────────────
// flight.manifest : séquence d'images pilotée par le défilement.
// Aujourd'hui : prévisualisation grey-box. Remplacer par la séquence du master
// Higgsfield (même format de manifeste) sans toucher au code.
export const media = {
  manifest: '/flight/manifest.json',
  // Images fixes générées avec Higgsfield (Z Image). Servent de plans de
  // repli (mouvement réduit / appareils limités) et d'illustrations.
  stills: {
    arrivee: hf('hf_20260930_080346_6c863d73-a27b-44f0-a53d-a7ebe2592635'),
    salle: hf('hf_20260930_080521_fa40b84e-6fd5-4f50-a8f5-2a79475ad853'),
    bar: hf('hf_20260930_080346_117c07a2-bc4a-4763-b13f-1fe88137e955'),
    braise: hf('hf_20260930_081814_110bc9d4-d043-4500-9f75-faf0de42f83e'),
    cave: hf('hf_20260930_080346_403b1cf7-3ce9-4cd2-8351-285cdfe3dd58'),
    jardin: hf('hf_20260930_080346_84801bc7-a7cc-47ae-894c-a9eaa4fa0a3b'),
    revelation: hf('hf_20260930_080346_8edbbb09-822c-47f1-814b-a54889ba6120'),
  },
};

// ── Chapitres du vol ────────────────────────────────────────────────────────
// Texte superposé à la scène. `beats` : les temps forts pendant lesquels le
// chapitre est visible (il apparaît en fondu, tient, puis disparaît).
export const chapters = [
  {
    id: 'arrivee',
    kicker: '01 — Arrivée',
    title: 'Le feu, la mer, Dakar.',
    body: 'Une table de braise au bord de l’Atlantique. Produits du terroir sénégalais, cuisson au bois, service du soir.',
    ctas: [
      { label: 'Réserver une table', href: '#reserver', primary: true },
      { label: 'Voir la carte', href: '#carte' },
    ],
    still: 'arrivee',
    frame: 0, // image de la séquence utilisée en repli
    align: 'left',
  },
  {
    id: 'salle',
    kicker: '02 — La salle',
    title: 'Une salle pensée comme une soirée.',
    body: 'Pierre sombre, bois d’iroko, lumière basse et baies ouvertes sur l’océan. [Nombre de couverts à confirmer].',
    ctas: [{ label: 'Voir la carte', href: '#carte' }],
    still: 'salle',
    frame: 200, // image de la séquence utilisée en repli
    align: 'left',
  },
  {
    id: 'bar',
    kicker: '03 — Le comptoir',
    title: 'Bissap, gingembre, grands crus.',
    body: 'Un comptoir en laiton pour l’apéritif ou le dernier verre. Carte des boissons [à fournir].',
    ctas: [],
    still: 'bar',
    frame: 270, // image de la séquence utilisée en repli
    align: 'right',
  },
  {
    id: 'braise',
    kicker: '04 — La braise',
    title: 'Tout commence au feu.',
    body: 'Bois, charbon, patience. L’agneau, le poisson du jour et les légumes passent par la grille avant d’arriver à table.',
    ctas: [{ label: 'Découvrir la carte', href: '#carte' }],
    still: 'braise',
    frame: 390, // image de la séquence utilisée en repli
    align: 'left',
  },
  {
    id: 'cave',
    kicker: '05 — La cave',
    title: 'Une cave à traverser.',
    body: 'Vins choisis pour la braise et jus maison. Sélection [à compléter par le sommelier].',
    ctas: [],
    still: 'cave',
    frame: 500, // image de la séquence utilisée en repli
    align: 'right',
  },
  {
    id: 'revelation',
    kicker: '06 — Ibou Berger',
    title: 'On vous garde une table.',
    body: '[Adresse à confirmer], Dakar · [Horaires à confirmer] · [Téléphone à confirmer]',
    ctas: [
      { label: 'Réserver', href: '#reserver', primary: true },
      { label: 'Itinéraire', href: '#infos' },
    ],
    still: 'revelation',
    frame: 900, // image de la séquence utilisée en repli
    align: 'center',
  },
];

// ── Timeline du vol (défilement par morceaux) ───────────────────────────────
// Chaque temps fort associe sa propre distance de défilement (vh = hauteurs de
// fenêtre) à un intervalle du clip (secondes). from === to : image tenue.
// `chapter` : le texte affiché pendant ce temps fort (null = pas de texte).
export const beats = [
  { id: 'hero-hold', vh: 70, from: 0, to: 0, chapter: 'arrivee' },
  { id: 'arrival', vh: 120, from: 0, to: 7, chapter: 'arrivee' },
  { id: 'dining', vh: 170, from: 7, to: 12.4, chapter: 'salle' },
  { id: 'bar', vh: 90, from: 12.4, to: 15, chapter: 'bar' },
  { id: 'kitchen-door', vh: 55, from: 15, to: 16.5, chapter: null },
  { id: 'kitchen', vh: 190, from: 16.5, to: 23, chapter: 'braise' },
  { id: 'cellar', vh: 140, from: 23, to: 30, chapter: 'cave' },
  { id: 'exit', vh: 60, from: 30, to: 33, chapter: null },
  { id: 'yaw-180', vh: 75, from: 33, to: 35, chapter: null },
  { id: 'reveal', vh: 150, from: 35, to: 45, chapter: 'revelation' },
  { id: 'final-hold', vh: 90, from: 45, to: 45, chapter: 'revelation' },
];

// ── Carte (exemple de structure — plats et prix à remplacer) ────────────────
export const menu = {
  note: 'Exemple de structure de carte. Les plats et les prix réels sont à fournir.',
  sections: [
    {
      title: 'Pour commencer',
      items: [
        { name: '[Entrée signature]', desc: 'Légumes grillés à la braise, condiment [à préciser]', price: '[—] FCFA' },
        { name: '[Entrée de la mer]', desc: 'Poisson du jour, agrumes, piment doux', price: '[—] FCFA' },
      ],
    },
    {
      title: 'Au feu de bois',
      items: [
        { name: '[Carré d’agneau]', desc: 'Cuit lentement sur la grille, jus au [à préciser]', price: '[—] FCFA' },
        { name: '[Poisson entier]', desc: 'Braisé, beurre de citron vert', price: '[—] FCFA' },
      ],
    },
    {
      title: 'Pour finir',
      items: [
        { name: '[Dessert]', desc: 'Fruits de saison rôtis, [à préciser]', price: '[—] FCFA' },
        { name: '[Boisson maison]', desc: 'Bissap ou gingembre pressé', price: '[—] FCFA' },
      ],
    },
  ],
};

export const experience = [
  { title: 'Le dîner', text: 'Service du soir en salle, face à l’océan.', still: 'salle', frame: 190 },
  { title: 'Le comptoir', text: 'Apéritif, cocktails sans alcool et vins au verre.', still: 'bar', frame: 262 },
  { title: 'Le jardin', text: 'Tables sous le baobab pour les soirées douces. [Disponibilité à confirmer]', still: 'jardin', frame: 640 },
];

export const info = {
  address: '[Adresse à confirmer], Dakar, Sénégal',
  hours: [
    ['[Jours]', '[Horaires à confirmer]'],
  ],
  phone: '[Téléphone à confirmer]',
  email: '[Email à confirmer]',
  mapsUrl: null, // lien Google Maps / Apple Plans à ajouter
};

// ── Réservation ─────────────────────────────────────────────────────────────
// endpoint = null → mode démo explicite : rien n'est envoyé.
// Renseigner une URL (Formspree, backend, etc.) acceptant un POST JSON pour activer l'envoi.
export const reservation = {
  endpoint: null,
  demoNotice: 'Mode démonstration : ce formulaire n’envoie encore aucune réservation.',
};
