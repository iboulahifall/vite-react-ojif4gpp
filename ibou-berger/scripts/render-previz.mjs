// Rend la prévisualisation grey-box en séquence WebP + manifeste.
// Usage : node scripts/render-previz.mjs [--fps 20] [--w 1280] [--only 0,140,899]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const FPS = Number(args.fps || 20);
const W = Number(args.w || 1280);
const DURATION = 45;
const OUT = path.resolve(args.out || 'public/flight/frames');
const only = args.only ? args.only.split(',').map(Number) : null;

const server = await createServer({ root: path.resolve('scripts/previz'), server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: Math.round(W * 9 / 16) } });
page.on('pageerror', (e) => console.error('pageerror', e));
await page.goto(`http://localhost:5199/index.html?w=${W}`);
await page.waitForFunction(() => window.previzReady === true, null, { timeout: 60000 });
await fs.mkdir(OUT, { recursive: true });

const count = Math.round(DURATION * FPS) + 1;
const frames = only || [...Array(count).keys()];
const t0 = Date.now();
for (const i of frames) {
  const url = await page.evaluate((t) => window.renderAt(t), i / FPS);
  await fs.writeFile(path.join(OUT, `frame-${String(i).padStart(4, '0')}.webp`), Buffer.from(url.split(',')[1], 'base64'));
  if (i % 100 === 0) console.log(`frame ${i}/${count - 1} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
if (!only) {
  const manifest = {
    source: 'previz-greybox',
    note: 'Prévisualisation volumétrique générée localement (Three.js). À remplacer par la séquence extraite du master Higgsfield.',
    version: new Date().toISOString().slice(0, 19).replace(/[-:T]/g, ''),
    fps: FPS, count, duration: DURATION, width: W, height: Math.round(W * 9 / 16),
    pattern: 'frames/frame-{index4}.webp',
    poster: 'frames/frame-0000.webp',
  };
  await fs.writeFile(path.join(path.dirname(OUT), 'manifest.json'), JSON.stringify(manifest, null, 2));
}
await browser.close();
await server.close();
console.log('done', frames.length, 'frames');
