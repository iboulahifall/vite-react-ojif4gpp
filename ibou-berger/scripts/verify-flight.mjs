// Vérifie le vol dans un vrai navigateur : chaque temps fort atteint son image,
// les chapitres apparaissent au bon moment, la fin tient, pas de défilement horizontal.
// Usage : npm run build && npx vite preview --port 4173 & node scripts/verify-flight.mjs
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE = process.env.BASE || 'http://localhost:4173/';
const OUT = process.env.OUT || 'verify-shots';
// TEST_VIDEO=chemin.webm : sert ce fichier à la place de la vidéo d'entrée (le Chromium de test ne lit pas le H.264).
// Sans TEST_VIDEO, la vidéo est bloquée pour vérifier le repli sur les images.
const TEST_VIDEO = process.env.TEST_VIDEO;
const videoBytes = TEST_VIDEO ? await fs.readFile(TEST_VIDEO) : null;
async function routeVideo(page) {
  await page.route(/\.mp4(\?.*)?$/, async (route) => {
    if (!videoBytes) return route.abort();
    const range = route.request().headers().range;
    const total = videoBytes.length;
    if (range) {
      const [a, b] = range.replace('bytes=', '').split('-').map((n) => (n ? Number(n) : null));
      const start = a ?? 0, end = b ?? total - 1;
      return route.fulfill({ status: 206, headers: { 'Content-Type': 'video/webm', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(end - start + 1) }, body: videoBytes.subarray(start, end + 1) });
    }
    return route.fulfill({ status: 200, headers: { 'Content-Type': 'video/webm', 'Accept-Ranges': 'bytes' }, body: videoBytes });
  });
}
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failures++; };

