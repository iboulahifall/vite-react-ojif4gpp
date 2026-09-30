// Prévisualisation volumétrique (grey-box) du vol Ibou Berger.
// Ce n'est PAS le rendu final : il sert à caler la trajectoire, le rythme de défilement
// et le moteur d'images en attendant les clips Higgsfield.
import * as THREE from 'three';
import { sample, DURATION } from './route.js';

const W = Number(new URLSearchParams(location.search).get('w') || 960);
const H = Math.round((W * 9) / 16);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.7;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, W / H, 0.05, 900);
camera.rotation.order = 'YXZ';

// Ciel de crépuscule
{
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#1b1f3f');
  grd.addColorStop(0.55, '#4a3a63');
  grd.addColorStop(0.8, '#c0664a');
  grd.addColorStop(1, '#e7a46a');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
  sky.rotation.x = 0; // gradient suit l'axe vertical de la sphère (UV v)
  scene.add(sky);
}
scene.fog = new THREE.Fog('#3a3350', 60, 420);

scene.add(new THREE.HemisphereLight('#8a92c4', '#3a2a1e', 1.5));
const sun = new THREE.DirectionalLight('#ffb27a', 0.9);
sun.position.set(-120, 30, 20);
scene.add(sun);

const M = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
const mat = {
  basalt: M('#2b2724'),
  basaltLight: M('#3a3531'),
  timber: M('#7a4a2a'),
  timberDark: M('#4a2d1c'),
  paving: M('#b9a88f'),
  sand: M('#8f7d64'),
  ground: M('#3b3226'),
  grass: M('#2f3a24'),
  linen: M('#e9e0d0'),
  brass: M('#b8955a', { emissive: '#3a2a10' }),
  steel: M('#6d6f72'),
  glass: new THREE.MeshLambertMaterial({ color: '#9fb6c8', transparent: true, opacity: 0.18 }),
  ember: new THREE.MeshBasicMaterial({ color: '#ff7a2e' }),
  flame: new THREE.MeshBasicMaterial({ color: '#ffb04a' }),
  warm: new THREE.MeshBasicMaterial({ color: '#ffd9a0' }),
  amber: new THREE.MeshBasicMaterial({ color: '#e0913f' }),
  road: M('#23211f'),
  roadLine: new THREE.MeshBasicMaterial({ color: '#d8d2c4' }),
  white: M('#d9d4cb'),
  ocean: M('#1f3b52', { emissive: '#0a1520' }),
  leaf: M('#2f4a26'),
  bark: M('#6b5a4a'),
  car: M('#4a4e55'),
  headlight: new THREE.MeshBasicMaterial({ color: '#fff4d6' }),
  taillight: new THREE.MeshBasicMaterial({ color: '#c0302a' }),
};

function box(w, h, d, x, y, z, m) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y + h / 2, z);
  scene.add(b);
  return b;
}
function cyl(rt, rb, h, x, y, z, m, seg = 20) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  c.position.set(x, y + h / 2, z);
  scene.add(c);
  return c;
}
function light(color, intensity, dist, x, y, z) {
  const l = new THREE.PointLight(color, intensity, dist, 1.6);
  l.position.set(x, y, z);
  scene.add(l);
  return l;
}

const WH = 4.2; // hauteur des murs
const T = 0.35; // épaisseur

// ---------- Sol, parvis, route, parking ----------
box(600, 0.02, 600, 0, -0.02, 0, mat.ground);
box(18, 0.03, 20, 0, 0, 10, mat.paving); // parvis
box(400, 0.04, 9, 0, 0, 26, mat.road); // route de la Corniche
for (let x = -190; x < 200; x += 8) box(3, 0.05, 0.18, x, 0, 26, mat.roadLine);
box(6, 0.035, 28, 18, 0, 8, mat.road); // voie d'accès
box(16, 0.035, 16, 22, 0, -10, mat.road); // parking
for (let i = 0; i < 6; i++) box(0.12, 0.05, 4.5, 15 + i * 2.6, 0, -15, mat.roadLine);
// voitures stationnées (immobiles)
[[16.3, -15], [18.9, -15], [24.1, -15]].forEach(([x, z]) => {
  box(1.8, 0.9, 4.2, x, 0.15, z, mat.car);
  box(1.5, 0.55, 2.2, x, 1.05, z + 0.2, mat.car);
});
// voitures sur la route (immobiles, phares allumés)
[[-40, 24.2, 1], [35, 27.8, -1], [80, 24.2, 1]].forEach(([x, z, dir]) => {
  box(4.2, 0.9, 1.8, x, 0.15, z, mat.car);
  box(0.1, 0.2, 1.4, x + dir * 2.12, 0.55, z, mat.headlight);
  box(0.1, 0.2, 1.4, x - dir * 2.12, 0.55, z, mat.taillight);
});

