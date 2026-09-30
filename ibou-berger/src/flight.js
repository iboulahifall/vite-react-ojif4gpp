// Moteur du vol : défilement natif → temps forts → image → canvas.
// Aucun détournement du défilement : on lit la position, on ne la modifie jamais.

export function buildTimeline(beats, fps, count) {
  let acc = 0;
  const segs = beats.map((b) => {
    const s = { ...b, start: acc, end: acc + b.vh };
    acc += b.vh;
    return s;
  });
  const last = count - 1;
  const toFrame = (sec) => Math.max(0, Math.min(last, Math.round(sec * fps)));
  return {
    totalVh: acc,
    segs,
    // position (en vh depuis le début du vol) → { frame, seg, local }
    at(vh) {
      const v = Math.max(0, Math.min(acc, vh));
      let seg = segs[segs.length - 1];
      for (const s of segs) if (v < s.end) { seg = s; break; }
      const local = seg.vh ? (v - seg.start) / seg.vh : 1;
      const sec = seg.from + (seg.to - seg.from) * local;
      return { frame: toFrame(sec), seg, local, vh: v };
    },
  };
}

// Opacité d'un chapitre selon la position dans la timeline.
// Le chapitre couvre l'union de ses temps forts ; fondu entrant / sortant
// de `fade` vh, sauf le premier (visible au repos) et le dernier (tenu à la fin).
export function chapterRanges(timeline, chapters) {
  return chapters.map((c, i) => {
    const own = timeline.segs.filter((s) => s.chapter === c.id);
    return {
      id: c.id,
      start: Math.min(...own.map((s) => s.start)),
      end: Math.max(...own.map((s) => s.end)),
      first: i === 0,
      last: i === chapters.length - 1,
    };
  });
}

export function chapterOpacity(r, vh, fade = 28) {
  if (vh < r.start || vh > r.end) return (r.last && vh > r.end) ? 1 : 0;
  const fin = r.first ? 1 : Math.min(1, (vh - r.start) / fade);
  const fout = r.last ? 1 : Math.min(1, (r.end - vh) / fade);
  return Math.max(0, Math.min(fin, fout));
}

// ── Chargeur d'images borné ────────────────────────────────────────────────
export class FrameStore {
  constructor({ urlFor, count, maxBitmaps = 90, concurrency = 6, retries = 2, onLoad }) {
    Object.assign(this, { urlFor, count, maxBitmaps, concurrency, retries, onLoad });
    this.bitmaps = new Map(); // index → ImageBitmap (ordre d'insertion = LRU)
    this.inflight = new Map(); // index → AbortController
    this.failed = new Map(); // index → tentatives
    this.queue = [];
    this.target = 0;
    this.dir = 1;
  }

  has(i) { return this.bitmaps.has(i); }

  get(i) {
    const b = this.bitmaps.get(i);
    if (b) { this.bitmaps.delete(i); this.bitmaps.set(i, b); } // rafraîchit le LRU
    return b;
  }

  // Image chargée la plus proche (pour afficher quelque chose pendant un saut).
  nearest(i) {
    if (this.bitmaps.has(i)) return { i, bmp: this.get(i) };
    for (let d = 1; d < 60; d++) {
      for (const j of this.dir > 0 ? [i - d, i + d] : [i + d, i - d]) {
        if (this.bitmaps.has(j)) return { i: j, bmp: this.bitmaps.get(j) };
      }
    }
    return null;
  }

  // Priorité : image demandée, puis voisines dans le sens du défilement.
  request(i, dir) {
    this.target = i;
    if (dir) this.dir = dir;
    const ahead = 28, behind = 8, want = [i];
    for (let d = 1; d <= ahead; d++) {
      want.push(i + d * this.dir);
      if (d <= behind) want.push(i - d * this.dir);
    }
    this.queue = want.filter((j) => j >= 0 && j < this.count && !this.bitmaps.has(j) && (this.failed.get(j) || 0) <= this.retries);
    // annule les requêtes devenues inutiles (saut rapide)
    const keep = new Set(this.queue.slice(0, this.concurrency * 3));
    for (const [j, ctl] of this.inflight) if (!keep.has(j) && Math.abs(j - i) > ahead) { ctl.abort(); this.inflight.delete(j); }
    this.pump();
  }

  pump() {
    while (this.inflight.size < this.concurrency && this.queue.length) {
      const j = this.queue.shift();
      if (this.inflight.has(j) || this.bitmaps.has(j)) continue;
      this.load(j);
    }
  }

  async load(j) {
    const ctl = new AbortController();
    this.inflight.set(j, ctl);
    try {
      const res = await fetch(this.urlFor(j), { signal: ctl.signal });
      if (!res.ok) throw new Error(res.status);
      const bmp = await createImageBitmap(await res.blob());
      if (ctl.signal.aborted) { bmp.close(); return; }
      this.bitmaps.set(j, bmp);
      this.failed.delete(j);
      this.evict();
      this.onLoad?.(j);
    } catch (e) {
      if (e.name !== 'AbortError') {
        const n = (this.failed.get(j) || 0) + 1;
        this.failed.set(j, n);
        if (n <= this.retries) setTimeout(() => { if (Math.abs(j - this.target) < 30) { this.queue.unshift(j); this.pump(); } }, 300 * 2 ** n);
      }
    } finally {
      if (this.inflight.get(j) === ctl) this.inflight.delete(j);
      this.pump();
    }
  }

  // Libère les bitmaps les plus éloignés de la cible au-delà du budget mémoire.
  evict() {
    if (this.bitmaps.size <= this.maxBitmaps) return;
    const far = [...this.bitmaps.keys()].sort((a, b) => Math.abs(b - this.target) - Math.abs(a - this.target));
    while (this.bitmaps.size > this.maxBitmaps) {
      const j = far.shift();
      this.bitmaps.get(j).close();
      this.bitmaps.delete(j);
    }
  }

  dispose() {
    for (const c of this.inflight.values()) c.abort();
    for (const b of this.bitmaps.values()) b.close();
    this.bitmaps.clear();
    this.inflight.clear();
  }
}

// Dessine en « cover » sur un canvas dimensionné à la densité de l'écran.
export function drawCover(ctx, bmp, cw, ch) {
  const s = Math.max(cw / bmp.width, ch / bmp.height);
  const w = bmp.width * s, h = bmp.height * s;
  ctx.drawImage(bmp, (cw - w) / 2, (ch - h) / 2, w, h);
}
