// @ts-check

// The lightbox: a picture grows from its spot over a scrim, ← → step through its gallery, Esc or a swipe sends it back; focus held inside.

import { clock } from "../platform/index.js";
import { ARROW_OUT } from "./markdown/inline.js";
import { ICON } from "./icons/names.js";
import { still, EASE } from "./motion.js";

/** @typedef {{ mediaItemOf: (key: string) => any, galleryOf: (root: any) => any[], slotOf: (root: any, key: string) => any, cachedSrc: (it: any) => string | null, loadSrc: (it: any) => Promise<string>, labelOf: (it: any) => string, midName: (name: string, max?: number) => string, midNameHtml: (name: string) => string, typeWord: (type: string, name: string) => string, fmtSize: (n: unknown) => string, attachmentUrl: (chat: string, id: string) => string, projectDownload: (project: string, rel: string) => Promise<Blob> }} Pictures */

// The flight back is a touch quicker than the flight out: --d-hover (200) and --d-in (280) met halfway.
const BACK_MS = 240;
// Swipes: down past 96 px or 0.6 px/ms closes; sideways past 20 % or 0.5 px/ms moves.
const DOWN_PX = 96, DOWN_V = 0.6, SIDE_PART = 0.2, SIDE_V = 0.5, LOCK_PX = 8, FADE_PX = 400;

const NEXT = ICON.right;
const PREV = ICON.back;
const FILES = ICON.folder;