for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(false, `[${vp.name}] erreur JS : ${e.message}`));
  await routeVideo(page);
  await page.goto(BASE + '?mode=motion', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__timeline && window.__flight);
  if (videoBytes) await page.waitForFunction(() => window.__flight.video !== null || false, null, { timeout: 15000 }).catch(() => {});
  const hasVideo = await page.evaluate(() => !!window.__flight.video || !!document.querySelector('.flight__video'));
  console.log(`[${vp.name}] vidéo d'entrée : ${videoBytes ? (hasVideo ? 'chargée' : 'NON chargée') : 'bloquée (test du repli)'}`);
  if (videoBytes) check(hasVideo, `[${vp.name}] la vidéo d'entrée se charge`);
  const tl = await page.evaluate(() => window.__timeline);
  const vh = await page.evaluate(() => document.querySelector('.flight__stage').clientHeight);
  const flightTop = await page.evaluate(() => document.getElementById('vol').offsetTop);
  console.log(`\n[${vp.name}] ${tl.segs.length} temps forts, ${tl.totalVh} vh de défilement actif, ${tl.count} images @ ${tl.fps} i/s`);

  // Au repos : chapitre 1 visible
  const rest = await page.evaluate(() => window.__flight);
  check(rest.chapter === 'arrivee' && rest.frame === 0, `[${vp.name}] au repos : image ${rest.frame}, chapitre ${rest.chapter}`);
  await page.screenshot({ path: `${OUT}/${vp.name}-00-repos.png` });

  let n = 1;
  for (const s of tl.segs) {
    for (const [label, at] of [['début', 0.02], ['milieu', 0.5], ['fin', 0.98]]) {
      const posVh = s.start + (s.end - s.start) * at;
      await page.evaluate((y) => window.scrollTo(0, y), flightTop + (posVh / 100) * vh);
      const useVideo = !!(videoBytes && s.video);
      if (useVideo) {
        const vt = Math.min(s.video[0] + (s.video[1] - s.video[0]) * at, 19.85);
        await page.waitForFunction(([v, t]) => window.__flight && Math.abs(window.__flight.vh - v) < 0.6 && window.__flight.video && Math.abs(window.__flight.video.current - t) < 0.08, [posVh, vt], { timeout: 8000 }).catch(() => {});
        const st = await page.evaluate(() => window.__flight);
        check(st.beat === s.id && st.video && st.video.opacity === 1 && Math.abs(st.video.current - vt) < 0.08,
          `[${vp.name}] ${s.id} ${label} : vidéo à ${st.video?.current?.toFixed(2)} s (attendu ${vt.toFixed(2)}), opacité ${st.video?.opacity}, chapitre ${st.chapter}`);
      } else {
        await page.waitForFunction((v) => window.__flight && Math.abs(window.__flight.vh - v) < 0.6 && window.__flight.drawn === window.__flight.frame, posVh, { timeout: 8000 }).catch(() => {});
        const st = await page.evaluate(() => window.__flight);
        const expected = Math.round((s.from + (s.to - s.from) * at) * tl.fps);
        check(st.beat === s.id && Math.abs(st.frame - expected) <= 1 && st.drawn === st.frame && (!st.video || st.video.opacity < 1),
          `[${vp.name}] ${s.id} ${label} : image ${st.frame} (attendu ${expected}), dessinée ${st.drawn}, vidéo ${st.video ? st.video.opacity.toFixed(2) : '—'}, chapitre ${st.chapter}`);
      }
      if (label === 'milieu') await page.screenshot({ path: `${OUT}/${vp.name}-${String(n++).padStart(2, '0')}-${s.id}.png` });
    }
  }
  // Fin du vol : dernier chapitre tenu
  await page.evaluate((y) => window.scrollTo(0, y), flightTop + (tl.totalVh / 100) * vh);
  await page.waitForFunction((v) => Math.abs(window.__flight.vh - v) < 0.6, tl.totalVh, { timeout: 8000 }).catch(() => {});
  const end = await page.evaluate(() => window.__flight);
  check(end.chapter === 'revelation' && end.frame === tl.count - 1, `[${vp.name}] fin : image ${end.frame}, chapitre ${end.chapter}`);
  // Retour arrière rapide
  await page.evaluate((y) => window.scrollTo(0, y), flightTop + 1.5 * vh);
  await page.waitForFunction(() => window.__flight.vh > 140 && window.__flight.vh < 160 && window.__flight.drawn === window.__flight.frame, null, { timeout: 8000 }).catch(() => {});
  const back = await page.evaluate(() => window.__flight);
  check(back.drawn === back.frame && back.frame > 0, `[${vp.name}] saut arrière : image ${back.frame} dessinée ${back.drawn}`);
  // Chapitres cachés : non focusables
  const focusables = await page.evaluate(() => [...document.querySelectorAll('.flight__chapters .chapter')].filter((c) => c.inert).length);
  check(focusables >= 4, `[${vp.name}] chapitres masqués inertes : ${focusables}`);
  // Pas de défilement horizontal
  const hscroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(hscroll <= 0, `[${vp.name}] débordement horizontal : ${hscroll}px`);
  // Sections après le vol
  for (const id of ['carte', 'experience', 'reserver', 'infos']) {
    await page.evaluate((i) => document.getElementById(i).scrollIntoView(), id);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${vp.name}-z-${id}.png` });
  }
  // Formulaire en mode démo : jamais « envoyé »
  await page.fill('#f-name', 'Test'); await page.fill('#f-contact', '770000000');
  await page.fill('#f-date', '2026-10-10'); await page.fill('#f-time', '20:00');
  await page.click('#resa-form button[type=submit]');
  const status = await page.textContent('#resa-status');
  check(/NON envoyée/.test(status), `[${vp.name}] formulaire démo : « ${status.slice(0, 60)}… »`);
  // Mode statique
  await page.goto(BASE + '?mode=static');
  const statics = await page.locator('.static-chapter').count();
  check(statics === 6, `[${vp.name}] mode statique : ${statics} chapitres`);
  await page.screenshot({ path: `${OUT}/${vp.name}-static.png` });
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} échec(s)` : '\nTout est conforme.');
process.exit(failures ? 1 : 0);
