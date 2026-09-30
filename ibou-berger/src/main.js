import './styles.css';
import markSvg from '../brand/mark.svg?raw';
import { site, media, chapters, beats, menu, experience, info, reservation } from './content.js';
import { buildTimeline, chapterRanges, chapterOpacity, FrameStore, drawCover } from './flight.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const btn = (c) => `<a class="btn ${c.primary ? 'btn--primary' : 'btn--ghost'}" href="${esc(c.href)}">${esc(c.label)}</a>`;

// ── Navigation ──────────────────────────────────────────────────────────────
$('#nav').innerHTML = `
  <a class="brand" href="#vol" aria-label="${esc(site.name)} — début de page">${markSvg}<span class="brand__name">${esc(site.name)}</span></a>
  <nav aria-label="Navigation principale"><ul class="nav__links">${site.nav.map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul></nav>
  ${btn({ ...site.primaryCta, primary: true })}`;
$('#nav .brand svg').setAttribute('aria-hidden', 'true');

// Image Higgsfield + image de la séquence en dessous (repli si le CDN ne répond pas).
const frameUrl = (i) => `/flight/frames/frame-${String(i).padStart(4, '0')}.webp`;
const bg = (still, frame) => `background-image:url('${media.stills[still]}'), url('${frameUrl(frame)}')`;

// ── Sections de contenu ────────────────────────────────────────────────────
$('#carte').innerHTML = `<div class="wrap">
  <div class="section__head"><div><p class="kicker">La carte</p><h2 class="h2" id="carte-title">Cuisiné <em>au feu</em>, servi à table.</h2></div>
  <p>Une carte courte qui suit le marché et la saison. Les plats changent, la braise reste.</p></div>
  <div class="menu">${menu.sections.map((s) => `<div class="menu__col"><h3>${esc(s.title)}</h3>
    ${s.items.map((i) => `<div class="menu__item"><strong>${esc(i.name)}</strong><em>${esc(i.price)}</em><span>${esc(i.desc)}</span></div>`).join('')}</div>`).join('')}</div>
  <p class="menu__note">${esc(menu.note)}</p></div>`;

$('#experience').innerHTML = `<div class="wrap">
  <div class="section__head"><div><p class="kicker">L'expérience</p><h2 class="h2" id="exp-title">Trois façons de <em>passer la soirée</em>.</h2></div>
  <p>Du comptoir au jardin, chaque espace a son rythme.</p></div>
  <div class="cards">${experience.map((e) => `<article class="card"><div class="card__media" role="img" aria-label="${esc(e.title)}" style="${bg(e.still, e.frame)}"></div>
    <div class="card__body"><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></div></article>`).join('')}</div></div>`;

$('#reserver').innerHTML = `<div class="wrap resa">
  <div><p class="kicker">Réservation</p><h2 class="h2" id="resa-title">Réserver <em>une table</em>.</h2>
  <p style="color:var(--muted-light);max-width:30em">Indiquez la date, l'heure et le nombre de convives. ${reservation.endpoint ? 'Nous vous confirmons la réservation par téléphone ou par email.' : ''}</p></div>
  <form class="form" id="resa-form" novalidate>
    ${reservation.endpoint ? '' : `<p class="form__notice" role="note">${esc(reservation.demoNotice)}</p>`}
    <div class="field"><label for="f-name">Nom</label><input id="f-name" name="name" autocomplete="name" required /></div>
    <div class="field"><label for="f-contact">Téléphone ou email</label><input id="f-contact" name="contact" autocomplete="tel" required /></div>
    <div class="field"><label for="f-date">Date</label><input id="f-date" name="date" type="date" required /></div>
    <div class="field"><label for="f-time">Heure</label><input id="f-time" name="time" type="time" required /></div>
    <div class="field"><label for="f-guests">Convives</label><select id="f-guests" name="guests">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}<option value="9+">9 et plus</option></select></div>
    <div class="field field--full"><label for="f-note">Précisions (optionnel)</label><textarea id="f-note" name="note"></textarea></div>
    <div class="field--full"><button class="btn btn--primary" type="submit">${reservation.endpoint ? 'Envoyer la demande' : 'Tester le formulaire (démo)'}</button></div>
    <p class="form__status" id="resa-status" role="status" aria-live="polite"></p>
  </form></div>`;