/** A token's duration in ms, read from the page (so a change in tokens.css changes the motion too). @param {string} name @param {number} fallback */
function ms(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n;
}
const token = (/** @type {string} */ name, /** @type {string} */ fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
// corners: a picture in the conversation has the cards' 12; at rest in the lightbox, the smallest on the scale
const R_SLOT = () => token("--r-lg", "12px"), R_REST = () => token("--r-xs", "6px");
/** @typedef {{ left: number, top: number, width: number, height: number }} Box */
const px = (/** @type {Box} */ r) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
const box = (/** @type {Element} */ el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };

/** Opens a picture over the page, grown from its spot, stepping through its gallery; pictures is what the pictures' owner lends it. @param {{ openFile?: ((it: any, from: any) => void) | null, announce?: (words: string) => void, pictures: Pictures }} opts */
export function createLightbox({ openFile = null, announce = () => {}, pictures }) {
  const { mediaItemOf, galleryOf, slotOf, cachedSrc, loadSrc, labelOf, midName, midNameHtml, typeWord, fmtSize, attachmentUrl, projectDownload } = pictures;
  /** @type {{ open: boolean, items: any[], i: number, root: any, returnTo: any, frame: any, busy: any, drag: any }} */
  const L = { open: false, items: [], i: 0, root: null, returnTo: null, frame: null, busy: null, drag: null };
  /** @type {any} */
  let el = null;

  function build() {
    if (el) return;
    el = document.createElement("div");
    el.className = "lbx";
    el.hidden = true;
    el.tabIndex = -1;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Picture");
    el.innerHTML = `<div class="lbx-scrim"></div><div class="lbx-stage"></div>` +
      `<header class="lbx-bar"><div class="lbx-t"><b class="lbx-name"></b><span class="lbx-by"></span></div><span class="lbx-meta"></span>` +
      `<div class="lbx-acts"><button type="button" class="lbx-btn" data-lbx="files" title="Open in Files">${FILES}<span>Open in Files</span></button>` +
      `<button type="button" class="lbx-btn" data-lbx="down" title="Download">${ICON.down}<span>Download</span></button>` +
      `<a class="lbx-btn" data-lbx="orig" target="_blank" rel="noopener noreferrer nofollow" title="Open the original" hidden><span>Open original</span>${ARROW_OUT}</a>` +
      `<button type="button" class="lbx-btn lbx-x" data-lbx="close" aria-label="Close" title="Close (Esc)">${ICON.close}</button></div></header>` +
      `<button type="button" class="lbx-arrow is-prev" data-lbx="prev" aria-label="Previous picture" title="Previous (←)">${PREV}</button>` +
      `<button type="button" class="lbx-arrow is-next" data-lbx="next" aria-label="Next picture" title="Next (→)">${NEXT}</button>` +
      `<p class="lbx-count" aria-live="polite"></p>`;
    document.body.appendChild(el);
    el.addEventListener("click", onClick);
    el.addEventListener("keydown", onKey);
    el.addEventListener("pointerdown", onDown);
    addEventListener("resize", () => { if (L.open && L.frame && !L.busy) place(L.frame, target(L.items[L.i], L.frame.querySelector("img"))); });
  }

  /** The room a picture has: the window less the bar above and the counter below. */
  function room() {
    const W = innerWidth, H = innerHeight, phone = W <= 760;
    const side = phone ? 8 : 56, top = phone ? 56 : 64, bottom = phone ? 48 : 72;
    return { left: side, top, width: Math.max(1, W - 2 * side), height: Math.max(1, H - top - bottom) };
  }
  /** A picture's natural size: the server's, else what its <img> decoded to. @param {any} it @param {any} img */
  function natural(it, img) {
    if (it.w && it.h) return { w: it.w, h: it.h };
    if (img && img.naturalWidth && img.naturalHeight) return { w: img.naturalWidth, h: img.naturalHeight };
    return null;
  }
  /** Where a picture rests: fitted in the room, centred, never past its own pixels. Unknown: the whole room. @param {any} it @param {any} img */
  function target(it, img) {
    const R = room();
    const n = natural(it, img);
    if (!n) return R;
    const s = Math.min(1, R.width / n.w, R.height / n.h);
    const w = Math.round(n.w * s), h = Math.round(n.h * s);
    return { left: Math.round(R.left + (R.width - w) / 2), top: Math.round(R.top + (R.height - h) / 2), width: w, height: h };
  }
  /** @param {any} frame @param {Box} r */
  function place(frame, r) { Object.assign(frame.style, px(r)); }
  /** How the picture fills its frame: in flight as its slot draws it, so nothing jumps; at rest its own shape, once known. @param {any} frame @param {any} slot @param {any} [it] */
  function fitLike(frame, slot, it = null) {
    const img = frame.querySelector("img");
    const mode = slot ? (slot.classList.contains("is-frame") || slot.classList.contains("is-banner") ? "contain" : "cover") : it && !natural(it, img) ? "contain" : "cover";
    img.style.objectFit = mode;
    img.style.objectPosition = slot && slot.classList.contains("is-long") ? "top" : "center";
  }
  const inView = (/** @type {any} */ slot) => {
    if (!slot || !slot.isConnected) return false;
    const r = slot.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };

  /** One picture's frame on the stage, its image loading. @param {any} it @returns {any} */
  function makeFrame(it) {
    const f = document.createElement("div");
    f.className = "lbx-frame";
    const img = document.createElement("img");
    img.className = "lbx-img";
    img.alt = labelOf(it);
    img.draggable = false;
    img.decoding = "async";
    if (it.web) img.referrerPolicy = "no-referrer"; // before any src: its host learns nothing of where it's shown
    img.addEventListener("error", () => { f.classList.add("is-err"); f.dataset.err = `Couldn't load ${labelOf(it)}`; }, { once: true });
    f.appendChild(img);
    el.querySelector(".lbx-stage").appendChild(f);
    const u = cachedSrc(it);
    if (u) img.src = u;
    else loadSrc(it).then((url) => { img.src = url; }, () => { f.classList.add("is-err"); f.dataset.err = `Couldn't load ${labelOf(it)}`; });
    // a picture whose size we didn't know says it once decoded, and settles to its own shape
    img.addEventListener("load", () => {
      if (L.frame !== f || (it.w && it.h)) return;
      el.querySelector(".lbx-meta").textContent = metaOf(it, img);
      if (!L.busy) move(f, box(f), target(it, img), ms("--d-move", 320));
    }, { once: true });
    return f;
  }
  /** "PNG · 2880 × 1800 · 412 KB": the server's size, else the decoded one; a titled picture's file name leads it. @param {any} it @param {any} img */
  function metaOf(it, img) {
    const n = natural(it, img);
    return [it.title ? midName(it.name, 40) : "", it.type ? typeWord(it.type, it.name) : "", n ? `${n.w} × ${n.h}` : "", fmtSize(it.bytes)].filter(Boolean).join(" · ");
  }
  /** @param {any} it @param {any} img */
  function caption(it, img) {
    const name = el.querySelector(".lbx-name");
    // a title is words and cuts at its end (CSS); a bare file name cuts in its middle, keeping its extension
    if (it.title) name.textContent = it.title; else name.innerHTML = midNameHtml(it.name);
    name.title = it.title ? `${it.title} · ${it.name}` : it.name;
    const when = Number.isFinite(it.at) && it.at > 0 ? clock(it.at) : "";
    el.querySelector(".lbx-by").textContent = [it.by, when].filter(Boolean).join(" · ");
    el.querySelector(".lbx-meta").textContent = metaOf(it, img);
    const n = L.items.length;
    el.querySelector(".lbx-count").textContent = n > 1 ? `${L.i + 1} of ${n}` : "";
    el.querySelector('[data-lbx="prev"]').hidden = n < 2;
    el.querySelector('[data-lbx="next"]').hidden = n < 2;
    // at either end its arrow is aria-disabled, not disabled, so focus stays on it; step() goes no further
    for (const [k, end] of [["prev", L.i === 0], ["next", L.i === n - 1]]) {
      const b = el.querySelector(`[data-lbx="${k}"]`);
      if (end) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
    }
    el.querySelector('[data-lbx="files"]').hidden = !openFile || !(it.att || (it.project && it.rel));
    // a picture from the web: its original, on its own site; no Download (another site's file isn't ours to save as)
    const orig = el.querySelector('[data-lbx="orig"]');
    orig.hidden = !it.web;
    if (it.web) orig.href = it.web.url; else orig.removeAttribute("href");
    el.querySelector('[data-lbx="down"]').hidden = !!it.web;
    el.setAttribute("aria-label", `${labelOf(it)}${n > 1 ? `, picture ${L.i + 1} of ${n}` : ""}`);
  }
  /** @param {any} frame @param {Box} from @param {Box} to @param {number} dur @param {{ r0?: string, r1?: string }} [opts] @returns {Promise<unknown>} */
  function move(frame, from, to, dur, { r0 = R_REST(), r1 = R_REST() } = {}) {
    place(frame, to);
    frame.style.borderRadius = r1;
    if (still()) return Promise.resolve();
    const a = frame.animate([{ ...px(from), borderRadius: r0 }, { ...px(to), borderRadius: r1 }], { duration: dur, easing: EASE });
    return a.finished.catch(() => {});
  }
  /** A fade. Reduced motion still cross-fades (a fade isn't a flight); only a browser without animate() snaps. @param {any} node @param {number} from @param {number} to @param {number} dur @returns {Promise<unknown>} */
  function fade(node, from, to, dur, delay = 0) {
    node.style.opacity = String(to);
    if (typeof node.animate !== "function") return Promise.resolve();
    const a = node.animate([{ opacity: from }, { opacity: to }], { duration: dur, delay, easing: EASE, fill: "backwards" });
    return a.finished.catch(() => {});
  }

  /** Open the picture drawn under `key`. from: the element pressed (its tile, or the album's "+N"); root: the conversation whose pictures ← → walk through. @param {string} key @param {any} from @param {any} root */
  function open(key, from, root) {
    build();
    const it0 = mediaItemOf(key);
    if (!it0) return;
    const items = galleryOf(root);
    L.items = items.length ? items : [it0];
    L.i = Math.max(0, L.items.findIndex((x) => x.key === key));
    L.root = root;
    L.returnTo = from || document.activeElement;
    L.open = true;
    el.hidden = false;
    document.body.classList.add("lbx-open");
    el.querySelectorAll(".lbx-frame").forEach((/** @type {Element} */ f) => f.remove());
    const it = L.items[L.i];
    const slot = from && from.closest(".mx-one,.mx-tile") || slotOf(root, key);
    const f = makeFrame(it);
    L.frame = f;
    // the picture the conversation already decoded shows at once, at its own size in the flight
    const srcImg = slot && slot.querySelector("img");
    if (srcImg && srcImg.naturalWidth && !f.querySelector("img").getAttribute("src")) f.querySelector("img").src = srcImg.src;
    const known = srcImg && srcImg.naturalWidth ? srcImg : f.querySelector("img");
    caption(it, known);
    const to = target(it, known);
    fitLike(f, slot);
    const scrim = el.querySelector(".lbx-scrim");
    const chrome = el.querySelectorAll(".lbx-bar,.lbx-arrow,.lbx-count");
    if (still() || !inView(slot)) {
      place(f, to); f.style.borderRadius = R_REST();
      L.busy = fade(el, 0, 1, ms("--d-hover-in", 120)).then(() => { L.busy = null; fitLike(f, null, it); });
    } else {
      el.style.opacity = "1";
      fade(scrim, 0, 1, ms("--d-in", 280));
      chrome.forEach((/** @type {Element} */ c) => fade(c, 0, 1, ms("--d-out", 160), 120));
      L.busy = move(f, box(slot), to, ms("--d-move", 320), { r0: slot.classList.contains("mx-tile") ? "0px" : R_SLOT() }).then(() => { L.busy = null; fitLike(f, null, it); });
    }
    el.focus({ preventScroll: true });
    announce(`${labelOf(it)} is open${L.items.length > 1 ? `, picture ${L.i + 1} of ${L.items.length}` : ""}. Arrow keys move between pictures; Esc closes it.`);
  }

  /** Step to the picture `d` away (−1, +1): the old one leaves, the new one settles in from that side. @param {number} d */
  function step(d) {
    const j = L.i + d;
    if (!L.open || j < 0 || j >= L.items.length) return;
    L.i = j;
    const it = L.items[j];
    const old = L.frame;
    const f = makeFrame(it);
    L.frame = f;
    caption(it, f.querySelector("img"));
    fitLike(f, null, it);
    const to = target(it, f.querySelector("img"));
    place(f, to);
    f.style.borderRadius = R_REST();
    if (old) fade(old, Number(getComputedStyle(old).opacity) || 1, 0, ms("--d-out", 160)).then(() => old.remove());
    if (still()) { fade(f, 0, 1, ms("--d-hover-in", 120)); return; }
    f.animate([{ opacity: 0, transform: `translateX(${d * 24}px)` }, { opacity: 1, transform: "none" }], { duration: ms("--d-in", 280), easing: EASE });
  }

  /** Send it back into its spot, or fade it where it is when the spot has gone. quick: no flight (Open in Files). */
  function close({ quick = false, restore = true } = {}) {
    if (!L.open) return Promise.resolve();
    L.open = false;
    const f = L.frame, it = L.items[L.i];
    const slot = it ? slotOf(L.root, it.key) : null;
    const scrim = el.querySelector(".lbx-scrim");
    const chrome = el.querySelectorAll(".lbx-bar,.lbx-arrow,.lbx-count");
    let done;
    if (quick || still() || !f || !inView(slot) || slot.classList.contains("is-tiny")) {
      const dur = quick || still() ? ms("--d-hover-in", 120) : ms("--d-out", 160);
      if (f && !quick && !still()) f.animate([{ opacity: 1, transform: f.style.transform || "none" }, { opacity: 0, transform: "scale(.96)" }], { duration: dur, easing: EASE, fill: "forwards" });
      done = fade(el, 1, 0, dur);
    } else {
      const from = box(f);
      f.style.transform = "";
      fitLike(f, slot);
      chrome.forEach((/** @type {Element} */ c) => fade(c, Number(getComputedStyle(c).opacity) || 1, 0, ms("--d-out", 160)));
      fade(scrim, Number(getComputedStyle(scrim).opacity) || 1, 0, ms("--d-out", 160), BACK_MS - ms("--d-out", 160));
      done = move(f, from, box(slot), BACK_MS, { r0: R_REST(), r1: slot.classList.contains("mx-tile") ? "0px" : R_SLOT() });
    }
    L.busy = done;
    return done.then(() => {
      L.busy = null;
      if (L.open) return; // opened again meanwhile
      el.hidden = true;
      el.style.opacity = "";
      for (const n of el.querySelectorAll(".lbx-scrim,.lbx-bar,.lbx-arrow,.lbx-count")) n.style.opacity = "";
      el.querySelectorAll(".lbx-frame").forEach((/** @type {Element} */ x) => x.remove());
      document.body.classList.remove("lbx-open");
      L.frame = null;
      // focus goes back to the picture now on screen (the one you stepped to, if it's in view), else where it began
      const back = (slot && slot.isConnected && slot) || L.returnTo;
      L.returnTo = null;
      if (restore && back && back.isConnected) back.focus({ preventScroll: true });
    });
  }

  /** @param {any} it */
  async function download(it) {
    try {
      let href = it.src || (it.att ? attachmentUrl(it.att.chat, it.att.id) : null), made = null;
      if (!href && it.project && it.rel) { made = URL.createObjectURL(await projectDownload(it.project, it.rel)); href = made; }
      if (!href) return;
      const a = Object.assign(document.createElement("a"), { href, download: it.name || "picture" });
      document.body.appendChild(a); a.click(); a.remove();
      if (made) setTimeout(() => URL.revokeObjectURL(made), 60000);
      announce(`Downloading ${it.name}.`);
    } catch (err) {
      announce(`Couldn't download ${it.name}: ${/** @type {any} */ (err).message || "the server refused"}.`);
    }
  }

  /** @param {any} e */
  function onClick(e) {
    const b = e.target.closest("[data-lbx]");
    if (!b) return;
    const it = L.items[L.i];
    const k = b.dataset.lbx;
    if (k === "close") close();
    else if (k === "prev") step(-1);
    else if (k === "next") step(1);
    else if (k === "down") download(it);
    else if (k === "orig") { /* the link opens it in a new tab */ }
    else if (k === "files" && openFile) {
      const from = slotOf(L.root, it.key) || L.returnTo;
      close({ quick: true, restore: false }).then(() => openFile(it, from));
    }
  }
  /** @param {any} e */
  function onKey(e) {
    // every key stays in here: the conversation's own shortcuts wait until it's closed
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); return; }
    if (e.key === "Tab") {
      const list = [...el.querySelectorAll("button:not([hidden]):not(:disabled),a[href]:not([hidden])")].filter((x) => x.offsetParent !== null);
      if (!list.length) { e.preventDefault(); return; }
      const i = list.indexOf(document.activeElement);
      e.preventDefault();
      list[e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i < 0 || i === list.length - 1 ? 0 : i + 1)].focus();
    }
  }
  /** A drag: down puts the picture away (the scrim thinning), sideways moves to the next; a press that doesn't move is a click. @param {any} e */
  function onDown(e) {
    if (!L.open || L.busy || e.button !== 0 || e.target.closest("button,.lbx-bar,.lbx-count")) return;
    const f = L.frame;
    L.drag = { x: e.clientX, y: e.clientY, t: performance.now(), axis: null, dx: 0, dy: 0, onImg: !!(f && f.contains(e.target)) };
    el.setPointerCapture(e.pointerId);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp, { once: true });
    el.addEventListener("pointercancel", onUp, { once: true });
  }
  /** @param {any} e */
  function onMove(e) {
    const d = L.drag, f = L.frame;
    if (!d || !f) return;
    d.dx = e.clientX - d.x; d.dy = e.clientY - d.y;
    if (!d.axis && Math.hypot(d.dx, d.dy) > LOCK_PX) d.axis = Math.abs(d.dy) > Math.abs(d.dx) ? "y" : L.items.length > 1 ? "x" : "y";
    if (d.axis === "y") {
      const dy = Math.max(0, d.dy);
      f.style.transform = `translate(${d.dx * 0.3}px,${dy}px)`;
      el.querySelector(".lbx-scrim").style.opacity = String(Math.max(0, 1 - dy / FADE_PX));
    } else if (d.axis === "x") f.style.transform = `translateX(${d.dx}px)`;
  }
  /** @param {any} e */
  function onUp(e) {
    el.removeEventListener("pointermove", onMove);
    const d = L.drag, f = L.frame;
    L.drag = null;
    if (!d || !f) return;
    const dt = Math.max(1, performance.now() - d.t);
    if (!d.axis) { if (e.type === "pointerup" && !d.onImg) close(); return; }
    if (d.axis === "y" && (d.dy > DOWN_PX || d.dy / dt > DOWN_V)) { close(); return; }
    if (d.axis === "x" && (Math.abs(d.dx) > innerWidth * SIDE_PART || Math.abs(d.dx) / dt > SIDE_V)) {
      const dir = d.dx < 0 ? 1 : -1;
      if (L.items[L.i + dir]) { f.style.transform = ""; step(dir); return; }
    }
    // not far enough: it settles back
    const was = f.style.transform;
    f.style.transform = "";
    const scrim = el.querySelector(".lbx-scrim");
    const o = Number(scrim.style.opacity || 1);
    scrim.style.opacity = "";
    if (still()) return;
    f.animate([{ transform: was }, { transform: "none" }], { duration: BACK_MS, easing: EASE });
    scrim.animate([{ opacity: o }, { opacity: 1 }], { duration: BACK_MS, easing: EASE });
  }

  return { open, close, get isOpen() { return L.open; } };
}
