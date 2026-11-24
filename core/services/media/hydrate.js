// @ts-check

import { createScope } from "../../kernel/scope.js";
import { createLru } from "../../platform/cache.js";
import { EASE, MOVE, still } from "../../ui/motion.js";
import { labelOf } from "./items.js";
import { MEDIA_CACHE_MAX, markWebGone } from "./cache.js";
import { mediaItemOf, stackItems, setStackItems } from "./stack-data.js";
import { webLinkHtml } from "./render.js";
import { cachedSrc, forgetSrc } from "./images.js";
import { loadPicture } from "./picture-load.js";

/** @typedef {ReturnType<typeof import("./items.js").mediaItem>} MediaItem */

/** @typedef {HTMLImageElement & {_mx?: boolean, dataset: {mxImg: string}}} MediaImage */

/** @typedef {HTMLElement & {_mxGone?: boolean}} MediaBox */

/** @typedef {HTMLElement & {_mxDrag?: boolean}} MediaRoot */

/** @type {ReturnType<typeof createLru<string, MediaImage>>} */
const shown = createLru({ max: MEDIA_CACHE_MAX });

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
  stateOf(box, null);
  box && box.classList.add("is-in");
  if (box && box.classList.contains("mx-one") && box.classList.contains("is-frame")) settle(img, box);
  shown.set(key, img);
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
/** @param {MediaImage} img @param {HTMLElement | null} box @param {MediaItem | null} [it] */
function failed(img, box, it) {
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
  setStackItems(stack, stackItems(stack).filter((item) => item.key !== it.key));
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

const page = createScope();
if (typeof document !== "undefined") {
  page.listen(document, "error", (e) => {
    const img = /** @type {MediaImage | null} */ (e.target);
    if (!img || !img.matches || !img.matches("img[data-mx-web]")) return;
    const it = mediaItemOf(img.dataset.mxImg, img);
    if (it) failed(img, /** @type {MediaBox | null} */ (img.closest(".mx-one,.mx-tile")), it);
  }, true);
}

export const PICTURE_FACE = ".mx-one, .mx-tile, button.att-ic.is-img";
/** @type {ReturnType<typeof createLru<string, string>>} */
const tones = createLru({ max: MEDIA_CACHE_MAX });
/** @param {Partial<HTMLImageElement>} img */
export function pictureTone(img) {
  const k = img.currentSrc || img.src;
  if (!k || !img.complete || !img.naturalWidth) return "";
  const tone = tones.get(k);
  if (tone !== undefined) return tone;
  let t = "";
  try {
    const c = document.createElement("canvas"); c.width = c.height = 8;
    const g = /** @type {CanvasRenderingContext2D} */ (c.getContext("2d", { willReadFrequently: true })); g.drawImage(/** @type {HTMLImageElement} */ (img), 0, 0, 8, 8);

    const d = g.getImageData(0, 0, 8, 8).data; let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 16) continue; sum += d[i] + d[i + 1] + d[i + 2]; n++; }
    if (n) t = sum / n < 382.5 ? "dark" : "light";
  } catch (err) {
    if (!(err instanceof DOMException) || err.name !== "SecurityError") throw err;
  }
  tones.set(k, t);
  return t;
}
if (typeof document !== "undefined") {
  page.listen(document, "pointerover", (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const face = target && target.closest && /** @type {HTMLElement | null} */ (target.closest(PICTURE_FACE));
    if (!face) return;
    const t = pictureTone(face.querySelector("img") || {});
    if (t) { if (face.dataset.tone !== t) face.dataset.tone = t; } else if (face.dataset.tone) delete face.dataset.tone;
  }, true);
}
/** @param {MediaImage} img @param {HTMLElement | null} box @param {MediaItem | null} item @param {boolean} near */
function prepare(img, box, item, near) {
  loadPicture(img, item, {
    near,
    ready: () => landed(img, box, img.dataset.mxImg),
    failed: () => failed(img, box, item),
    slow: () => stateOf(box, "is-slow", "Loading…"),
    removed: () => { img._mx = false; },
  });
}

/** @param {HTMLElement | null | undefined} root */
export function hydrateMedia(root) {
  if (!root || typeof document === "undefined") return;
  for (const img of /** @type {NodeListOf<MediaImage>} */ (root.querySelectorAll("img.mx-img"))) {
    if (img._mx) continue;
    img._mx = true;
    const key = img.dataset.mxImg;
    const it = mediaItemOf(key, img);
    const box = /** @type {MediaBox | null} */ (img.closest(".mx-one,.mx-tile"));
    const old = shown.get(key), u = cachedSrc(it);
    const same = old && !old.isConnected && old.complete && old.naturalWidth && (img.getAttribute("src") || u) === old.getAttribute("src");
    if (same) { old.className = img.className; img.replaceWith(old); box && box.classList.add("is-in"); continue; }
    if (u && !img.getAttribute("src")) img.src = u;
    prepare(img, box, it, true);
  }
}

/** A picture that couldn't load: try again (a press on it says Retry). True when it was one. @param {Element | null | undefined} el */
export function retryMedia(el) {
  const box = el && /** @type {MediaBox | null} */ (el.closest(".mx-one,.mx-tile"));
  if (!box || !box.classList.contains("is-err")) return false;
  const img = /** @type {MediaImage} */ (box.querySelector("img.mx-img"));
  const it = mediaItemOf(img.dataset.mxImg, img);
  stateOf(box, null);
  img.removeAttribute("src"); img.style.opacity = "0";
  if (it && !it.src) forgetSrc(it);
  if (it?.src) img.src = it.src + (it.src.includes("?") ? "&" : "?") + "r=" + Date.now();
  prepare(img, box, it, false);
  return true;
}

/** Every picture under `root`, in the order they're drawn, the ones behind "+N" too (the lightbox's list). @param {ParentNode | null | undefined} root */
export function galleryOf(root) {
  /** @type {Map<string, MediaItem>} */
  const items = new Map();
  for (const stack of root?.querySelectorAll("[data-mx-items]") || []) {
    for (const it of stackItems(stack)) {
      if (it.kind === "image" && !items.has(it.key)) items.set(it.key, it);
    }
  }
  return [...items.values()];
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
    const it = img && mediaItemOf(img.dataset.mxImg, img);
    if (!it || !/** @type {MediaImage} */ (img).src || !e.dataTransfer) return;
    try { e.dataTransfer.setData("DownloadURL", `${it.type || "image/png"}:${it.name}:${new URL(/** @type {MediaImage} */ (img).src, location.href).href}`); } catch { /* not supported */ }
  });
}
