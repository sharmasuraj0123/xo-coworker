// @ts-check

import { api } from "../../platform/api.js";
import { fadeImage, EASE, MOVE, still } from "../../ui/motion.js";
import { labelOf } from "./items.js";
import { REG, markWebGone, webLinkHtml } from "./render.js";

/** @typedef {ReturnType<typeof import("./items.js").mediaItem>} MediaItem */

/** @typedef {HTMLImageElement & {_mx?: boolean, _mxSlow?: ReturnType<typeof setTimeout>, dataset: {mxImg: string}}} MediaImage */

/** @typedef {HTMLElement & {_mxGone?: boolean}} MediaBox */

/** @typedef {HTMLElement & {_mxDrag?: boolean}} MediaRoot */

/** @typedef {{url: string | null, p: Promise<string> | null}} ImageLoad */

const CACHE_MAX = 200;

/** @type {Map<string, ImageLoad>} */
const blobs = new Map();
/** @template K, V @param {Map<K, V>} map @param {K} key @param {V} val */
function touch(map, key, val) { map.delete(key); map.set(key, val); }
function evict() {
  while (blobs.size > CACHE_MAX) {
    const [k, e] = /** @type {[string, ImageLoad]} */ (blobs.entries().next().value);
    blobs.delete(k);
    if (e.url && !document.querySelector(`img[src="${CSS.escape(e.url)}"]`)) URL.revokeObjectURL(e.url);
  }
}
/** The URL a picture shows from right now, or null until it has been fetched. @param {MediaItem | undefined | null} it */
export function cachedSrc(it) {
  return it ? it.src || (/** @type {Partial<ImageLoad>} */ (blobs.get(it.key) || {})).url || null : null;
}
/** The URL a picture shows from: direct, or its project file fetched once into an object URL. @param {MediaItem | undefined | null} it */
export function loadSrc(it) {
  if (!it) return Promise.reject(new Error("No picture"));
  if (it.src) return Promise.resolve(it.src);
  let e = blobs.get(it.key);
  if (e) { touch(blobs, it.key, e); return /** @type {Promise<string>} */ (e.p); }
  e = { url: null, p: null };
  e.p = api.projectImage(/** @type {string} */ (it.project), /** @type {string} */ (it.rel)).then((b) => { e.url = URL.createObjectURL(b); return e.url; }, (err) => { blobs.delete(it.key); throw err; });
  blobs.set(it.key, e);
  evict();
  return /** @type {Promise<string>} */ (e.p);
}

/** @type {Map<string, MediaImage>} */
const shown = new Map(); // key → the last decoded <img>
const SLOW_MS = 3000;

/** @type {Map<Element | null, IntersectionObserver>} */
const watchers = new Map();
/** @param {HTMLElement} root */
function watcherFor(root) {
  if (typeof IntersectionObserver !== "function") return null;
  const sc = root.closest(".scroller") || null;
  let io = watchers.get(sc);
  if (!io) {
    io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) { /** @type {IntersectionObserver} */ (io).unobserve(e.target); start(/** @type {MediaImage} */ (e.target)); }
    }, { root: sc, rootMargin: "800px 0px" });
    watchers.set(sc, io);
  }
  return io;
}