// Océan à l'ouest + rivage rocheux
box(500, 0.02, 700, -300, -0.1, 0, mat.ocean);
for (let i = 0; i < 18; i++) box(4 + (i % 3) * 2, 1 + (i % 4) * 0.5, 5, -52 + (i % 2) * 3, -0.2, -120 + i * 13, mat.basaltLight);
box(6, 0.04, 300, -46, 0, 0, mat.sand); // plage

// Voisins (immeubles bas blancs)
[
  [36, -6, 14, 7, 16], [36, 16, 12, 10, 10], [54, -2, 12, 13, 14], [30, -40, 18, 9, 16],
  [-44, -72, 12, 6, 14], [-28, -10, 10, 7, 12], [26, -62, 14, 11, 12],
  [-22, 40, 14, 9, 12], [10, 42, 18, 12, 12], [40, 42, 14, 8, 14], [70, 10, 16, 10, 18],
].forEach(([x, z, w, h, d]) => {
  box(w, h, d, x, 0, z, mat.white);
  for (let y = 1.6; y < h - 0.8; y += 3) box(w * 0.7, 0.9, 0.1, x, y, z + d / 2 + 0.05, mat.warm);
});

// ---------- Bâtiment ----------
const X0 = -12, X1 = 12, Z0 = 0, Z1 = -19;
// Mur avant avec porte centrale (x -1.3..1.3, h 3.4)
box(X1 - 1.3, WH, T, (1.3 + X1) / 2, 0, Z0, mat.basalt);
box(1.3 - X0 - 2.6 + 0.0, WH, T, (X0 - 1.3) / 2, 0, Z0, mat.basalt);
box(2.6, WH - 3.4, T, 0, 3.4, Z0, mat.basalt);
// lames de bois sur la façade
for (let x = -11.2; x < 11.5; x += 0.55) if (Math.abs(x) > 2.2) box(0.12, 3.4, 0.12, x, 0.3, Z0 + 0.25, mat.timber);
// portes pivotantes ouvertes (vantaux à 90°)
box(0.12, 3.3, 1.25, -1.3, 0, 0.62, mat.timberDark);
box(0.12, 3.3, 1.25, 1.3, 0, 0.62, mat.timberDark);
// Mur gauche (x = -12) avec baies vitrées côté océan (z -1..-10)
box(T, WH, 1, X0, 0, -0.5, mat.basalt);
box(T, 0.5, 9, X0, 0, -5.5, mat.basalt);
box(T, 0.5, 9, X0, WH - 0.5, -5.5, mat.basalt);
box(0.05, WH - 1, 9, X0, 0.5, -5.5, mat.glass);
for (let z = -1; z >= -10; z -= 2.25) box(0.12, WH, 0.12, X0, 0, z, mat.timberDark);
box(T, WH, 9, X0, 0, -14.5, mat.basalt);
// Mur droit
box(T, WH, 19, X1, 0, -9.5, mat.basalt);
// Mur arrière avec porte de service (x -10.3..-8.6, h 2.7)
box(X1 + 8.6, WH, T, (X1 - 8.6) / 2, 0, Z1, mat.basalt);
box(1.7, WH, T, -11.15, 0, Z1, mat.basalt);
box(1.7, WH - 2.7, T, -9.45, 2.7, Z1, mat.basalt);
box(0.08, 2.6, 1.6, -8.6, 0, Z1 - 0.8, mat.timberDark); // vantail ouvert vers l'extérieur
// Toit avec débord avant
box(X1 - X0 + 1, 0.35, 23, 0, WH, -8.5, M('#6a5f55'));
box(X1 - X0 + 1.1, 0.08, 0.25, 0, WH + 0.3, 3, mat.amber); // liseré lumineux de l'avant-toit
box(6, 0.1, 3, -4, WH + 0.35, -6, mat.warm); // puits de lumière
box(4, 0.1, 3, 7, WH + 0.35, -14, mat.warm);
box(X1 - X0, 0.12, 22, 0, WH - 0.12, -8.5, mat.timber); // plafond lames
// Sol intérieur
box(X1 - X0, 0.02, 19, 0, 0.005, -9.5, mat.basaltLight);

// Cloison salle / cuisine+cave (z = -11) avec porte battante (x 8.2..9.8)
box(8.2 - X0, WH, T, (X0 + 8.2) / 2, 0, -11, mat.basalt);
box(X1 - 9.8, WH, T, (9.8 + X1) / 2, 0, -11, mat.basalt);
box(1.6, WH - 2.5, T, 9.0, 2.5, -11, mat.basalt);
const doorPivot = new THREE.Group();
doorPivot.position.set(8.2, 0, -11);
scene.add(doorPivot);
{
  const d = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.45, 0.08), mat.timber);
  d.position.set(0.8, 1.23, 0);
  doorPivot.add(d);
  const port = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), mat.warm);
  port.position.set(0.8, 1.7, 0.05);
  doorPivot.add(port);
}
// Cloison cuisine / cave (x = 4) avec porte (z -17.2..-15.8)
box(T, WH, 4.8, 4, 0, -13.4, mat.basalt);
box(T, WH, 1.8, 4, 0, -18.1, mat.basalt);
box(T, WH - 2.5, 1.4, 4, 2.5, -16.5, mat.basalt);

