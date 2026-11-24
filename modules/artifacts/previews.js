// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { previewOf } from "./model.js";
import { createPreviewQueue } from "./preview-queue.js";

/** @param {import("./preview-types.d.ts").PreviewDeps} deps */
export function createPreviews({ world, api, sharedFileRoute, box: boxOf, landed: onLanded, scope = createScope() }) {
  /** @type {Map<string, string>} */
  const thumbs = new Map(); // key → object URL, or "" when it couldn't be read
  const PREV_W = 640, PREV_CACHE = "xo-previews-1", { signal } = scope;
  const TEXTS = new Set(["doc", "code", "data", "page"]);
  /** @type {Map<string, ReturnType<typeof previewOf>>} */
  const texts = new Map(); // key → previewOf(…), or null when it couldn't be read (or is on its way)
  /** @param {import("./types.d.ts").Made} m */
  const wantsText = (m) => TEXTS.has(m.kind) && !texts.has(m.key) && m.exists !== false && !/\.(pdf|docx?|xlsx?|pptx?|zip|gz)$/i.test(m.name || m.path || "");
  /** @param {import("./types.d.ts").Made} m @returns {{ project?: string, rel?: string, why?: string }} */
  const routeOf = (m) => (m.fileProject && m.rel ? { project: m.fileProject, rel: m.rel } : m.server ? {} : sharedFileRoute(world.thread(m.tid), m.path));
  scope.effect(() => () => { for (const url of thumbs.values()) if (url) URL.revokeObjectURL(url); thumbs.clear(); });
  /** @type {Map<string, { y: number }>} */
  const nearY = new Map(); // where a card is on the Artifacts page, from the observer's own entry (no layout read)
  /** @type {Set<string>} */
  const failed = new Set(); // keys whose preview couldn't be read: they keep their icon
  const enqueue = createPreviewQueue(scope, (key) => {
    const w = nearY.get(key), box = boxOf();
    return w && box && !box.hidden ? Math.abs(w.y - box.scrollTop - box.clientHeight / 3) : null;
  }, (key) => { failed.add(key); landed(); });
  let queued = false;
  function landed() {
    if (signal.aborted || queued) return;
    queued = true;
    scope.frame(() => { queued = false; onLanded(); });
  }
  /** @param {import("./types.d.ts").Made} m @param {string} kind */
  const cacheKey = (m, kind) => `/__xo-preview/${kind}/${encodeURIComponent(m.key)}/${m.at || 0}/${m.bytes ?? ""}`;
  const cacheOpen = () => (typeof caches !== "undefined" ? caches.open(PREV_CACHE).catch(() => null) : Promise.resolve(null));
  /** @param {import("./types.d.ts").Made} m @param {string} kind */
  async function cached(m, kind) { const c = await cacheOpen(); const r = c && (await c.match(cacheKey(m, kind)).catch(() => null)); return r || null; }
  /** @param {import("./types.d.ts").Made} m @param {string} kind @param {BodyInit} body @param {string} type */
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
  /** @param {import("./types.d.ts").Made[]} items */
  function loadTexts(items) {
    for (const m of items) {
      if (signal.aborted || !wantsText(m)) continue;
      const { project, rel } = routeOf(m);
      texts.set(m.key, null);
      if (!project || !rel) continue;
      enqueue(m.key, async () => {
        const hit = await cached(m, "text");
        const p = hit ? await hit.json() : previewOf(m.name || m.path, String((await api.projectFile(project, rel))?.content || "").slice(0, 4096));
        if (!hit && p) keep(m, "text", JSON.stringify(p), "application/json");
        if (signal.aborted) return;
        if (!p) { failed.add(m.key); landed(); return; }
        texts.set(m.key, p); landed();
      });
    }
  }
  /** @param {import("./types.d.ts").Made[]} items */
  function loadThumbs(items) {
    return Promise.all(items.map((m) => {
      if (signal.aborted || m.kind !== "image" || thumbs.has(m.key)) return;
      const { project, rel } = routeOf(m);
      if (m.exists === false || !project || !rel) { thumbs.set(m.key, ""); return; }
      thumbs.set(m.key, "");
      return enqueue(m.key, async () => {
        const hit = await cached(m, "pic");
        let b = hit ? await hit.blob() : null;
        if (!b) { b = await small(await api.projectImage(project, rel, { signal })); if (!signal.aborted) void keep(m, "pic", b, b.type || "image/png"); }
        if (signal.aborted) return;
        thumbs.set(m.key, URL.createObjectURL(b)); landed();
      });
    }));
  }

  /** @param {import("./types.d.ts").Made} m */
  const previewable = (m) => m.exists !== false && !!routeOf(m).project && (m.kind === "image" || (TEXTS.has(m.kind) && !/\.(pdf|docx?|xlsx?|pptx?|zip|gz)$/i.test(m.name || m.path || "")));

  return { thumbs, texts, failed, nearY, wantsText, previewable, loadTexts, loadThumbs };
}
