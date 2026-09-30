// Rendu 3D stylisé du vol Ibou Berger (Three.js, rendu hors ligne image par image).
// Même trajectoire que route.js. Matières procédurales (pierre, iroko, laiton, dallage),
// feu en particules, halo lumineux (bloom), grain et vignettage.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { sample, DURATION } from './route.js';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w') || 1440);
const H = Math.round((W * 9) / 16);

// ── Hasard déterministe (le rendu doit être identique à chaque passage) ──────
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(1977);

// ── Rendu ────────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Number(q.get('exp') || 1.0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, W / H, 0.05, 1200);
camera.rotation.order = 'YXZ';

// ── Textures procédurales ────────────────────────────────────────────────────
function canvasTex(size, draw, { repeat = true, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
const speckle = (g, s, n, cols, rmax) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(R() * cols.length) | 0]; const r = R() * rmax; g.fillRect(R() * s, R() * s, r, r); } };

// Basalte appareillé : 4 assises, joints fins. Taille monde : 2 m.
const basaltTex = canvasTex(512, (g, s) => {
  g.fillStyle = '#27221f'; g.fillRect(0, 0, s, s);
  speckle(g, s, 9000, ['#2f2926', '#1f1b19', '#352e2a', '#231f1c'], 3);
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const y = (r * s) / rows;
    let x = r % 2 ? -s / 6 : 0;
    while (x < s) {
      const w = s / 3 + (R() - 0.5) * 60;
      g.fillStyle = `rgba(${40 + R() * 14},${34 + R() * 10},${30 + R() * 8},0.35)`;
      g.fillRect(x + 2, y + 2, w - 4, s / rows - 4);
      g.fillStyle = '#141110'; g.fillRect(x, y, 3, s / rows);
      x += w;
    }
    g.fillStyle = '#141110'; g.fillRect(0, y, s, 3);
  }
});
// Iroko : veinage chaud. Taille monde : 1 m.
const woodTex = canvasTex(512, (g, s) => {
  const grd = g.createLinearGradient(0, 0, s, 0);
  grd.addColorStop(0, '#7b4a2b'); grd.addColorStop(0.5, '#8a5733'); grd.addColorStop(1, '#724427');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 180; i++) {
    g.strokeStyle = `rgba(${50 + R() * 40},${25 + R() * 20},${12 + R() * 10},${0.15 + R() * 0.25})`;
    g.lineWidth = 0.5 + R() * 2.5;
    const x = R() * s; g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= s; y += 32) g.lineTo(x + Math.sin(y * 0.02 + i) * 4, y);
    g.stroke();
  }
});
const woodDarkTex = canvasTex(512, (g, s) => {
  g.fillStyle = '#3b2418'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(20,10,5,${0.2 + R() * 0.3})`; g.lineWidth = 0.5 + R() * 2; const x = R() * s; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (R() - 0.5) * 10, s); g.stroke(); }
});
// Dalles calcaires 1 m. Taille monde : 2 m.
const pavingTex = canvasTex(512, (g, s) => {
  g.fillStyle = '#b7a78e'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = `rgb(${175 + R() * 20},${160 + R() * 18},${135 + R() * 16})`; g.fillRect(i * s / 2 + 2, j * s / 2 + 2, s / 2 - 4, s / 2 - 4); }
  speckle(g, s, 4000, ['#a8987f', '#c4b59c', '#9d8e76'], 2);
  g.fillStyle = '#7d6f5c'; g.fillRect(0, 0, s, 3); g.fillRect(0, s / 2, s, 3); g.fillRect(0, 0, 3, s); g.fillRect(s / 2, 0, 3, s);
});
const floorTex = canvasTex(512, (g, s) => {
  g.fillStyle = '#2c2623'; g.fillRect(0, 0, s, s);
  speckle(g, s, 6000, ['#332c28', '#26211e', '#3a322d'], 2);
  g.fillStyle = '#1a1614'; g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s);
});
const grassTex = canvasTex(256, (g, s) => { g.fillStyle = '#2b3520'; g.fillRect(0, 0, s, s); speckle(g, s, 6000, ['#34402a', '#232c1a', '#3b4a2c', '#2e3a22'], 2); });
const asphaltTex = canvasTex(256, (g, s) => { g.fillStyle = '#262422'; g.fillRect(0, 0, s, s); speckle(g, s, 5000, ['#2e2c29', '#1f1d1b', '#34312d'], 1.5); });
const sandTex = canvasTex(256, (g, s) => { g.fillStyle = '#9c8a6c'; g.fillRect(0, 0, s, s); speckle(g, s, 5000, ['#a8977a', '#8e7d61', '#b3a285'], 1.5); });
const tileTex = canvasTex(256, (g, s) => { g.fillStyle = '#8f877a'; g.fillRect(0, 0, s, s); for (let i = 0; i <= 8; i++) { g.fillStyle = '#6a6358'; g.fillRect(i * s / 8, 0, 2, s); g.fillRect(0, i * s / 8, s, 2); } });
const renderTex = canvasTex(256, (g, s) => { g.fillStyle = '#dcd5c8'; g.fillRect(0, 0, s, s); speckle(g, s, 3000, ['#d2cabb', '#e4ddd1', '#c9c1b2'], 2); });

const glowTex = canvasTex(128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); }, { repeat: false });
const flameTex = canvasTex(128, (g, s) => { const r = g.createRadialGradient(s / 2, s * 0.7, 0, s / 2, s * 0.6, s * 0.45); r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(0.3, 'rgba(255,170,70,0.9)'); r.addColorStop(0.7, 'rgba(230,80,20,0.35)'); r.addColorStop(1, 'rgba(200,40,10,0)'); g.fillStyle = r; g.beginPath(); g.ellipse(s / 2, s * 0.58, s * 0.3, s * 0.45, 0, 0, Math.PI * 2); g.fill(); }, { repeat: false });
const smokeTex = canvasTex(128, (g, s) => { for (let i = 0; i < 14; i++) { const x = s / 2 + (R() - 0.5) * s * 0.4, y = s / 2 + (R() - 0.5) * s * 0.4, rr = s * (0.15 + R() * 0.25); const r = g.createRadialGradient(x, y, 0, x, y, rr); r.addColorStop(0, 'rgba(200,190,180,0.25)'); r.addColorStop(1, 'rgba(200,190,180,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); } }, { repeat: false });

// ── Ciel et environnement ────────────────────────────────────────────────────
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sunDir: { value: new THREE.Vector3(-1, 0.04, 0.25).normalize() } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
    void main(){
      float h = clamp(vDir.y, -0.2, 1.0);
      vec3 top = vec3(0.045,0.055,0.13), mid = vec3(0.22,0.14,0.30), low = vec3(0.85,0.36,0.18), ground = vec3(0.05,0.04,0.05);
      vec3 c = mix(mid, top, smoothstep(0.08, 0.6, h));
      c = mix(low, c, smoothstep(-0.02, 0.16, h));
      float s = max(dot(vDir, sunDir), 0.0);
      c += vec3(1.0,0.45,0.18) * pow(s, 6.0) * 0.9 * (1.0 - smoothstep(0.0, 0.35, h));
      c += vec3(1.0,0.7,0.4) * pow(s, 90.0) * 1.5;
      if (vDir.y < -0.02) c = ground;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), skyMat));
{
  const pts = [];
  for (let i = 0; i < 700; i++) { const th = R() * Math.PI * 2, ph = Math.acos(0.25 + R() * 0.75); pts.push(Math.sin(ph) * Math.cos(th) * 700, Math.cos(ph) * 700, Math.sin(ph) * Math.sin(th) * 700); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd6ff', size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.55, fog: false })));
}
{
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat));
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.55;
}
scene.fog = new THREE.FogExp2('#2c2438', 0.0042);

scene.add(new THREE.HemisphereLight('#6c73a8', '#2a1c14', 0.55));
const sun = new THREE.DirectionalLight('#ff9a5c', 1.6);
sun.position.set(-160, 18, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 400 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
sun.target.position.set(0, 0, -8);
scene.add(sun, sun.target);

// ── Matières ─────────────────────────────────────────────────────────────────
const S = (o) => new THREE.MeshStandardMaterial(o);
const mat = {
  basalt: S({ map: basaltTex, roughness: 0.88, userData: { tile: 2 } }),
  wood: S({ map: woodTex, roughness: 0.6, userData: { tile: 1 } }),
  woodDark: S({ map: woodDarkTex, roughness: 0.55, userData: { tile: 1 } }),
  paving: S({ map: pavingTex, roughness: 0.9, userData: { tile: 2 } }),
  floor: S({ map: floorTex, roughness: 0.5, metalness: 0.05, userData: { tile: 2 } }),
  grass: S({ map: grassTex, roughness: 1, userData: { tile: 3 } }),
  asphalt: S({ map: asphaltTex, roughness: 0.95, userData: { tile: 4 } }),
  sand: S({ map: sandTex, roughness: 1, userData: { tile: 4 } }),
  tile: S({ map: tileTex, roughness: 0.55, userData: { tile: 1.2 } }),
  render: S({ map: renderTex, roughness: 0.95, userData: { tile: 3 } }),
  linen: S({ color: '#ece3d3', roughness: 0.9 }),
  brass: S({ color: '#c49a55', metalness: 0.95, roughness: 0.28 }),
  copper: S({ color: '#b86a3c', metalness: 0.95, roughness: 0.3 }),
  steel: S({ color: '#8a8d90', metalness: 0.9, roughness: 0.35 }),
  blackSteel: S({ color: '#1c1b1a', metalness: 0.7, roughness: 0.5 }),
  glass: S({ color: '#a9c2d4', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.12, envMapIntensity: 2 }),
  plate: S({ color: '#f1ece2', roughness: 0.25 }),
  bottleGreen: S({ color: '#1f3b22', roughness: 0.15, metalness: 0.2, emissive: '#0c1a0c' }),
  bottleAmber: S({ color: '#5a2d10', roughness: 0.15, metalness: 0.2, emissive: '#2a1206' }),
  emberDark: S({ color: '#3a1a0e', emissive: '#ff4a10', emissiveIntensity: 1.1, roughness: 1 }),
  warmLamp: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc987').multiplyScalar(3) }),
  amberStrip: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9c45').multiplyScalar(1.3) }),
  window: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc890').multiplyScalar(1.4) }),
  windowDim: new THREE.MeshBasicMaterial({ color: '#3a3448' }),
  ocean: S({ color: '#152a3c', roughness: 0.18, metalness: 0.35 }),
  leaf: S({ color: '#2e4a24', roughness: 0.8, side: THREE.DoubleSide }),
  leafDark: S({ color: '#223a1c', roughness: 0.85 }),
  bark: S({ color: '#6f5d4b', roughness: 0.95 }),
  palmBark: S({ color: '#5b4a3a', roughness: 0.95 }),
  car: S({ color: '#3d4148', metalness: 0.7, roughness: 0.35 }),
  carWhite: S({ color: '#d8d8d4', metalness: 0.6, roughness: 0.35 }),
  headlight: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2d0').multiplyScalar(3) }),
  taillight: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(2) }),
  roadLine: S({ color: '#d6d0c2', roughness: 0.8 }),
  meat: S({ color: '#6a2a16', roughness: 0.6, emissive: '#2a0a02' }),
  fish: S({ color: '#b8a58a', roughness: 0.5 }),
  cushion: S({ color: '#b5643a', roughness: 1 }),
  rock: S({ color: '#26211e', roughness: 0.95 }),
  wine: S({ color: '#8a0f22', roughness: 0.1, transparent: true, opacity: 0.85 }),
};

// UV en coordonnées monde pour que les textures gardent leur échelle sur chaque boîte
function worldUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  uv.needsUpdate = true;
}
function box(w, h, d, x, y, z, m, { shadow = true } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (m.userData?.tile) worldUV(geo, w, h, d, m.userData.tile);
  const b = new THREE.Mesh(geo, m);
  b.position.set(x, y + h / 2, z);
  b.castShadow = shadow; b.receiveShadow = true;
  scene.add(b);
  return b;
}
function cyl(rt, rb, h, x, y, z, m, seg = 20) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  c.position.set(x, y + h / 2, z);
  c.castShadow = true; c.receiveShadow = true;
  scene.add(c);
  return c;
}
function light(color, intensity, dist, x, y, z) {
  const l = new THREE.PointLight(color, intensity, dist, 2);
  l.position.set(x, y, z);
  scene.add(l);
  return l;
}
function glow(x, y, z, size, color, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.position.set(x, y, z); s.scale.set(size, size, 1);
  scene.add(s);
  return s;
}

// ── Feu : particules déterministes animées par le temps ──────────────────────
const fires = [];
function fire(x, y, z, sx, sz, n, scale = 1) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(sp);
    parts.push({ sp, ox: (R() - 0.5) * sx, oz: (R() - 0.5) * sz, ph: R() * 10, sp0: 0.8 + R() * 0.8, sz0: (0.35 + R() * 0.3) * scale });
  }
  const embers = [];
  for (let i = 0; i < n * 2; i++) {
    const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff8a3a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(e);
    embers.push({ e, ox: (R() - 0.5) * sx, oz: (R() - 0.5) * sz, ph: R(), sp: 0.25 + R() * 0.35, dr: (R() - 0.5) * 0.6 });
  }
  fires.push({ x, y, z, parts, embers, scale });
}
const smokes = [];
function smoke(x, y, z, n, spread) {
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: '#8a8078', transparent: true, depthWrite: false, opacity: 0.3 }));
    scene.add(sp);
    smokes.push({ sp, x: x + (R() - 0.5) * spread, y, z: z + (R() - 0.5) * spread * 3, ph: R(), rate: 0.08 + R() * 0.08 });
  }
}
function animateFx(t) {
  for (const f of fires) {
    for (const p of f.parts) {
      const k = (t * p.sp0 + p.ph) % 1;
      const flick = 0.75 + 0.25 * Math.sin(t * 9 + p.ph * 7);
      p.sp.position.set(f.x + p.ox * (1 - k * 0.5), f.y + k * 0.55 * f.scale, f.z + p.oz * (1 - k * 0.5));
      const sc = p.sz0 * (1 - k * 0.6) * flick;
      p.sp.scale.set(sc * 0.8, sc * 1.5, 1);
      p.sp.material.opacity = (1 - k) * 0.78;
    }
    for (const e of f.embers) {
      const k = (t * e.sp + e.ph) % 1;
      e.e.position.set(f.x + e.ox + Math.sin(t * 2 + e.ph * 9) * e.dr * k, f.y + k * 2.2 * f.scale, f.z + e.oz + Math.cos(t * 1.7 + e.ph * 5) * e.dr * k);
      e.e.scale.setScalar(0.05 * (1 - k * 0.5));
      e.e.material.opacity = (1 - k) * 0.9;
    }
  }
  for (const s of smokes) {
    const k = (t * s.rate + s.ph) % 1;
    s.sp.position.set(s.x + Math.sin(t * 0.5 + s.ph * 6) * 0.3, s.y + k * 2.2, s.z);
    s.sp.scale.setScalar(0.8 + k * 2.2);
    s.sp.material.opacity = Math.sin(k * Math.PI) * 0.22;
  }
}

// ══ Extérieur ═══════════════════════════════════════════════════════════════
box(900, 0.02, 900, 0, -0.03, 0, S({ color: '#2a241d', roughness: 1 }), { shadow: false });
box(18, 0.03, 20, 0, 0, 10, mat.paving, { shadow: false });
box(3, 0.035, 10, 0, 0, 25, mat.paving, { shadow: false });
box(420, 0.04, 9, 0, 0, 26, mat.asphalt, { shadow: false });
box(420, 0.18, 2.5, 0, 0, 21.2, mat.paving, { shadow: false });
box(420, 0.18, 2.5, 0, 0, 30.8, mat.paving, { shadow: false });
for (let x = -200; x < 210; x += 7) box(3, 0.05, 0.16, x, 0.01, 26, mat.roadLine, { shadow: false });
for (let x = -120; x <= 120; x += 24) {
  cyl(0.07, 0.1, 7, x, 0, 20.4, mat.blackSteel, 8);
  box(1.2, 0.08, 0.2, x, 7, 20.9, mat.blackSteel, { shadow: false });
  box(0.5, 0.06, 0.25, x, 6.96, 21.4, mat.warmLamp, { shadow: false });
  glow(x, 6.8, 21.4, 2.4, '#ffc27a', 0.5);
}
light('#ffc27a', 60, 22, -24, 6.5, 21.4);
light('#ffc27a', 60, 22, 24, 6.5, 21.4);
box(6, 0.035, 26, 18, 0, 8, mat.asphalt, { shadow: false });
box(18, 0.035, 16, 22, 0, -10, mat.asphalt, { shadow: false });
for (let i = 0; i < 7; i++) box(0.12, 0.05, 4.5, 14.5 + i * 2.6, 0.005, -15, mat.roadLine, { shadow: false });
function car(x, z, rotY, m, lights) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.75, 4.3), m); body.position.y = 0.55; body.castShadow = true;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.3), m); cab.position.set(0, 1.18, -0.2); cab.castShadow = true;
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.4, 2.1), S({ color: '#0e1216', roughness: 0.1, metalness: 0.5 })); win.position.set(0, 1.2, -0.2);
  g.add(body, cab, win);
  for (const [wx, wz] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 14), mat.blackSteel); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.34, wz); g.add(w); }
  if (lights) {
    for (const lx of [-0.62, 0.62]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.05), mat.headlight); hl.position.set(lx, 0.7, 2.16); g.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.05), mat.taillight); tl.position.set(lx, 0.72, -2.16); g.add(tl);
    }
  }
  g.position.set(x, 0, z); g.rotation.y = rotY;
  scene.add(g);
  return g;
}
car(16.3, -15, 0, mat.car); car(18.9, -15, 0, mat.carWhite); car(24.1, -15, 0, mat.car); car(26.7, -15, 0, mat.carWhite);
[[-46, 24.2, Math.PI / 2, mat.carWhite], [38, 27.8, -Math.PI / 2, mat.car], [86, 24.2, Math.PI / 2, mat.car], [-96, 27.8, -Math.PI / 2, mat.carWhite]].forEach(([x, z, r, m]) => {
  car(x, z, r, m, true);
  glow(x + (r > 0 ? 1 : -1) * 2.4, 0.7, z, 1.6, '#fff0cc', 0.6);
});
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(700, 900), mat.ocean);
ocean.rotation.x = -Math.PI / 2; ocean.position.set(-400, -0.15, 0);
scene.add(ocean);
box(10, 0.04, 400, -46, 0, 0, mat.sand, { shadow: false });
for (let i = 0; i < 40; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + R() * 2.2, 0), mat.rock); r.position.set(-52 + R() * 6, -0.3, -160 + i * 8 + R() * 4); r.rotation.set(R() * 3, R() * 3, R() * 3); r.scale.y = 0.5 + R() * 0.4; scene.add(r); }
[
  [36, -6, 14, 7, 16], [36, 14, 12, 10, 8], [54, -2, 12, 13, 14], [32, -44, 18, 9, 16], [52, -36, 14, 12, 12],
  [-44, -72, 12, 6, 14], [-30, -10, 10, 7, 12], [-30, 8, 10, 9, 10], [26, -64, 14, 11, 12], [60, 14, 14, 16, 12],
  [-24, 42, 14, 9, 12], [10, 44, 18, 12, 12], [40, 44, 14, 8, 14], [74, 44, 16, 14, 12], [-56, 44, 12, 7, 12], [90, -10, 16, 18, 20],
].forEach(([x, z, w, h, d]) => {
  box(w, h, d, x, 0, z, mat.render);
  box(w + 0.3, 0.4, d + 0.3, x, h, z, mat.render);
  for (let y = 1.4; y < h - 1; y += 3) for (let k = -w / 2 + 1.5; k < w / 2 - 1; k += 2.6) {
    const m = R() < 0.45 ? mat.window : mat.windowDim;
    box(1.1, 1.2, 0.08, x + k, y, z + d / 2 + 0.04, m, { shadow: false });
    box(1.1, 1.2, 0.08, x + k, y, z - d / 2 - 0.04, m, { shadow: false });
  }
});

// ══ Bâtiment ════════════════════════════════════════════════════════════════
const WH = 4.2, T = 0.35, X0 = -12, X1 = 12, Z0 = 0, Z1 = -19;
box(X1 - 1.3, WH, T, (1.3 + X1) / 2, 0, Z0, mat.basalt);
box(X1 - 1.3, WH, T, -(1.3 + X1) / 2, 0, Z0, mat.basalt);
box(2.6, WH - 3.4, T, 0, 3.4, Z0, mat.basalt);
for (let x = -11.3; x < 11.5; x += 0.42) if (Math.abs(x) > 2.3) box(0.14, 3.5, 0.16, x, 0.35, Z0 + 0.26, mat.wood);
box(24, 0.35, 0.2, 0, 0, Z0 + 0.35, mat.basalt);
box(0.14, 3.35, 1.28, -1.36, 0.02, 0.66, mat.woodDark);
box(0.14, 3.35, 1.28, 1.36, 0.02, 0.66, mat.woodDark);
box(0.04, 0.6, 0.04, -1.28, 1.2, 1.1, mat.brass); box(0.04, 0.6, 0.04, 1.28, 1.2, 1.1, mat.brass);
box(T, WH, 1, X0, 0, -0.5, mat.basalt);
box(T, 0.45, 9, X0, 0, -5.5, mat.basalt);
box(T, 0.4, 9, X0, WH - 0.4, -5.5, mat.basalt);
box(0.04, WH - 0.85, 9, X0, 0.45, -5.5, mat.glass, { shadow: false });
for (let z = -1; z >= -10; z -= 2.25) box(0.12, WH, 0.14, X0, 0, z, mat.woodDark);
box(T, WH, 9, X0, 0, -14.5, mat.basalt);
box(T, WH, 19, X1, 0, -9.5, mat.basalt);
box(X1 + 8.6, WH, T, (X1 - 8.6) / 2, 0, Z1, mat.basalt);
box(1.7, WH, T, -11.15, 0, Z1, mat.basalt);
box(1.7, WH - 2.7, T, -9.45, 2.7, Z1, mat.basalt);
for (let x = -7.8; x < 11.5; x += 0.42) box(0.14, 3.2, 0.16, x, 0.4, Z1 - 0.26, mat.wood);
box(0.08, 2.65, 1.6, -8.62, 0, Z1 - 0.82, mat.woodDark);
box(1.4, 0.06, 0.12, -9.45, 2.62, Z1 - 0.3, mat.warmLamp, { shadow: false });
glow(-9.45, 2.55, Z1 - 0.5, 1.8, '#ffc987', 0.6);
box(X1 - X0 + 1.2, 0.4, 23.4, 0, WH, -8.4, S({ color: '#4a423b', roughness: 0.9 }));
box(X1 - X0 + 1.2, 0.06, 0.2, 0, WH - 0.02, 3.2, mat.amberStrip, { shadow: false });
box(7, 0.12, 3, -4, WH + 0.4, -6, mat.warmLamp, { shadow: false });
box(4, 0.12, 3, 7, WH + 0.4, -14, mat.warmLamp, { shadow: false });
for (let z = 3; z > -18.8; z -= 0.3) box(X1 - X0 - 0.2, 0.06, 0.12, 0, WH - 0.1, z, mat.wood, { shadow: false });
box(X1 - X0, 0.02, 19, 0, 0.005, -9.5, mat.floor, { shadow: false });
box(8.2 - X0, WH, T, (X0 + 8.2) / 2, 0, -11, mat.basalt);
box(X1 - 9.8, WH, T, (9.8 + X1) / 2, 0, -11, mat.basalt);
box(1.6, WH - 2.5, T, 9.0, 2.5, -11, mat.basalt);
const doorPivot = new THREE.Group(); doorPivot.position.set(8.2, 0, -11); scene.add(doorPivot);
{
  const d = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.45, 0.08), mat.wood); d.position.set(0.8, 1.23, 0); doorPivot.add(d);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 24), mat.brass); ring.position.set(0.8, 1.7, 0.05); doorPivot.add(ring);
  const port = new THREE.Mesh(new THREE.CircleGeometry(0.18, 24), mat.window); port.position.set(0.8, 1.7, 0.045); doorPivot.add(port);
  const port2 = port.clone(); port2.position.z = -0.045; port2.rotation.y = Math.PI; doorPivot.add(port2);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.02), mat.brass); plate.position.set(1.3, 1.1, 0.05); doorPivot.add(plate);
}
box(T, WH, 4.8, 4, 0, -13.4, mat.basalt);
box(T, WH, 1.8, 4, 0, -18.1, mat.basalt);
box(T, WH - 2.5, 1.4, 4, 2.5, -16.5, mat.basalt);

// Parvis
[[-5.5, 2.2], [5.5, 2.2]].forEach(([x, z]) => { box(3.5, 0.6, 1.1, x, 0, z, mat.basalt); for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.35 + R() * 0.2, 10, 8), mat.leafDark); b.position.set(x - 1.4 + i * 0.55, 0.8, z); b.castShadow = true; scene.add(b); } });
for (const z of [5, 9, 13, 17]) for (const x of [-2.2, 2.2]) { box(0.16, 0.7, 0.16, x, 0, z, mat.blackSteel); box(0.12, 0.08, 0.12, x, 0.62, z, mat.warmLamp, { shadow: false }); glow(x, 0.6, z, 0.9, '#ffc987', 0.5); }
function palm(x, z, h = 7, lean = 0.2) {
  const pts = []; for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(Math.sin(i / 8 * 1.2) * lean * h * 0.3, i / 8 * h, 0));
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.18, 8), mat.palmBark);
  trunk.position.set(x, 0, z); trunk.castShadow = true; scene.add(trunk);
  const top = pts[8].clone().add(new THREE.Vector3(x, 0, z));
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + R() * 0.3;
    const len = 2.6 + R() * 0.8;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.55, len, 1, 4), mat.leaf);
    const pos = f.geometry.attributes.position;
    for (let v = 0; v < pos.count; v++) { const yy = pos.getY(v) + len / 2; pos.setZ(v, -Math.pow(yy / len, 2) * 1.1); pos.setX(v, pos.getX(v) * (1 - (yy / len) * 0.8)); }
    f.geometry.translate(0, len / 2, 0);
    f.position.copy(top);
    f.rotation.set(-1.1 + R() * 0.3, a, 0, 'YXZ');
    f.castShadow = true;
    scene.add(f);
  }
}
palm(-7, 10, 7.5, 0.3); palm(7.5, 11, 8, -0.25); palm(-10.5, 4.5, 6.5, 0.2); palm(10.5, 15, 7, 0.3);
cyl(0.75, 0.35, 0.55, -3.5, 0.45, 6.5, mat.blackSteel, 28);
cyl(0.1, 0.25, 0.45, -3.5, 0, 6.5, mat.blackSteel, 12);
cyl(0.62, 0.62, 0.08, -3.5, 0.95, 6.5, mat.emberDark, 24);
fire(-3.5, 1.05, 6.5, 0.7, 0.7, 14, 1.4);
const brazierLight = light('#ff8a3a', 55, 14, -3.5, 1.9, 6.5);
light('#ffc98a', 22, 10, 0, 3.0, 2.6);

// ══ Salle ═══════════════════════════════════════════════════════════════════
box(1.3, 0.06, 7.2, -6, 0.72, -5.5, mat.woodDark);
box(1.1, 0.72, 0.12, -6, 0, -2.2, mat.woodDark); box(1.1, 0.72, 0.12, -6, 0, -8.8, mat.woodDark);
box(0.5, 0.01, 7.3, -6, 0.785, -5.5, mat.linen, { shadow: false });
for (let z = -2.4; z >= -8.6; z -= 1.24) {
  for (const sx of [-1, 1]) {
    const cx = -6 + sx * 1.05;
    box(0.46, 0.05, 0.46, cx, 0.46, z, mat.wood);
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(0.06, 0.46, 0.06, cx + lx, 0, z + lz, mat.woodDark, { shadow: false });
    box(0.06, 0.55, 0.46, cx + sx * 0.22, 0.5, z, mat.wood);
    cyl(0.14, 0.14, 0.015, -6 + sx * 0.42, 0.78, z, mat.plate, 20);
    cyl(0.035, 0.03, 0.14, -6 + sx * 0.42 + 0.18, 0.78, z - 0.12, mat.glass, 10);
  }
  cyl(0.035, 0.045, 0.18, -6, 0.78, z, mat.brass, 10);
  box(0.03, 0.05, 0.03, -6, 0.97, z, mat.warmLamp, { shadow: false });
  glow(-6, 1.02, z, 0.35, '#ffb766', 0.9);
}
[[-9.5, -3], [-9.5, -7.5], [-2.4, -9.2], [2.6, -2.6], [5.2, -9.4]].forEach(([x, z]) => {
  cyl(0.72, 0.72, 0.05, x, 0.72, z, mat.woodDark, 32);
  cyl(0.74, 0.74, 0.02, x, 0.765, z, mat.linen, 32);
  cyl(0.1, 0.25, 0.72, x, 0, z, mat.blackSteel, 12);
  cyl(0.03, 0.04, 0.16, x, 0.78, z, mat.brass, 8);
  glow(x, 0.98, z, 0.3, '#ffb766', 0.9);
  for (let k = 0; k < 3; k++) { const a = k * 2.1; cyl(0.13, 0.13, 0.015, x + Math.cos(a) * 0.45, 0.78, z + Math.sin(a) * 0.45, mat.plate, 18); }
});
cyl(0.62, 0.66, WH, 0, 0, -5.6, mat.basalt, 40);
for (const [x, z] of [[-6, -3.4], [-6, -7.6], [2.6, -2.6], [-9.5, -5.3]]) {
  box(0.01, 1.6, 0.01, x, 2.5, z, mat.blackSteel, { shadow: false });
  const sh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 24, 1, true), mat.brass); sh.position.set(x, 2.45, z); scene.add(sh);
  glow(x, 2.3, z, 0.8, '#ffc987', 0.7);
}
light('#ffb36b', 38, 12, -6, 2.2, -3.8);
light('#ffb36b', 38, 12, -6, 2.2, -7.4);
light('#ffc080', 26, 12, 1.5, 3, -3);

// ══ Comptoir ════════════════════════════════════════════════════════════════
box(0.9, 1.08, 7.2, 10.2, 0, -5.6, mat.woodDark);
for (let z = -2.2; z > -9.2; z -= 0.3) box(0.04, 0.95, 0.12, 9.73, 0.05, z, mat.wood, { shadow: false });
box(1.05, 0.06, 7.35, 10.15, 1.08, -5.6, mat.brass);
box(0.35, 2.8, 8.5, 11.72, 0.5, -5.5, mat.woodDark);
{
  const geo = new THREE.CylinderGeometry(0.038, 0.042, 0.32, 8);
  const shelves = [1.0, 1.55, 2.1, 2.65];
  const n = shelves.length * 30;
  const g1 = new THREE.InstancedMesh(geo, mat.bottleGreen, n), g2 = new THREE.InstancedMesh(geo, mat.bottleAmber, n);
  const m4 = new THREE.Matrix4(); let i1 = 0, i2 = 0;
  for (const y of shelves) {
    box(0.4, 0.035, 8.5, 11.5, y, -5.5, mat.brass, { shadow: false });
    box(0.02, 0.02, 8.4, 11.68, y + 0.4, -5.5, mat.amberStrip, { shadow: false });
    for (let z = -1.5; z > -9.4; z -= 0.3) { m4.makeTranslation(11.5, y + 0.2, z + (R() - 0.5) * 0.05); if (R() < 0.5) g1.setMatrixAt(i1++, m4); else g2.setMatrixAt(i2++, m4); }
  }
  g1.count = i1; g2.count = i2; scene.add(g1, g2);
}
for (let z = -2.5; z > -9; z -= 1.3) { cyl(0.2, 0.2, 0.06, 9.2, 0.78, z, mat.wood, 16); cyl(0.03, 0.03, 0.78, 9.2, 0, z, mat.brass, 8); }
for (let z = -3; z > -8.6; z -= 2.2) cyl(0.04, 0.03, 0.14, 10.1, 1.11, z, mat.wine, 10);
light('#ffa860', 34, 10, 9.4, 2.6, -4);
light('#ffa860', 30, 10, 9.4, 2.6, -8);

// ══ Cuisine ═════════════════════════════════════════════════════════════════
box(0.1, 2.2, 7.6, 11.78, 0.3, -15, mat.tile, { shadow: false });
box(7.6, 2.2, 0.1, 8, 0.3, -18.78, mat.tile, { shadow: false });
box(1.25, 0.88, 5, 11.15, 0, -15.2, mat.blackSteel);
box(1.05, 0.05, 4.8, 11.15, 0.88, -15.2, mat.emberDark);
for (let z = -12.9; z > -17.6; z -= 0.12) box(1.05, 0.02, 0.02, 11.15, 0.96, z, mat.steel, { shadow: false });
fire(11.15, 0.98, -15.2, 0.9, 4.4, 24, 0.95);
box(0.55, 0.1, 1.1, 11.05, 0.98, -14.1, mat.meat);
box(0.35, 0.08, 0.9, 11.3, 0.98, -16.2, mat.fish);
box(1.3, 1.3, 5.4, 11.1, WH - 1.4, -15.2, mat.steel);
smoke(11.1, 1.2, -15.2, 14, 0.5);
box(1.0, 0.98, 4.6, 6.4, 0, -14.8, mat.steel);
box(1.08, 0.05, 4.7, 6.4, 0.98, -14.8, mat.brass);
for (let z = -13; z > -16.8; z -= 0.9) { cyl(0.13, 0.13, 0.015, 6.4, 1.03, z, mat.plate, 18); box(0.28, 0.1, 0.28, 6.4, 2.05, z, mat.brass, { shadow: false }); box(0.2, 0.02, 0.2, 6.4, 2.04, z, mat.warmLamp, { shadow: false }); glow(6.4, 2.0, z, 0.5, '#ffb070', 0.6); }
for (let z = -12.4; z > -18; z -= 0.6) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.1, 16), mat.copper); p.position.set(8.8, 2.4, z); p.rotation.x = Math.PI / 2; scene.add(p); }
box(0.03, 0.03, 6, 8.8, 2.62, -15.2, mat.blackSteel, { shadow: false });
light('#ff6a22', 22, 7, 10.2, 1.6, -15.2);
light('#ffc98a', 14, 8, 6.4, 2.6, -14.5);
light('#ffc98a', 8, 6, 5.4, 2.6, -17.2);

// ══ Cave ════════════════════════════════════════════════════════════════════
{
  const geo = new THREE.CylinderGeometry(0.036, 0.036, 0.3, 8); geo.rotateX(Math.PI / 2);
  const inst = [];
  const rack = (x0, x1, z, face) => {
    box(x1 - x0, 2.5, 0.5, (x0 + x1) / 2, 0, z, mat.woodDark);
    for (let x = x0 + 0.15; x < x1 - 0.1; x += 0.2) for (let y = 0.22; y < 2.4; y += 0.24) inst.push([x, y, z + face * 0.2, R() < 0.5]);
    for (let x = x0; x <= x1; x += 1.2) box(0.05, 2.5, 0.55, x, 0, z, mat.wood, { shadow: false });
    box(x1 - x0, 0.03, 0.03, (x0 + x1) / 2, 2.52, z + face * 0.26, mat.amberStrip, { shadow: false });
  };
  rack(-8.6, 3.6, -14.2, -1);
  rack(-7.8, 3.6, -17.6, 1);
  const a = new THREE.InstancedMesh(geo, mat.bottleGreen, inst.length), b = new THREE.InstancedMesh(geo, mat.bottleAmber, inst.length);
  const m4 = new THREE.Matrix4(); let ia = 0, ib = 0;
  for (const [x, y, z, g] of inst) { m4.makeTranslation(x, y, z); if (g) a.setMatrixAt(ia++, m4); else b.setMatrixAt(ib++, m4); }
  a.count = ia; b.count = ib; scene.add(a, b);
}
box(0.04, 2.7, 11.4, -2.2, 0, -12.6, mat.glass, { shadow: false });
light('#ffbf80', 22, 9, 0.5, 2.4, -15.9);
light('#ffbf80', 22, 9, -5, 2.4, -15.9);
light('#ffbf80', 20, 8, -9.2, 2.4, -17.4);

// ══ Jardin arrière ══════════════════════════════════════════════════════════
box(22, 0.03, 16, -4, 0, -27, mat.grass, { shadow: false });
box(1.6, 0.04, 12, -9.4, 0, -25, mat.paving, { shadow: false });
box(10, 0.04, 1.6, -4.6, 0, -30.2, mat.paving, { shadow: false });
{
  const prof = []; for (let i = 0; i <= 12; i++) prof.push(new THREE.Vector2(1.25 + Math.sin((i / 12) * Math.PI) * 0.55 - (i / 12) * 0.6, (i / 12) * 6));
  const trunk = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), mat.bark); trunk.position.set(-1, 0, -29); trunk.castShadow = true; scene.add(trunk);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, len = 2.2 + R() * 1.6;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.32, len, 8), mat.bark);
    br.position.set(-1 + Math.cos(a) * 0.9, 6 + len * 0.3, -29 + Math.sin(a) * 0.9);
    br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); br.castShadow = true; scene.add(br);
    const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + R() * 0.6, 1), mat.leafDark);
    tuft.position.set(-1 + Math.cos(a) * (1.6 + len * 0.5), 6.6 + len * 0.55, -29 + Math.sin(a) * (1.6 + len * 0.5)); tuft.scale.y = 0.55; tuft.castShadow = true; scene.add(tuft);
  }
}
for (let i = 0; i < 4; i++) {
  const z = -21.5 - i * 3.2;
  cyl(0.05, 0.05, 3.1, -13.2, 0, z, mat.blackSteel, 6); cyl(0.05, 0.05, 3.1, 5.2, 0, z, mat.blackSteel, 6);
  for (let x = -12.6; x < 5; x += 0.9) {
    const y = 2.95 - Math.sin(((x + 13.2) / 18.4) * Math.PI) * 0.5;
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat.warmLamp); l.position.set(x, y, z); scene.add(l);
    glow(x, y, z, 0.45, '#ffc987', 0.35);
  }
}
[[-5, -23.5], [-5, -33], [2.5, -25], [2.5, -33]].forEach(([x, z]) => {
  cyl(0.65, 0.65, 0.42, x, 0, z, mat.wood, 24);
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + 0.4; box(0.55, 0.16, 0.55, x + Math.cos(a) * 1.15, 0, z + Math.sin(a) * 1.15, mat.cushion); }
  glow(x, 0.62, z, 0.5, '#ffb766', 0.8);
});
for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.5 + R() * 0.5, 10, 8), mat.leafDark); b.position.set(i < 8 ? -15.2 : 7.2, 0.4, -20.5 - (i % 8) * 1.9); b.castShadow = true; scene.add(b); }
light('#ffcf8a', 30, 16, -4, 3, -23.5);
light('#ffcf8a', 26, 16, 1.5, 3, -31);
for (let x = -15.8; x < 8; x += 0.3) box(0.12, 1.9, 0.12, x, 0, -35, mat.wood);
box(0.25, 1.9, 16, -16, 0, -27, mat.basalt); box(0.25, 1.9, 16, 8, 0, -27, mat.basalt);

// ══ Post-traitement ═════════════════════════════════════════════════════════
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.5, 0.88));
composer.addPass(new OutputPass());
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, res: { value: new THREE.Vector2(W, H) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float seed; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(c * vec3(0.93,0.97,1.08), c * vec3(1.06,1.0,0.9), smoothstep(0.15, 0.7, l));
      vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * 0.85;
      c += (h(vUv * res) - 0.5) * 0.028;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(finish);

// ── Rendu d'une image ────────────────────────────────────────────────────────
const D2R = Math.PI / 180;
window.renderAt = (t) => {
  const s = sample(t);
  const a = sample(Math.max(0, t - 0.08)), b = sample(Math.min(DURATION, t + 0.08));
  const yawRate = (b.yaw - a.yaw) / 0.16;
  const roll = Math.max(-12, Math.min(12, yawRate * 0.1));
  camera.position.set(...s.p);
  camera.rotation.set(s.pitch * D2R, s.yaw * D2R, roll * D2R);
  const k = Math.min(1, Math.max(0, (t - 15.0) / 1.0));
  doorPivot.rotation.y = (1 - Math.cos(k * Math.PI)) * 0.5 * 1.75;
  brazierLight.intensity = 55 * (0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3));
  animateFx(t);
  finish.uniforms.seed.value = t * 13.37;
  composer.render();
  return renderer.domElement.toDataURL('image/webp', Number(q.get('q') || 0.82));
};
window.previzReady = true;
