// Trajectoire de vol (source unique pour la prévisualisation et la documentation).
// Unités : mètres. z négatif = vers le fond du bâtiment. yaw 0 = regard vers -z,
// yaw positif = tourne vers -x (gauche). pitch négatif = regarde vers le bas.
// Façade avant en z = 0, porte d'entrée en x = 0. Mur arrière en z = -19.

export const DURATION = 45;

export const KEYS = [
  // 01 — Arrivée : approche à hauteur d'œil, arc devant le brasero, alignement sur la porte.
  { t: 0.0, p: [3.0, 1.6, 16.0], yaw: -6, pitch: 0 },
  { t: 2.2, p: [-1.4, 1.5, 10.5], yaw: 18, pitch: -2 },
  { t: 4.2, p: [-1.0, 1.5, 5.2], yaw: -4, pitch: 0 },
  { t: 6.0, p: [0.0, 1.6, 1.4], yaw: 0, pitch: 0 },
  { t: 7.0, p: [0.0, 1.6, -1.2], yaw: 6, pitch: 0 },
  // 02 — Salle : balayage le long de la table, courbe en S autour du pilier, lacet vers les baies.
  { t: 8.6, p: [-2.0, 1.4, -3.0], yaw: 28, pitch: -4 },
  { t: 10.0, p: [-1.8, 1.35, -5.6], yaw: 12, pitch: -3 },
  { t: 11.2, p: [1.8, 1.5, -7.6], yaw: 55, pitch: 0 },
  { t: 12.4, p: [4.6, 1.5, -6.4], yaw: -35, pitch: 0 },
  // 03 — Bar : virage le long du comptoir en laiton, face à la porte battante.
  { t: 13.6, p: [7.6, 1.5, -5.0], yaw: -28, pitch: -3 },
  { t: 15.0, p: [8.6, 1.55, -9.3], yaw: 0, pitch: 0 },
  // Transition — la porte de cuisine s'ouvre (15,0–16,0 s), la caméra la traverse.
  { t: 16.3, p: [9.0, 1.6, -11.6], yaw: -8, pitch: 0 },
  // 04 — Cuisine : arc autour de la grille, plongée, remontée au-dessus du passe.
  { t: 17.6, p: [8.0, 1.6, -13.0], yaw: -50, pitch: -6 },
  { t: 19.2, p: [8.9, 1.2, -14.3], yaw: -82, pitch: -15 },
  { t: 20.6, p: [8.7, 1.05, -15.6], yaw: -76, pitch: -12 },
  { t: 22.0, p: [7.0, 1.9, -16.4], yaw: 30, pitch: -4 },
  { t: 23.0, p: [5.4, 1.7, -16.5], yaw: 82, pitch: 0 },
  // 05 — Cave : porte latérale, allée entre les casiers, virage à droite vers la sortie arrière.
  { t: 24.2, p: [3.0, 1.6, -16.0], yaw: 90, pitch: 0 },
  { t: 26.6, p: [-4.0, 1.6, -15.6], yaw: 86, pitch: 0 },
  { t: 28.0, p: [-8.0, 1.6, -15.8], yaw: 64, pitch: 0 },
  { t: 29.1, p: [-9.4, 1.6, -17.3], yaw: 12, pitch: 0 },
  { t: 30.0, p: [-9.5, 1.6, -19.2], yaw: 0, pitch: 0 },
  // Transition — sortie dans le jardin, on continue d'avancer puis lacet de 180°.
  { t: 31.6, p: [-9.3, 1.8, -23.0], yaw: 0, pitch: 2 },
  { t: 33.2, p: [-8.8, 2.2, -26.0], yaw: 95, pitch: 0 },
  { t: 34.8, p: [-8.2, 2.6, -27.0], yaw: 180, pitch: -2 },
  // 06 — Révélation : recule et grimpe en regardant le bâtiment.
  { t: 37.0, p: [-7.0, 5.0, -31.0], yaw: 180, pitch: -8 },
  { t: 40.0, p: [-4.0, 16.0, -42.0], yaw: 182, pitch: -20 },
  { t: 43.0, p: [0.0, 31.0, -57.0], yaw: 184, pitch: -27 },
  { t: 45.0, p: [1.5, 38.0, -63.0], yaw: 185, pitch: -29 },
];

const catmull = (p0, p1, p2, p3, u) => {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
};

export function sample(t) {
  const k = KEYS;
  if (t <= k[0].t) return { p: [...k[0].p], yaw: k[0].yaw, pitch: k[0].pitch };
  if (t >= k[k.length - 1].t) { const e = k[k.length - 1]; return { p: [...e.p], yaw: e.yaw, pitch: e.pitch }; }
  let i = 0;
  while (k[i + 1].t < t) i++;
  const a = k[Math.max(0, i - 1)], b = k[i], c = k[i + 1], d = k[Math.min(k.length - 1, i + 2)];
  const u = (t - b.t) / (c.t - b.t);
  const p = [0, 1, 2].map((j) => catmull(a.p[j], b.p[j], c.p[j], d.p[j], u));
  const yaw = catmull(a.yaw, b.yaw, c.yaw, d.yaw, u);
  const pitch = catmull(a.pitch, b.pitch, c.pitch, d.pitch, u);
  return { p, yaw, pitch };
}
