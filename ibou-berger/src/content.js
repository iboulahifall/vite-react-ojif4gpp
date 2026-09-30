// ─────────────────────────────────────────────────────────────────────────────
//  IBOU BERGER — contenu éditable du site
//  Tout le texte, les appels à l'action, la timeline du vol et les médias sont ici.
//  Carte et textes : proposition à valider par le restaurant. Téléphone et email
//  restent vides (null) tant que les vrais ne sont pas fournis ; rien n'est inventé sur ces points.
//  (Ancienne consigne :) les éléments entre [crochets] sont des emplacements à remplacer par les vraies
//  informations du restaurant : rien n'a été inventé (adresse, horaires, prix, avis).
// ─────────────────────────────────────────────────────────────────────────────

const HF = 'https://d8j0ntlcm91z4.cloudfront.net/user_3K2SiYrVa3xPykNguAMiJwaAJGL/';
const hf = (id) => `${HF}${id}_min.webp`;

export const site = {
  name: 'Ibou Berger',
  tagline: 'Cuisine de braise — Rufisque',
  demo: false, // true = affiche la mention « maquette » dans le pied de page
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
  manifest: 'flight/manifest.json',
  // Entrée filmée : 3 clips Higgsfield Seedance 1.5 enchaînés (façade → salle → comptoir → cuisine),
  // assemblés en un master de 19,9 s encodé pour le défilement (image clé toutes les 4 images).
  // Les temps forts qui ont une clé `video` l'utilisent ; sinon (ou si la vidéo ne charge pas),
  // la séquence d'images 3D prend le relais.
  introVideo: {
    url: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3K2SiYrVa3xPykNguAMiJwaAJGL/c8083fb9-ea01-4fd2-9b2d-44277fd571a4.mp4',
    duration: 19.9,
    fadeOutBeat: 'kitchen', // fondu vers le rendu 3D au début de ce temps fort
    fadePortion: 0.3,
  },
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
    title: 'Le feu, la mer, Rufisque.',
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
    body: 'Pierre sombre, bois d’iroko, lumière basse et grandes baies ouvertes sur l’océan. Une salle pour les dîners à deux comme pour les grandes tablées.',
    ctas: [{ label: 'Voir la carte', href: '#carte' }],
    still: 'salle',
    frame: 200, // image de la séquence utilisée en repli
    align: 'left',
  },
  {
    id: 'bar',
    kicker: '03 — Le comptoir',
    title: 'Bissap, gingembre, grands crus.',
    body: 'Un comptoir en laiton pour l’apéritif ou le dernier verre : bissap, gingembre et bouye pressés maison, cocktails sans alcool et vins au verre.',
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
    body: 'Des vins choisis pour accompagner la braise, et des jus pressés chaque jour.',
    ctas: [],
    still: 'cave',
    frame: 500, // image de la séquence utilisée en repli
    align: 'right',
  },
  {
    id: 'revelation',
    kicker: '06 — Ibou Berger',
    title: 'On vous garde une table.',
    body: 'HLM Rufisque · Du lundi au samedi, de 9 h à 23 h',
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
// `video` : [début, fin] en secondes dans la vidéo d'entrée (optionnel).
export const beats = [
  { id: 'hero-hold', vh: 70, from: 0, to: 0, video: [0, 0], chapter: 'arrivee' },
  { id: 'arrival', vh: 120, from: 0, to: 7, video: [0, 7.4], chapter: 'arrivee' },
  { id: 'dining', vh: 170, from: 7, to: 12.4, video: [7.4, 13.5], chapter: 'salle' },
  { id: 'bar', vh: 90, from: 12.4, to: 15, video: [13.5, 16.4], chapter: 'bar' },
  { id: 'kitchen-door', vh: 55, from: 15, to: 16.5, video: [16.4, 19.9], chapter: null },
  { id: 'kitchen', vh: 190, from: 16.5, to: 23, chapter: 'braise' },
  { id: 'cellar', vh: 140, from: 23, to: 30, chapter: 'cave' },
  { id: 'exit', vh: 60, from: 30, to: 33, chapter: null },
  { id: 'yaw-180', vh: 75, from: 33, to: 35, chapter: null },
  { id: 'reveal', vh: 150, from: 35, to: 45, chapter: 'revelation' },
  { id: 'final-hold', vh: 90, from: 45, to: 45, chapter: 'revelation' },
];

// ── Carte (exemple de structure — plats et prix à remplacer) ────────────────
export const menu = {
  note: 'Carte proposée, à valider par le chef : plats et prix peuvent être modifiés dans src/content.js.',
  sections: [
    {
      title: 'Pour commencer',
      items: [
        { name: 'Pastels de thiof', desc: 'Chaussons croustillants au poisson, sauce tomate pimentée', price: '6 500 FCFA' },
        { name: 'Salade de mangue verte', desc: 'Crevettes grillées à la braise, arachide torréfiée, citron vert', price: '8 000 FCFA' },
        { name: 'Brochettes au yassa', desc: 'Cœur de bœuf mariné, oignons confits au citron', price: '7 000 FCFA' },
      ],
    },
    {
      title: 'Au feu de bois',
      items: [
        { name: 'Carré d’agneau braisé', desc: 'Jus réduit au bissap, fonio aux herbes', price: '22 000 FCFA' },
        { name: 'Thiof entier grillé', desc: 'Beurre de citron vert et piment doux, légumes de la braise', price: '18 000 FCFA' },
        { name: 'Poulet fermier yassa', desc: 'Grillé au charbon de bois, oignons et moutarde, riz parfumé', price: '14 000 FCFA' },
        { name: 'Dibi d’agneau à partager', desc: 'Pour deux, oignons, moutarde et piment, pain du four', price: '25 000 FCFA' },
      ],
    },
    {
      title: 'Pour finir',
      items: [
        { name: 'Thiakry à la vanille', desc: 'Mil au lait caillé, mangue rôtie', price: '5 000 FCFA' },
        { name: 'Ananas à la braise', desc: 'Caramel au gingembre, glace au bouye', price: '5 500 FCFA' },
        { name: 'Jus pressés maison', desc: 'Bissap, gingembre ou bouye', price: '2 500 FCFA' },
      ],
    },
  ],
};

export const experience = [
  { title: 'Le dîner', text: 'Service du soir en salle, face à l’océan.', still: 'salle', frame: 190 },
  { title: 'Le comptoir', text: 'Apéritif, cocktails sans alcool et vins au verre.', still: 'bar', frame: 262 },
  { title: 'Le jardin', text: 'Des tables sous le baobab et les lanternes pour les soirées douces.', still: 'jardin', frame: 640 },
];

export const info = {
  address: 'HLM Rufisque, Sénégal',
  hours: [
    ['Lundi – samedi', '9 h – 23 h'],
    ['Dimanche', 'Fermé'],
  ],
  phone: null, // ex. '+221 …' — la ligne s’affiche dès qu’un numéro est renseigné
  email: null,
  mapsUrl: null, // lien Google Maps / Apple Plans à ajouter
};

// ── Réservation ─────────────────────────────────────────────────────────────
// endpoint = null → mode démo explicite : rien n'est envoyé.
// Renseigner une URL (Formspree, backend, etc.) acceptant un POST JSON pour activer l'envoi.
export const reservation = {
  endpoint: null,
  demoNotice: 'Mode démonstration : ce formulaire n’envoie encore aucune réservation.',
};