// ---------- Salle ----------
box(1.3, 0.08, 7.2, -6, 0.72, -5.5, mat.timberDark); // table
box(1.36, 0.02, 7.3, -6, 0.8, -5.5, mat.linen);
for (let z = -2.4; z >= -8.6; z -= 1.25) {
  box(0.5, 0.9, 0.5, -7.1, 0, z, mat.timber);
  box(0.5, 0.9, 0.5, -4.9, 0, z, mat.timber);
  cyl(0.03, 0.03, 0.22, -6, 0.82, z, mat.brass, 8);
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat.flame);
  f.position.set(-6, 1.07, z);
  scene.add(f);
}
// tables rondes secondaires
[[-9.5, -3], [-9.5, -7.5], [-2.5, -9.2], [2.5, -2.5]].forEach(([x, z]) => {
  cyl(0.7, 0.7, 0.05, x, 0.72, z, mat.timberDark);
  cyl(0.72, 0.72, 0.02, x, 0.77, z, mat.linen);
  cyl(0.1, 0.1, 0.72, x, 0, z, mat.basalt, 10);
});
cyl(0.62, 0.62, WH, 0, 0, -5.6, mat.basaltLight, 32); // pilier
light('#ffb36b', 26, 16, -6, 2.6, -5.5);
light('#ffc080', 14, 14, -3, 3, -9);
light('#ffb36b', 14, 14, 0, 3.2, -2);

// ---------- Bar ----------
box(0.9, 1.1, 7.2, 10.2, 0, -5.6, mat.timberDark);
box(1.0, 0.06, 7.3, 10.2, 1.1, -5.6, mat.brass);
box(0.35, 2.6, 8.5, 11.7, 0.6, -5.5, mat.timberDark);
for (let y = 1.0; y < 3.2; y += 0.55) {
  box(0.36, 0.04, 8.5, 11.6, y, -5.5, mat.amber);
  for (let z = -1.6; z > -9.4; z -= 0.28) cyl(0.04, 0.045, 0.32, 11.55, y + 0.04, z, mat.brass, 6);
}
for (let z = -2.5; z > -9; z -= 1.3) cyl(0.2, 0.18, 0.75, 9.1, 0, z, mat.brass, 12); // tabourets
light('#ffa860', 20, 12, 9.2, 2.8, -5.5);

// ---------- Cuisine ----------
box(1.2, 0.9, 5, 11.2, 0, -15.2, mat.steel); // grille
box(1.0, 0.04, 4.8, 11.2, 0.9, -15.2, mat.ember);
const flames = [];
for (let i = 0; i < 9; i++) {
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 8), mat.flame);
  f.position.set(11.0 + (i % 2) * 0.35, 1.12, -13.1 - i * 0.52);
  scene.add(f);
  flames.push(f);
}
box(0.5, 0.12, 1.1, 11.0, 1.0, -14.2, mat.timberDark); // pièce sur la grille
box(1.2, 1.2, 5.2, 11.2, WH - 1.3, -15.2, mat.steel); // hotte
box(1.0, 1.0, 4.6, 6.4, 0, -14.8, mat.steel); // passe
box(1.05, 0.05, 4.7, 6.4, 1.0, -14.8, mat.brass);
for (let z = -13; z > -17; z -= 1.1) box(0.25, 0.1, 0.25, 6.4, 2.1, z, mat.amber); // lampes chauffantes
light('#ff7a2e', 16, 9, 10.4, 1.6, -15.2);
light('#ffc98a', 14, 10, 6.4, 2.6, -14.8);
light('#ffc98a', 10, 8, 5.5, 2.6, -17.5);

// ---------- Cave ----------
function rack(x0, x1, z) {
  box(x1 - x0, 2.4, 0.5, (x0 + x1) / 2, 0, z, mat.timberDark);
  for (let x = x0 + 0.2; x < x1; x += 0.22)
    for (let y = 0.25; y < 2.3; y += 0.3) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6), mat.bark);
      b.rotation.x = Math.PI / 2;
      b.position.set(x, y, z + (z > -16 ? -0.22 : 0.22));
      scene.add(b);
    }
}
rack(-8.6, 3.6, -14.2);
rack(-7.8, 3.6, -17.6);
box(0.05, 2.6, 11.4, -2.2, 0, -12.6, mat.glass);
light('#ffbf80', 12, 10, -1, 2.4, -15.9);
light('#ffbf80', 10, 9, -5, 2.4, -15.9);
light('#ffbf80', 12, 8, -9, 2.4, -17.5);