/** @param {Element | null} box @param {string | null} cls @param {string} [text] */
function stateOf(box, cls, text) {
  if (!box) return;
  box.classList.remove("is-slow", "is-err");
  if (cls) box.classList.add(cls);
  const s = box.querySelector(":scope > .mx-state");
  if (s) s.textContent = text || "";
}
/** @param {MediaImage} img @param {HTMLElement | null} box @param {string} key */
function landed(img, box, key) {
  clearTimeout(img._mxSlow);
  stateOf(box, null);
  box && box.classList.add("is-in");
  if (box && box.classList.contains("mx-one") && box.classList.contains("is-frame")) settle(img, box);
  touch(shown, key, img);
  while (shown.size > CACHE_MAX) shown.delete(/** @type {string} */ (shown.keys().next().value));
}
/** @param {MediaImage} img @param {HTMLElement} box */
function settle(img, box) {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return;
  const sc = box.closest(".scroller, .home, .arts");
  const view = sc ? sc.getBoundingClientRect().top : 0;
  const r = box.getBoundingClientRect();
  if (r.bottom <= view) return;
  const mw = parseFloat(getComputedStyle(box).getPropertyValue("--mx-w")) || r.width;
  const cap = mw > 320 ? Math.round((mw * 480) / 560) : mw;
  const h1 = Math.min(cap, Math.round((r.width * nh) / nw));
  const ratio = h1 < Math.round((r.width * nh) / nw) ? `${Math.round(r.width)} / ${h1}` : `${nw} / ${nh}`;
  box.classList.remove("is-frame");
  if (Math.abs(h1 - r.height) < 2 || still()) { box.style.aspectRatio = ratio; return; }
  box.style.height = `${r.height}px`; box.style.aspectRatio = "auto";
  void box.offsetHeight;
  box.style.transition = `height ${MOVE}ms ${EASE}, background-color var(--d-in) var(--ease)`;
  box.style.height = `${h1}px`;
  const done = () => { box.style.transition = ""; box.style.height = ""; box.style.aspectRatio = ratio; };
  box.addEventListener("transitionend", (e) => { if (e.propertyName === "height") done(); }, { once: true });
  setTimeout(done, MOVE + 80);
}
/** @param {MediaImage} img @param {HTMLElement | null} box @param {MediaItem} [it] */
function failed(img, box, it) {
  clearTimeout(img._mxSlow);
  img.style.opacity = "0";
  if (it && it.web) { webFailed(box, it); return; }
  stateOf(box, "is-err", `Couldn't load ${it ? labelOf(it) : "this picture"} · Retry`);
}
/** @param {MediaBox | null} box @param {MediaItem} it */
function webFailed(box, it) {
  markWebGone(/** @type {NonNullable<MediaItem["web"]>} */ (it.web).url);
  const stack = box && /** @type {HTMLElement | null} */ (box.closest(".mx-stack"));
  if (!stack || /** @type {MediaBox} */ (box)._mxGone) return;
  /** @type {MediaBox} */ (box)._mxGone = true;
  try {
    const ks = JSON.parse(stack.dataset.mxKeys || "[]").filter((/** @type {string} */ k) => k !== it.key);
    if (ks.length) stack.dataset.mxKeys = JSON.stringify(ks); else delete stack.dataset.mxKeys;
  } catch { /* not ours */ }
  let line = stack.querySelector(":scope > .mx-weblinks");
  const fresh = !line;
  if (fresh) { line = document.createElement("p"); line.className = "mx-weblinks"; }
  /** @type {Element} */ (line).insertAdjacentHTML("beforeend", webLinkHtml(it));
  const album = /** @type {MediaBox} */ (box).closest(".mx-album");
  if (!album) { if (fresh) /** @type {MediaBox} */ (box).replaceWith(/** @type {Element} */ (line)); else /** @type {MediaBox} */ (box).remove(); return; }
  const row = /** @type {MediaBox} */ (box).closest(".mx-row");
  /** @type {MediaBox} */ (box).remove();
  if (row && !row.querySelector(".mx-tile")) row.remove();
  if (!album.querySelector(".mx-tile")) { if (fresh) album.replaceWith(/** @type {Element} */ (line)); else album.remove(); }
  else if (fresh) album.after(/** @type {Element} */ (line));
}

if (typeof document !== "undefined") {
  document.addEventListener("error", (e) => {
    const img = /** @type {MediaImage | null} */ (e.target);
    if (!img || !img.matches || !img.matches("img[data-mx-web]")) return;
    const it = REG.get(img.dataset.mxImg);
    if (it) failed(img, /** @type {MediaBox | null} */ (img.closest(".mx-one,.mx-tile")), it);
  }, true);
}

export const PICTURE_FACE = ".mx-one, .mx-tile, button.att-ic.is-img";
/** @type {Map<string, string>} */
const TONE = new Map();
/** @param {Partial<HTMLImageElement>} img */
export function pictureTone(img) {
  const k = img.currentSrc || img.src;
  if (!k || !img.complete || !img.naturalWidth) return "";
  if (TONE.has(k)) return /** @type {string} */ (TONE.get(k));
  let t = "";
  try {
    const c = document.createElement("canvas"); c.width = c.height = 8;
    const g = /** @type {CanvasRenderingContext2D} */ (c.getContext("2d", { willReadFrequently: true })); g.drawImage(/** @type {HTMLImageElement} */ (img), 0, 0, 8, 8);

    const d = g.getImageData(0, 0, 8, 8).data; let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 16) continue; sum += d[i] + d[i + 1] + d[i + 2]; n++; }
    if (n) t = sum / n < 382.5 ? "dark" : "light";
  } catch { /* a picture from elsewhere taints the canvas: the ink's veil */ }
  TONE.set(k, t); return t;
}
if (typeof document !== "undefined") {
  document.addEventListener("pointerover", (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const face = target && target.closest && /** @type {HTMLElement | null} */ (target.closest(PICTURE_FACE));
    if (!face) return;
    const t = pictureTone(face.querySelector("img") || {});
    if (t) { if (face.dataset.tone !== t) face.dataset.tone = t; } else if (face.dataset.tone) delete face.dataset.tone;
  }, true);
}
/** Show an <img> once it has decoded (motion.js fadeImage); one already decoded (cached) shows at once. @param {MediaImage} img @param {HTMLElement | null} box @param {MediaItem} [it] */
function watch(img, box, it) {
  const key = img.dataset.mxImg;
  if (img.complete && img.naturalWidth) { landed(img, box, key); return; }
  fadeImage(img);
  img.addEventListener("load", () => landed(img, box, key), { once: true });
  img.addEventListener("error", () => failed(img, box, it), { once: true });
}
/** A picture near the screen starts loading; one that takes over 3 s says so (never a spinner). @param {MediaImage} img */
function start(img) {
  const box = /** @type {MediaBox | null} */ (img.closest(".mx-one,.mx-tile"));
  const it = REG.get(img.dataset.mxImg);
  if (img.complete && img.naturalWidth) return;
  img._mxSlow = setTimeout(() => { if (!(img.complete && img.naturalWidth) && !/** @type {MediaBox} */ (box).classList.contains("is-err")) stateOf(box, "is-slow", "Loading…"); }, SLOW_MS);
  if (img.getAttribute("src")) return;
  loadSrc(it).then((u) => { img.src = u; watch(img, box, it); }, () => failed(img, box, it));
}

