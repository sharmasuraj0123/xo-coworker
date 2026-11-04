// The lightbox (design-research/2026-11-vision/chat/proposal.md §7): a picture opens over the
// conversation for a quick look, and documents keep opening beside it (js/viewer.js).
//   · it grows from its own spot in the conversation to fit the window (320 ms, the one curve), its
//     corners going 12 → 6, over a dark scrim; it never grows past its own pixels;
//   · ← → (or a sideways swipe) step through every picture in the open conversation, in order, the ones
//     behind an album's "+N" too, so comparing two states is two key presses;
//   · Esc, a click outside it, or a swipe down sends it back into its spot (240 ms); if that spot has
//     scrolled away it fades out where it is;
//   · the caption names it, who made it and when, with Open in Files and Download;
//   · focus is held inside while it's open and goes back to the picture after;
//   · reduced motion: a short cross-fade in place of every flight.
// Durations and the curve are read from css/tokens.css (--d-move, --d-in, --d-out, --d-hover-in, --ease),
// so the CSS and the motion here can't drift apart.
//
// createLightbox({openFile, announce}) → {open(key, from, root), close(), isOpen}
//   openFile(item, from): "Open in Files" (app.js hands it to the viewer, which brings Files up).

import { esc } from "./util.js";
import { ICON, clock } from "./ui.js";
import { api, attachmentUrl } from "./api.js";
import { typeWord, fmtSize } from "./attach.js";
import { still } from "./motion.js";
import { mediaItemOf, galleryOf, slotOf, cachedSrc, loadSrc } from "./media.js";

// The flight back is a touch quicker than the flight out (proposal §7): leaving should never feel slower
// than arriving. Plan F has no 240 token; this is --d-hover (200) and --d-in (280) met halfway.
const BACK_MS = 240;
// Swipe thresholds (proposal §7): down past 96 px or 0.6 px/ms closes; sideways past 20 % or 0.5 px/ms moves.
const DOWN_PX = 96, DOWN_V = 0.6, SIDE_PART = 0.2, SIDE_V = 0.5, LOCK_PX = 8, FADE_PX = 400;

const NEXT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const PREV = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
const FILES = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8A1.5 1.5 0 0 1 20.5 9v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/></svg>';

/** A token's duration in ms, read from the page (so a change in tokens.css changes the motion too). */
function ms(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n;
}
const token = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const curve = () => token("--ease", "cubic-bezier(.2,.8,.2,1)");
// corners: a picture in the conversation has the cards' 12; at rest in the lightbox, the smallest on the scale
const R_SLOT = () => token("--r-lg", "12px"), R_REST = () => token("--r-xs", "6px");
const px = (r) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };

export function createLightbox({ openFile = null, announce = () => {} } = {}) {
  const L = { open: false, items: [], i: 0, root: null, returnTo: null, frame: null, busy: null, drag: null };
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

  // ── geometry ────────────────────────────────────────────────────────────────
  /** The room a picture has: the window less the bar above and the counter below (proposal §7). */
  function room() {
    const W = innerWidth, H = innerHeight, phone = W <= 760;
    const side = phone ? 8 : 56, top = phone ? 56 : 64, bottom = phone ? 48 : 72;
    return { left: side, top, width: Math.max(1, W - 2 * side), height: Math.max(1, H - top - bottom) };
  }
  /** A picture's natural size: the server's, else what its <img> decoded to. */
  function natural(it, img) {
    if (it.w && it.h) return { w: it.w, h: it.h };
    if (img && img.naturalWidth && img.naturalHeight) return { w: img.naturalWidth, h: img.naturalHeight };
    return null;
  }
  /** Where a picture rests: fitted in the room, centred, never past its own pixels. Unknown: the whole room. */
  function target(it, img) {
    const R = room();
    const n = natural(it, img);
    if (!n) return R;
    const s = Math.min(1, R.width / n.w, R.height / n.h);
    const w = Math.round(n.w * s), h = Math.round(n.h * s);
    return { left: Math.round(R.left + (R.width - w) / 2), top: Math.round(R.top + (R.height - h) / 2), width: w, height: h };
  }
  function place(frame, r) { Object.assign(frame.style, px(r)); }
  /**
   * How the picture fills its frame: in flight, as its slot draws it, so leaving or landing in the slot
   * doesn't jump; at rest (no slot) the frame has the picture's own shape, unless that isn't known yet.
   */
  function fitLike(frame, slot, it = null) {
    const img = frame.querySelector("img");
    const mode = slot ? (slot.classList.contains("is-frame") || slot.classList.contains("is-banner") ? "contain" : "cover") : it && !natural(it, img) ? "contain" : "cover";
    img.style.objectFit = mode;
    img.style.objectPosition = slot && slot.classList.contains("is-long") ? "top" : "center";
  }
  const inView = (slot) => {
    if (!slot || !slot.isConnected) return false;
    const r = slot.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };

  // ── drawing one picture ─────────────────────────────────────────────────────
  function makeFrame(it) {
    const f = document.createElement("div");
    f.className = "lbx-frame";
    const img = document.createElement("img");
    img.className = "lbx-img";
    img.alt = it.name;
    img.draggable = false;
    img.decoding = "async";
    f.appendChild(img);
    el.querySelector(".lbx-stage").appendChild(f);
    const u = cachedSrc(it);
    if (u) img.src = u;
    else loadSrc(it).then((url) => { img.src = url; }, () => { f.classList.add("is-err"); f.dataset.err = `Couldn't load ${it.name}`; });
    // a picture whose size we didn't know says it once decoded, and settles to its own shape
    img.addEventListener("load", () => {
      if (L.frame !== f || (it.w && it.h)) return;
      el.querySelector(".lbx-meta").textContent = metaOf(it, img);
      if (!L.busy) move(f, box(f), target(it, img), ms("--d-move", 320));
    }, { once: true });
    return f;
  }
  /** "PNG · 2880 × 1800 · 412 KB": the size the server sent, else the one the picture decoded to. */
  function metaOf(it, img) {
    const n = natural(it, img);
    return [it.type ? typeWord(it.type, it.name) : "", n ? `${n.w} × ${n.h}` : "", fmtSize(it.bytes)].filter(Boolean).join(" · ");
  }
  function caption(it, img) {
    el.querySelector(".lbx-name").textContent = it.name;
    const when = Number.isFinite(it.at) && it.at > 0 ? clock(it.at) : "";
    el.querySelector(".lbx-by").textContent = [it.by, when].filter(Boolean).join(" · ");
    el.querySelector(".lbx-meta").textContent = metaOf(it, img);
    const n = L.items.length;
    el.querySelector(".lbx-count").textContent = n > 1 ? `${L.i + 1} of ${n}` : "";
    el.querySelector('[data-lbx="prev"]').hidden = n < 2;
    el.querySelector('[data-lbx="next"]').hidden = n < 2;
    el.querySelector('[data-lbx="prev"]').disabled = L.i === 0;
    el.querySelector('[data-lbx="next"]').disabled = L.i === n - 1;
    el.querySelector('[data-lbx="files"]').hidden = !openFile || !(it.att || (it.project && it.rel));
    el.setAttribute("aria-label", `${it.name}${n > 1 ? `, picture ${L.i + 1} of ${n}` : ""}`);
  }
  function move(frame, from, to, dur, { r0 = R_REST(), r1 = R_REST() } = {}) {
    place(frame, to);
    frame.style.borderRadius = r1;
    if (still()) return Promise.resolve();
    const a = frame.animate([{ ...px(from), borderRadius: r0 }, { ...px(to), borderRadius: r1 }], { duration: dur, easing: curve() });
    return a.finished.catch(() => {});
  }
  /** A fade. Reduced motion still cross-fades (a fade isn't a flight); only a browser without animate() snaps. */
  function fade(node, from, to, dur, delay = 0) {
    node.style.opacity = String(to);
    if (typeof node.animate !== "function") return Promise.resolve();
    const a = node.animate([{ opacity: from }, { opacity: to }], { duration: dur, delay, easing: curve(), fill: "backwards" });
    return a.finished.catch(() => {});
  }

  // ── open, move, close ───────────────────────────────────────────────────────
  /**
   * Open the picture drawn under `key`. from: the element pressed (its tile, or the album's "+N");
   * root: the conversation whose pictures ← → walk through.
   */
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
    el.querySelectorAll(".lbx-frame").forEach((f) => f.remove());
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
      chrome.forEach((c) => fade(c, 0, 1, ms("--d-out", 160), 120));
      L.busy = move(f, box(slot), to, ms("--d-move", 320), { r0: slot.classList.contains("mx-tile") ? "0px" : R_SLOT() }).then(() => { L.busy = null; fitLike(f, null, it); });
    }
    el.focus({ preventScroll: true });
    announce(`${it.name} is open${L.items.length > 1 ? `, picture ${L.i + 1} of ${L.items.length}` : ""}. Arrow keys move between pictures; Esc closes it.`);
  }

  /** Step to the picture `d` away (−1, +1): the old one leaves, the new one settles in from that side. */
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
    f.animate([{ opacity: 0, transform: `translateX(${d * 24}px)` }, { opacity: 1, transform: "none" }], { duration: ms("--d-in", 280), easing: curve() });
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
      if (f && !quick && !still()) f.animate([{ opacity: 1, transform: f.style.transform || "none" }, { opacity: 0, transform: "scale(.96)" }], { duration: dur, easing: curve(), fill: "forwards" });
      done = fade(el, 1, 0, dur);
    } else {
      const from = box(f);
      f.style.transform = "";
      fitLike(f, slot);
      chrome.forEach((c) => fade(c, Number(getComputedStyle(c).opacity) || 1, 0, ms("--d-out", 160)));
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
      el.querySelectorAll(".lbx-frame").forEach((x) => x.remove());
      document.body.classList.remove("lbx-open");
      L.frame = null;
      // focus goes back to the picture now on screen (the one you stepped to, if it's in view), else where it began
      const back = (slot && slot.isConnected && slot) || L.returnTo;
      L.returnTo = null;
      if (restore && back && back.isConnected) back.focus({ preventScroll: true });
    });
  }

  async function download(it) {
    try {
      let href = it.src || (it.att ? attachmentUrl(it.att.chat, it.att.id) : null), made = null;
      if (!href && it.project && it.rel) { made = URL.createObjectURL(await api.projectDownload(it.project, it.rel)); href = made; }
      if (!href) return;
      const a = Object.assign(document.createElement("a"), { href, download: it.name || "picture" });
      document.body.appendChild(a); a.click(); a.remove();
      if (made) setTimeout(() => URL.revokeObjectURL(made), 60000);
      announce(`Downloading ${it.name}.`);
    } catch (err) {
      announce(`Couldn't download ${it.name}: ${err.message || "the server refused"}.`);
    }
  }

  // ── input ───────────────────────────────────────────────────────────────────
  function onClick(e) {
    const b = e.target.closest("[data-lbx]");
    if (!b) return;
    const it = L.items[L.i];
    const k = b.dataset.lbx;
    if (k === "close") close();
    else if (k === "prev") step(-1);
    else if (k === "next") step(1);
    else if (k === "down") download(it);
    else if (k === "files" && openFile) {
      const from = slotOf(L.root, it.key) || L.returnTo;
      close({ quick: true, restore: false }).then(() => openFile(it, from));
    }
  }
  function onKey(e) {
    // every key stays in here: the conversation's own shortcuts wait until it's closed
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); return; }
    if (e.key === "Tab") {
      const list = [...el.querySelectorAll("button:not([hidden]):not(:disabled)")].filter((x) => x.offsetParent !== null);
      if (!list.length) { e.preventDefault(); return; }
      const i = list.indexOf(document.activeElement);
      e.preventDefault();
      list[e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i < 0 || i === list.length - 1 ? 0 : i + 1)].focus();
    }
  }
  // A drag on the picture: down puts it away (it follows the finger, the scrim thinning as it goes),
  // sideways moves to the next one. A press that doesn't move is a click: outside the picture, it closes.
  function onDown(e) {
    if (!L.open || L.busy || e.button !== 0 || e.target.closest("button,.lbx-bar,.lbx-count")) return;
    const f = L.frame;
    L.drag = { x: e.clientX, y: e.clientY, t: performance.now(), axis: null, dx: 0, dy: 0, onImg: !!(f && f.contains(e.target)) };
    el.setPointerCapture(e.pointerId);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp, { once: true });
    el.addEventListener("pointercancel", onUp, { once: true });
  }
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
    f.animate([{ transform: was }, { transform: "none" }], { duration: BACK_MS, easing: curve() });
    scrim.animate([{ opacity: o }, { opacity: 1 }], { duration: BACK_MS, easing: curve() });
  }

  return { open, close, get isOpen() { return L.open; } };
}