$('#infos').innerHTML = `<div class="wrap">
  <div class="section__head"><div><p class="kicker">Infos pratiques</p><h2 class="h2" id="infos-title">Nous <em>trouver</em>.</h2></div><p>Informations à confirmer par le restaurant avant la mise en ligne.</p></div>
  <div class="infos">
    <div><h3>Adresse</h3><p>${esc(info.address)}</p>${info.mapsUrl ? `<p style="margin-top:1rem"><a class="link" href="${esc(info.mapsUrl)}">Itinéraire</a></p>` : ''}</div>
    <div><h3>Horaires</h3><dl>${info.hours.map(([d, h]) => `<dt>${esc(d)}</dt><dd>${esc(h)}</dd>`).join('')}</dl></div>
    <div><h3>Contact</h3><p>${esc(info.phone)}<br />${esc(info.email)}</p><p style="margin-top:1.5rem"><a class="btn btn--primary" href="#reserver">Réserver</a></p></div>
  </div></div>`;

$('#footer').innerHTML = `<span>© ${new Date().getFullYear()} ${esc(site.name)} — ${esc(site.tagline)}</span>
  ${site.demo ? '<span>Maquette : les informations entre [crochets] sont à remplacer par celles du restaurant.</span>' : ''}
  <span><a class="link" href="/style-tile.html">Planche de style</a></span>`;

// ── Formulaire : jamais de faux « envoyé » ──────────────────────────────────
$('#resa-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget, status = $('#resa-status');
  if (!form.checkValidity()) { status.textContent = 'Merci de remplir le nom, le contact, la date et l’heure.'; form.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  if (!reservation.endpoint) {
    status.textContent = `Démo : demande NON envoyée — ${data.guests} convive(s) le ${data.date} à ${data.time}. Branchez un service d’envoi dans content.js pour activer la réservation.`;
    return;
  }
  status.textContent = 'Envoi en cours…';
  try {
    const res = await fetch(reservation.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) throw new Error(res.status);
    status.textContent = 'Demande envoyée. Le restaurant vous recontactera pour confirmer.';
    form.reset();
  } catch {
    status.textContent = 'L’envoi a échoué. Réessayez ou appelez le restaurant.';
  }
});