/** @param {HTMLElement | null | undefined} root */
export function hydrateMedia(root) {
  if (!root || typeof document === "undefined") return;
  const io = watcherFor(root);
  for (const img of /** @type {NodeListOf<MediaImage>} */ (root.querySelectorAll("img.mx-img"))) {
    if (img._mx) continue;
    img._mx = true;
    const key = img.dataset.mxImg;
    const it = REG.get(key);
    const box = /** @type {MediaBox | null} */ (img.closest(".mx-one,.mx-tile"));
    const old = shown.get(key);
    const same = old && !old.isConnected && old.complete && old.naturalWidth && (!img.getAttribute("src") || old.src === img.src);
    if (same) { old.className = img.className; img.replaceWith(old); box && box.classList.add("is-in"); continue; }
    const u = cachedSrc(it);
    if (u && !img.getAttribute("src")) img.src = u;
    if (img.getAttribute("src")) watch(img, box, it);
    else img.style.opacity = "0";
    if (io) io.observe(img); else start(img);
  }
}

/** A picture that couldn't load: try again (a press on it says Retry). True when it was one. @param {Element | null | undefined} el */
export function retryMedia(el) {
  const box = el && /** @type {MediaBox | null} */ (el.closest(".mx-one,.mx-tile"));
  if (!box || !box.classList.contains("is-err")) return false;
  const img = /** @type {MediaImage} */ (box.querySelector("img.mx-img"));
  const it = REG.get(img.dataset.mxImg);
  stateOf(box, null);
  if (it && !it.src) blobs.delete(it.key);
  img.removeAttribute("src"); img.style.opacity = "0";
  if (it && it.src) { img.src = it.src + (it.src.includes("?") ? "&" : "?") + "r=" + Date.now(); watch(img, box, it); }
  else start(img);
  return true;
}

/** Every picture under `root`, in the order they're drawn, the ones behind "+N" too (the lightbox's list). @param {ParentNode | null | undefined} root */
export function galleryOf(root) {
  /** @type {string[]} */
  const keys = [];
  for (const el of root ? /** @type {NodeListOf<HTMLElement & {dataset: {mxKeys: string}}>} */ (root.querySelectorAll("[data-mx-keys]")) : []) {
    /** @type {string[]} */
    let ks = [];
    try { ks = JSON.parse(el.dataset.mxKeys); } catch { /* not ours */ }
    for (const k of ks) if (!keys.includes(k)) keys.push(k);
  }
  return keys.map((k) => REG.get(k)).filter(Boolean);
}

/** Where a picture sits on screen (its tile or frame), or null when it's behind "+N" or gone. @param {ParentNode | null | undefined} root @param {string} key */
export function slotOf(root, key) {
  return root ? root.querySelector(`[data-mx="${CSS.escape(key)}"]`) : null;
}

/** @param {MediaRoot | null | undefined} root */
export function wireDragOut(root) {
  if (!root || root._mxDrag) return;
  root._mxDrag = true;
  root.addEventListener("dragstart", (e) => {
    const target = /** @type {Element} */ (e.target);
    const img = target.closest && /** @type {MediaImage | null} */ (target.closest("img.mx-img"));
    const it = img && REG.get(img.dataset.mxImg);
    if (!it || !/** @type {MediaImage} */ (img).src || !e.dataTransfer) return;
    try { e.dataTransfer.setData("DownloadURL", `${it.type || "image/png"}:${it.name}:${new URL(/** @type {MediaImage} */ (img).src, location.href).href}`); } catch { /* not supported */ }
  });
}