// ---------- Jardin arrière ----------
box(22, 0.03, 16, -4, 0, -27, mat.grass);
box(1.6, 0.035, 10, -9.4, 0, -24, mat.paving);
// baobab
cyl(1.1, 1.5, 5.5, -1, 0, -29, mat.bark, 18);
[[0, 0.6], [1.2, -0.4], [-1.1, 0.3], [0.3, -1.2]].forEach(([dx, dz]) => {
  const br = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 3.2, 8), mat.bark);
  br.position.set(-1 + dx * 1.2, 6.2, -29 + dz * 1.2);
  br.rotation.set(dz * 0.6, 0, -dx * 0.6);
  scene.add(br);
});
const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.6, 16, 10), mat.leaf);
canopy.scale.set(1.3, 0.5, 1.3);
canopy.position.set(-1, 7.6, -29);
scene.add(canopy);
// guirlandes de lanternes
for (let i = 0; i < 4; i++) {
  const z = -21.5 - i * 3.2;
  box(0.08, 3, 0.08, -13, 0, z, mat.timberDark);
  box(0.08, 3, 0.08, 5, 0, z, mat.timberDark);
  for (let x = -12.5; x < 5; x += 1.1) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat.warm);
    s.position.set(x, 2.85 - Math.sin(((x + 13) / 18) * Math.PI) * 0.45, z);
    scene.add(s);
  }
}
[[-5, -23], [-5, -33], [3, -25], [3, -33]].forEach(([x, z]) => {
  cyl(0.6, 0.6, 0.45, x, 0, z, mat.timber);
});
light('#ffcf8a', 10, 16, -4, 3, -24);
light('#ffcf8a', 8, 16, 2, 3, -31);
// clôture du jardin
box(24, 1.8, 0.2, -4, 0, -35, mat.basaltLight);
box(0.2, 1.8, 16, -16, 0, -27, mat.basaltLight);
box(0.2, 1.8, 16, 8, 0, -27, mat.basaltLight);

// ---------- Parvis : brasero et palmiers ----------
cyl(0.7, 0.35, 0.6, -3.5, 0.4, 6.5, mat.basalt, 24);
cyl(0.12, 0.2, 0.4, -3.5, 0, 6.5, mat.basalt, 12);
const brazierFlames = [];
for (let i = 0; i < 5; i++) {
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 8), mat.flame);
  f.position.set(-3.5 + Math.cos(i * 1.3) * 0.25, 1.3, 6.5 + Math.sin(i * 1.3) * 0.25);
  scene.add(f);
  brazierFlames.push(f);
}
light('#ff9a4a', 14, 10, -3.5, 1.8, 6.5);
function palm(x, z) {
  cyl(0.14, 0.22, 6.5, x, 0, z, mat.bark, 10);
  for (let i = 0; i < 7; i++) {
    const l = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.2, 5), mat.leaf);
    l.position.set(x + Math.cos(i) * 1.1, 6.4, z + Math.sin(i) * 1.1);
    l.rotation.set(Math.sin(i) * 1.2, 0, -Math.cos(i) * 1.2);
    scene.add(l);
  }
}
palm(-7, 10); palm(7.5, 11); palm(-10, 3);
light('#ffd09a', 6, 10, 0, 2.2, -1.5); // lueur de l'entrée

// ---------- Rendu ----------
const D2R = Math.PI / 180;
window.renderAt = (t) => {
  const s = sample(t);
  const a = sample(Math.max(0, t - 0.06)), b = sample(Math.min(DURATION, t + 0.06));
  const yawRate = (b.yaw - a.yaw) / 0.12; // deg/s
  const roll = Math.max(-14, Math.min(14, yawRate * 0.12));
  camera.position.set(...s.p);
  camera.rotation.set(s.pitch * D2R, s.yaw * D2R, roll * D2R);
  // porte de cuisine : s'ouvre de 15,0 à 16,0 s vers l'intérieur de la cuisine
  const k = Math.min(1, Math.max(0, (t - 15.0) / 1.0));
  doorPivot.rotation.y = (1 - Math.cos(k * Math.PI)) * 0.5 * 1.75;
  flames.forEach((f, i) => { f.scale.y = 0.8 + 0.35 * Math.abs(Math.sin(t * 7 + i * 1.7)); });
  brazierFlames.forEach((f, i) => { f.scale.y = 0.8 + 0.4 * Math.abs(Math.sin(t * 6 + i * 2.1)); });
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/webp', 0.8);
};
window.previzReady = true;