// ── Ton de la navigation selon la section sous l'en-tête ────────────────────
const nav = $('#nav');
const lightSections = [...document.querySelectorAll('.section--light')];
const toneObserver = new IntersectionObserver(() => {
  const y = nav.offsetHeight / 2;
  const onLight = lightSections.some((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
  nav.dataset.tone = onLight ? 'light' : 'dark';
}, { threshold: [0, 0.01, 0.99, 1], rootMargin: '0px 0px -90% 0px' });
lightSections.forEach((s) => toneObserver.observe(s));
addEventListener('scroll', () => toneObserver.takeRecords(), { passive: true });

// ── Chapitres (HTML sémantique, séparé du rendu) ────────────────────────────
const chapterHtml = (c) => `<p class="kicker">${esc(c.kicker)}</p>
  <h2 class="chapter__title">${esc(c.title)}</h2>
  <p class="chapter__body">${esc(c.body)}</p>
  ${c.ctas.length ? `<div class="chapter__ctas">${c.ctas.map(btn).join('')}</div>` : ''}`;

const flight = $('#vol');
const stage = $('.flight__stage');

function renderStatic() {
  flight.classList.add('flight--static');
  flight.style.height = '';
  $('.static-chapters').innerHTML = chapters.map((c) =>
    `<section class="static-chapter" style="${bg(c.still, c.frame)}"><article class="chapter">${chapterHtml(c)}</article></section>`).join('');
}

const params = new URLSearchParams(location.search);
const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
const conn = navigator.connection;
const constrained = conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '') || (navigator.deviceMemory && navigator.deviceMemory <= 2);
const wantStatic = params.get('mode') === 'static' || (params.get('mode') !== 'motion' && (reduceMq.matches || constrained));

if (wantStatic) renderStatic();
else initFlight().catch((err) => { console.warn('Vol indisponible, repli statique', err); renderStatic(); });

reduceMq.addEventListener?.('change', (e) => { if (e.matches && !flight.classList.contains('flight--static')) location.reload(); });

async function initFlight() {
  const manifestUrl = new URL(media.manifest, location.href);
  const manifest = await (await fetch(manifestUrl)).json();
  const timeline = buildTimeline(beats, manifest.fps, manifest.count);
  const ranges = chapterRanges(timeline, chapters);
  const pad = (i) => String(i).padStart(4, '0');
  const urlFor = (i) => new URL(manifest.pattern.replace('{index4}', pad(i)), manifestUrl).href + `?v=${manifest.version}`;
  $('.flight__poster').src = new URL(manifest.poster, manifestUrl).href + `?v=${manifest.version}`;

  if (String(manifest.source).startsWith('previz')) {
    const badge = $('.flight__badge');
    badge.hidden = false;
    badge.textContent = site.demo ? 'Maquette · prévisualisation du vol' : 'Prévisualisation du vol';
  }

  // Chapitres superposés
  const layer = $('.flight__chapters');
  const els = chapters.map((c) => {
    const a = document.createElement('article');
    a.className = 'chapter';
    a.dataset.align = c.align;
    a.innerHTML = chapterHtml(c);
    layer.append(a);
    return a;
  });

  // Barre de progression par chapitre
  const progress = $('.flight__progress');
  const vhPx = () => stage.clientHeight;
  chapters.forEach((c, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" aria-label="Aller au chapitre : ${esc(c.kicker)}"></button>`;
    li.firstChild.addEventListener('click', () => {
      const r = ranges[i];
      const mid = r.first ? 0 : r.last ? timeline.totalVh : (r.start + r.end) / 2;
      scrollTo({ top: flight.offsetTop + (mid / 100) * vhPx(), behavior: reduceMq.matches ? 'auto' : 'smooth' });
    });
    progress.append(li);
  });
  const dots = [...progress.querySelectorAll('button')];

  const canvas = $('.flight__canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const poster = $('.flight__poster');
  let drawn = -1, target = 0, lastFrame = 0, dir = 1, raf = 0;

  const store = new FrameStore({
    urlFor, count: manifest.count,
    maxBitmaps: innerWidth < 720 ? 60 : 110,
    onLoad: (j) => { if (drawn !== target && Math.abs(j - target) <= Math.abs(drawn - target)) schedule(); },
  });

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(stage.clientWidth * dpr);
    canvas.height = Math.round(stage.clientHeight * dpr);
    flight.style.height = `${(timeline.totalVh / 100) * vhPx() + vhPx()}px`;
    drawn = -1;
  }

  function draw() {
    const hit = store.nearest(target);
    if (!hit || hit.i === drawn) return;
    drawCover(ctx, hit.bmp, canvas.width, canvas.height);
    drawn = hit.i;
    if (!poster.classList.contains('is-hidden')) poster.classList.add('is-hidden');
  }

  function update() {
    raf = 0;
    const pos = (-flight.getBoundingClientRect().top / vhPx()) * 100;
    const st = timeline.at(pos);
    target = st.frame;
    if (target !== lastFrame) dir = target > lastFrame ? 1 : -1;
    lastFrame = target;
    store.request(target, dir);
    draw();
    let best = 0, bestO = -1;
    els.forEach((el, i) => {
      const o = chapterOpacity(ranges[i], st.vh);
      el.style.opacity = o.toFixed(3);
      el.style.translate = `0 ${((1 - o) * 18).toFixed(1)}px`;
      const hidden = o < 0.02;
      if (el.inert !== hidden) { el.inert = hidden; el.toggleAttribute('hidden-state', hidden); el.setAttribute('aria-hidden', String(hidden)); }
      if (o > bestO) { bestO = o; best = i; }
    });
    flight.dataset.alignShade = chapters[best].align;
    dots.forEach((d, i) => d.setAttribute('aria-current', String(i === best && bestO > 0.02)));
    window.__flight = { frame: target, drawn, vh: st.vh, beat: st.seg.id, chapter: bestO > 0.02 ? chapters[best].id : null };
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { update(); }); };

  // La scène mesure 100svh : la barre d'adresse mobile ne change pas sa hauteur,
  // on ne recalcule que si la taille de la scène change réellement.
  let lastSize = '';
  addEventListener('resize', () => {
    const s = `${stage.clientWidth}x${stage.clientHeight}`;
    if (s !== lastSize) { lastSize = s; size(); schedule(); }
  });
  addEventListener('scroll', schedule, { passive: true });
  size();
  update();
  window.__timeline = { totalVh: timeline.totalVh, segs: timeline.segs.map(({ id, start, end, from, to }) => ({ id, start, end, from, to })), fps: manifest.fps, count: manifest.count };
}
