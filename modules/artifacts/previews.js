// @ts-check

// Made things' previews (a picture, a text file's first lines): read through one queue, nearest the view first, a few at a time, and kept on this device.

import { previewOf } from "./model.js";

/** @param {{ world: any, api: any, sharedFileRoute: (thread: any, path: string) => any, box: () => HTMLElement | null, landed: () => void }} deps */
export function createPreviews({ world, api, sharedFileRoute, box: boxOf, landed: onLanded }) {
  /** @type {Map<string, string>} */
  const thumbs = new Map(); // key → object URL, or "" when it couldn't be read
  const PREV_CAP = 3, PREV_W = 640, PREV_CACHE = "xo-previews-1";
  const TEXTS = new Set(["doc", "code", "data", "page"]);
  /** @type {Map<string, any>} */
  const texts = new Map(); // key → previewOf(…), or null when it couldn't be read (or is on its way)
  /** @param {any} m */
  const wantsText = (m) => TEXTS.has(m.kind) && !texts.has(m.key) && m.exists !== false && !/\.(pdf|docx?|xlsx?|pptx?|zip|gz)$/i.test(m.name || m.path || "");
  /** @param {any} m @returns {{ project?: string, rel?: string, why?: string }} */
  const routeOf = (m) => (m.fileProject && m.rel ? { project: m.fileProject, rel: m.rel } : m.server ? {} : sharedFileRoute(world.thread(m.tid), m.path));
  /** @type {{ q: { key: string, run: () => Promise<void>, seq: number }[], n: number, seq: number, landed: number }} */
  const PQ = { q: [], n: 0, seq: 0, landed: 0 };
  /** @type {Map<string, { y: number }>} */
  const nearY = new Map(); // where a card is on the Artifacts page, from the observer's own entry (no layout read)
  /** @type {Set<string>} */
  const failed = new Set(); // keys whose preview couldn't be read: they keep their icon
  /** @param {{ key: string, seq: number }} job */
  function prio(job) {
    const w = nearY.get(job.key), box = boxOf();
    if (w && box && !box.hidden) return Math.abs(w.y - box.scrollTop - box.clientHeight / 3);
    return 1e6 + job.seq;
  }
  /** @param {string} key @param {() => Promise<void>} run */
  function enqueue(key, run) {
    PQ.q.push({ key, run, seq: PQ.seq++ });
    pump();
  }
  function pump() {
    while (PQ.n < PREV_CAP && PQ.q.length) {
      let bi = 0, bp = Infinity;
      for (let k = 0; k < PQ.q.length; k++) { const p = prio(PQ.q[k]); if (p < bp) { bp = p; bi = k; } }
      const job = PQ.q.splice(bi, 1)[0];
      PQ.n++;
      Promise.resolve().then(job.run).catch(() => { failed.add(job.key); landed(); }).finally(() => { PQ.n--; pump(); });
    }
  }
  /** What arrived is drawn once a frame, not once per arrival. */
  function landed() {
    if (PQ.landed) return;
    PQ.landed = requestAnimationFrame(() => { PQ.landed = 0; onLanded(); });
  }
  /** @param {any} m @param {string} kind */
  const cacheKey = (m, kind) => `/__xo-preview/${kind}/${encodeURIComponent(m.key)}/${m.at || 0}/${m.bytes ?? ""}`;
  const cacheOpen = () => (typeof caches !== "undefined" ? caches.open(PREV_CACHE).catch(() => null) : Promise.resolve(null));
  /** @param {any} m @param {string} kind */
  async function cached(m, kind) { const c = await cacheOpen(); const r = c && (await c.match(cacheKey(m, kind)).catch(() => null)); return r || null; }
  /** @param {any} m @param {string} kind @param {BodyInit} body @param {string} type */
  async function keep(m, kind, body, type) { const c = await cacheOpen(); if (c) await c.put(cacheKey(m, kind), new Response(body, { headers: { "content-type": type } })).catch(() => {}); }
  /** A picture made small for its card: PREV_W wide at most (a card shows it at about a third of that), WebP. @param {Blob} b @returns {Promise<Blob>} */
  async function small(b) {
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") return b;
    const bm = await createImageBitmap(b);
    if (bm.width <= PREV_W) { bm.close?.(); return b; }
    const h = Math.round((bm.height * PREV_W) / bm.width), c = new OffscreenCanvas(PREV_W, h);
    /** @type {OffscreenCanvasRenderingContext2D} */ (c.getContext("2d")).drawImage(bm, 0, 0, PREV_W, h); bm.close?.();
    return c.convertToBlob({ type: "image/webp", quality: 0.82 });
  }
  /** Text files show their first lines or words: each read once, through the queue and the device's copy. @param {any[]} items */
  function loadTexts(items) {
    for (const m of items) {
      if (!wantsText(m)) continue;
      const r = routeOf(m);
      texts.set(m.key, null);
      if (!r.project) continue;
      enqueue(m.key, async () => {
        const hit = await cached(m, "text");
        const p = hit ? await hit.json() : previewOf(m.name || m.path, String((await api.projectFile(r.project, r.rel))?.content || "").slice(0, 4096));
        if (!hit && p) keep(m, "text", JSON.stringify(p), "application/json");
        if (!p) throw new Error("nothing to show");
        texts.set(m.key, p); landed();
      });
    }
  }
  /** Image files show themselves: each read once, through its thread's folder (the queue, the device's copy). @param {any[]} items */
  function loadThumbs(items) {
    for (const m of items) {
      if (m.kind !== "image" || thumbs.has(m.key)) continue;
      const r = routeOf(m);
      if (m.exists === false || !r.project) { thumbs.set(m.key, ""); continue; }
      thumbs.set(m.key, "");
      enqueue(m.key, async () => {
        const hit = await cached(m, "pic");
        let b = hit ? await hit.blob() : null;
        if (!b) { b = await small(await api.projectImage(r.project, r.rel)).catch(() => null) || b; if (b) keep(m, "pic", b, b.type || "image/png"); }
        if (!b) throw new Error("no picture");
        thumbs.set(m.key, URL.createObjectURL(b)); landed();
      });
    }
  }

  /** A card on the page that will show the thing itself (a picture, a text file it can read). @param {any} m */
  const previewable = (m) => m.exists !== false && !!routeOf(m).project && (m.kind === "image" || (TEXTS.has(m.kind) && !/\.(pdf|docx?|xlsx?|pptx?|zip|gz)$/i.test(m.name || m.path || "")));

  return { thumbs, texts, failed, nearY, wantsText, previewable, loadTexts, loadThumbs };
}
