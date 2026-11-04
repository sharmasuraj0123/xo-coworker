// Pictures and files in the conversation (design-research/2026-11-vision/chat/proposal.md §1, §2, §8, §13).
// One module draws every file a message or a turn carries, so a picture looks the same wherever it sits:
//   · a picture is shown, not attached: bare, 12 px corners, a 1 px hairline drawn over it, no card and no
//     shadow. An agent's are at most 560 × 480 (the prose measure), yours 320 × 320 (you've seen them);
//     never upscaled;
//   · two or more make one album: justified rows 2 px apart, at most four tiles, the fourth "+N";
//   · anything else stays the compact file card it is today, with its Pierre icon;
//   · the box is known before the pixels: the server sends w, h and the picture's average colour (tint),
//     so the space is reserved and the conversation never jumps. Without them (older uploads, an SVG)
//     the picture gets a fixed 16:10 frame at the side's width and is fitted inside it, so it still
//     can't jump when it loads.
// Pictures open in the lightbox (js/lightbox.js); documents open in the viewer beside the conversation.
//
// The layout math (fitImage, albumLayout, dedupeByMade) is pure and tested from Node
// (tests/media.test.mjs). The DOM part (hydrateMedia) only runs in a browser.

import { esc, isImagePath } from "./util.js";
import { fileIcon } from "./fileicons.js";
import { ICON } from "./ui.js";
import { api, attachmentUrl } from "./api.js";
import { fmtSize, typeWord } from "./attach.js";
import { fadeImage } from "./motion.js";

/** Each side's largest box (proposal §1). 560 is the prose measure, so a picture is never wider than its text. */
export const LIMITS = { them: { w: 560, h: 480 }, you: { w: 320, h: 320 } };
/** Under this on both sides, a picture shows at its own size in a tile this big. */
export const TINY = 96;
/** Narrower than this (w/h), a capture is cropped from its top: you see the page's header, not its middle. */
export const LONG = 0.4;
/** Wider than this, a banner keeps at least TINY of height, letterboxed. */
export const BANNER = 5;
/** Between album tiles; the canvas shows through. */
export const GAP = 2;
/** An album shows at most this many tiles; the last reads "+N". */
export const MAX_TILES = 4;
/** The frame a picture of unknown size is fitted into: 16:10, the shape of most screens. */
export const FRAME = 16 / 10;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const posNum = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);

/** A positive size, or null (null and missing both mean "unknown"). */
export function dim(v) {
  const n = posNum(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** The server's tint as a CSS colour, or null. Only plain hex and rgb() pass: it goes into a style attribute. */
export function safeTint(t) {
  const s = String(t ?? "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
  if (/^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(?:,\s*[\d.]+%?\s*)?\)$/i.test(s)) return s;
  return null;
}

/**
 * One picture's box in a side's largest box (w × h px, never upscaled). mode:
 *   fit     the picture's own shape, scaled down to fit;
 *   long    a capture narrower than 1:2.5 that would be taller than maxH: full width, cropped from the top;
 *   tiny    both sides under 96: a 96 × 96 tile with the picture at its own size (iw × ih) in the middle;
 *   banner  wider than 5:1: at least 96 tall, letterboxed;
 *   frame   the size is unknown: a 16:10 frame at the side's width, the picture fitted inside it.
 */
export function fitImage(w, h, maxW, maxH) {
  w = dim(w); h = dim(h);
  if (!w || !h) return { w: maxW, h: Math.min(maxH, Math.round(maxW / FRAME)), mode: "frame" };
  if (w < TINY && h < TINY) return { w: TINY, h: TINY, mode: "tiny", iw: w, ih: h };
  const r = w / h;
  if (r < LONG) {
    const s = Math.min(1, maxW / w);
    if (h * s > maxH) return { w: Math.max(1, Math.round(w * s)), h: maxH, mode: "long" };
  }
  const s = Math.min(1, maxW / w, maxH / h);
  const bw = Math.max(1, Math.round(w * s)), bh = Math.max(1, Math.round(h * s));
  if (r > BANNER && bh < TINY) return { w: bw, h: TINY, mode: "banner" };
  return { w: bw, h: bh, mode: "fit" };
}

/** Integer widths that sum to `total`, in proportion to `ratios` (largest remainder, so no pixel is lost). */
function share(total, ratios) {
  const S = sum(ratios);
  const raw = ratios.map((r) => (total * r) / S);
  const out = raw.map(Math.floor);
  let left = total - sum(out);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  return out;
}

/**
 * An album's justified rows (proposal §2). ratios: each picture's w/h (unknown: NaN or null). Each is
 * clamped to [0.5, 2] for layout, and its tile is cover-cropped to that shape, so one very tall or very
 * wide picture can't wreck a row.
 *   2 · one row;
 *   3 · a landscape first (≥ 1.2) gets a row of its own, at most 0.6 × maxH tall, the other two under it;
 *       otherwise one row of three;
 *   4+ · two rows of two; past four, the fourth tile reads "+N" (N = n − 3: the covered one is unseen too).
 * The album is one rectangle: every row is justified to the same width, the widest (≤ W) that keeps each
 * row under its cap and the whole album under maxH. So a capped album is narrower, never ragged.
 * Returns {w, h, rows: [{h, tiles: [{i, w}]}], more}.
 */
export function albumLayout(ratios, { W, maxH, gap = GAP } = {}) {
  const n = ratios.length;
  const r = ratios.map((x) => clamp(Number.isFinite(x) && x > 0 ? x : FRAME, 0.5, 2));
  let rows, caps;
  if (n <= 2) { rows = [r.map((_, i) => i)]; caps = [maxH]; }
  else if (n === 3) {
    if (r[0] >= 1.2) { rows = [[0], [1, 2]]; caps = [0.6 * maxH, maxH]; }
    else { rows = [[0, 1, 2]]; caps = [maxH]; }
  } else { rows = [[0, 1], [2, 3]]; caps = [(maxH - gap) / 2, (maxH - gap) / 2]; }
  const S = rows.map((row) => sum(row.map((i) => r[i])));
  const G = rows.map((row) => (row.length - 1) * gap);
  // a row of width Wa is (Wa − its gaps) / S tall: the widest Wa under each cap, then under maxH in all
  let Wa = W;
  rows.forEach((_, k) => { Wa = Math.min(Wa, caps[k] * S[k] + G[k]); });
  Wa = Math.min(Wa, (maxH - (rows.length - 1) * gap + sum(G.map((g, k) => g / S[k]))) / sum(S.map((s) => 1 / s)));
  Wa = Math.max(1, Math.floor(Wa));
  const out = rows.map((row, k) => ({
    h: Math.max(1, Math.round((Wa - G[k]) / S[k])),
    tiles: share(Wa - G[k], row.map((i) => r[i])).map((w, j) => ({ i: row[j], w })),
  }));
  return { w: Wa, h: sum(out.map((x) => x.h)) + (out.length - 1) * gap, rows: out, more: n > MAX_TILES ? n - (MAX_TILES - 1) : 0 };
}

/** The made ids a list of files carries. */
export function madeIds(files) {
  return new Set((files || []).map((f) => f && f.made_id).filter(Boolean).map(String));
}

/** A turn's shared files less the ones a message already carries (same made_id): never the same picture twice. */
export function dedupeByMade(files, carried) {
  const c = carried instanceof Set ? carried : madeIds(carried);
  return (files || []).filter((f) => !(f && f.made_id && c.has(String(f.made_id))));
}

// ── items: every source in one shape ─────────────────────────────────────────
// {key, kind: image|file, name, type, bytes, w, h, tint, made, by, at, and how it's read:
//  src (a URL an <img> loads directly), att {chat, id} (an upload of yours), project + rel (a project file,
//  fetched with the Coder header as a blob), path, or why (no route: the viewer says so)}

const IMAGE_TYPE = /^image\/(png|jpe?g|gif|webp|avif|svg\+xml|bmp|x-icon|vnd\.microsoft\.icon)$/i;
/** A picture the conversation shows, from the server's type, else the name. */
export const isPicture = (type, name) => (type ? IMAGE_TYPE.test(String(type)) : isImagePath(name));

const REG = new Map(); // key → item: the lightbox and the click handler read what was drawn
/** The item drawn under `key` (the lightbox's list, a click). */
export const mediaItemOf = (key) => REG.get(key) || null;

/** A plain item (the demo builds its own; the adapters below build theirs). */
export function mediaItem(raw) {
  const name = String(raw.name || String(raw.path || "").split("/").pop() || "file");
  const type = String(raw.type || "");
  const it = {
    key: String(raw.key || (raw.src ? `src:${raw.src}` : `name:${name}`)),
    name, type, bytes: raw.bytes ?? null,
    w: dim(raw.w), h: dim(raw.h), tint: safeTint(raw.tint),
    made: raw.made_id ? String(raw.made_id) : raw.made || null,
    by: raw.by || "", at: raw.at ?? null,
    src: raw.src || null, att: raw.att || null, project: raw.project || null, rel: raw.rel || null,
    path: raw.path || null, why: raw.why || null,
  };
  const readable = !!(it.src || it.att || (it.project && it.rel));
  it.kind = readable && isPicture(type, name) ? "image" : "file";
  return it;
}

/**
 * A file on a message: an upload of yours ({id}, read through its chat) or a file an agent shared
 * ({project_id, relative_path}, read from its project). by: who made it, for the lightbox's caption.
 */
export function fromAttachment(f, { chat = null, by = "", at = null } = {}) {
  const c = f.chat || chat;
  const base = { name: f.name, type: f.type, bytes: f.bytes ?? f.size, w: f.w, h: f.h, tint: f.tint, made_id: f.made_id, by, at };
  if (f.id && c) return mediaItem({ ...base, key: `att:${c}:${f.id}`, att: { chat: c, id: String(f.id) }, src: attachmentUrl(c, f.id) });
  if (f.project_id && f.relative_path) return mediaItem({ ...base, key: `prj:${f.project_id}:${f.relative_path}`, project: String(f.project_id), rel: String(f.relative_path), path: f.path || f.relative_path });
  return mediaItem({ ...base, key: `none:${f.name || ""}` }); // not uploaded yet: a card that can't open
}

/**
 * A file in a turn's shared_files block. Newer servers send its project route; older blocks only have
 * the agent's path, which `route(path)` resolves ({project, rel} or {why}; timeline.js sharedFileRoute).
 */
export function fromSharedFile(f, { route = null, by = "", at = null } = {}) {
  const base = { name: f.name || f.path, type: f.type, bytes: f.bytes, w: f.w, h: f.h, tint: f.tint, made_id: f.made_id, path: f.path || f.name, by, at };
  const r = f.project_id && f.relative_path ? { project: String(f.project_id), rel: String(f.relative_path) } : route ? route(f.path || f.name) : null;
  if (r && r.project && r.rel) return mediaItem({ ...base, key: `prj:${r.project}:${r.rel}`, project: r.project, rel: r.rel });
  return mediaItem({ ...base, key: `path:${f.path || f.name}`, why: (r && r.why) || "This file is in a folder XO doesn't serve to the UI yet." });
}

/** What the side viewer (js/viewer.js) opens for an item. */
export function viewerFile(it) {
  const base = { name: it.name, type: it.type, bytes: it.bytes };
  if (it.att) return { ...base, att: it.att };
  if (it.project && it.rel) return { ...base, path: it.path || it.rel, project: it.project, rel: it.rel };
  return { ...base, path: it.path || it.name, why: it.why || "This file can't be opened here." };
}

// ── HTML ─────────────────────────────────────────────────────────────────────

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const sizeWords = (it) => (it.w && it.h ? `${it.w} by ${it.h}` : "");

/** The <img>: a direct URL loads by itself; a project file is fetched by hydrateMedia (it needs a header). */
function imgHtml(it, cls = "") {
  const src = it.src ? ` src="${esc(it.src)}" loading="lazy"` : "";
  return `<img class="mx-img${cls}" data-mx-img="${esc(it.key)}"${src} alt="${esc(it.name)}" decoding="async" draggable="true">`;
}
/** Loading… and Couldn't load, said on the picture itself (hydrateMedia fills it). */
const STATE = `<span class="mx-state" aria-hidden="true"></span>`;

function oneHtml(it, side) {
  const L = LIMITS[side] || LIMITS.them;
  const f = fitImage(it.w, it.h, L.w, L.h);
  const style = [`--mx-w:${f.w}px`, `--mx-r:${r6(f.w / f.h)}`, it.tint && `--mx-tint:${it.tint}`, f.mode === "tiny" && `--mx-iw:${f.iw}px;--mx-ih:${f.ih}px`].filter(Boolean).join(";");
  const tag = f.mode === "long" ? `<span class="mx-tag">Long image · ${it.w} × ${it.h}</span>` : "";
  const label = ["Open " + it.name, "image", sizeWords(it)].filter(Boolean).join(", ");
  return `<button type="button" class="mx-one is-${f.mode}" data-mx="${esc(it.key)}" style="${style}" aria-label="${esc(label)}">${imgHtml(it)}${tag}${STATE}</button>`;
}

function albumHtml(list, side) {
  const L = LIMITS[side] || LIMITS.them;
  const lay = albumLayout(list.map((it) => (it.w && it.h ? it.w / it.h : NaN)), { W: L.w, maxH: L.h });
  const n = list.length;
  const rows = lay.rows.map((row) => `<div class="mx-row" style="--mx-r:${r6(lay.w / row.h)}">` + row.tiles.map((t) => {
    const it = list[t.i];
    const last = lay.more && t.i === MAX_TILES - 1;
    const label = last ? `Open ${it.name} and ${lay.more - 1} more ${lay.more - 1 === 1 ? "picture" : "pictures"}` : `Open ${it.name}, image ${t.i + 1} of ${n}`;
    const style = [`--mx-g:${t.w}`, it.tint && `--mx-tint:${it.tint}`].filter(Boolean).join(";");
    return `<button type="button" class="mx-tile" data-mx="${esc(it.key)}" style="${style}" aria-label="${esc(label)}">${imgHtml(it)}${STATE}` +
      (last ? `<span class="mx-more" aria-hidden="true">+${lay.more}</span>` : "") + `</button>`;
  }).join("") + `</div>`).join("");
  return `<div class="mx-album" role="group" aria-label="${n} pictures" style="--mx-w:${lay.w}px">${rows}</div>`;
}

/** A file that isn't a picture: today's file card, with its Pierre icon. */
function cardHtml(it) {
  const meta = [it.type ? typeWord(it.type, it.name) : "", fmtSize(it.bytes)].filter(Boolean).join(" · ");
  const can = !!(it.att || it.project || it.why);
  return `<li class="tb-file"><button type="button" class="tb-fb" ${can ? `data-mx="${esc(it.key)}" aria-label="Open ${esc(it.name)}"` : "disabled"} title="${esc(it.path || it.name)}">` +
    `<span class="tb-fi">${fileIcon(it.name)}</span><span class="tb-ft"><span class="tb-fn">${esc(it.name)}</span><span class="tb-fm">${esc(meta)}</span></span>` +
    (can ? `<span class="tb-fo" aria-hidden="true">Open${ICON.chevron}</span>` : "") + `</button></li>`;
}

/**
 * Items as HTML: their pictures (one, or one album), then the other files as cards. side: "them" (an
 * agent's, on its text column) or "you" (yours, right-aligned above your words). caption: the agent's
 * words under a shared set. "" when there's nothing to show.
 */
export function mediaHtml(items, { side = "them", caption = "" } = {}) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return "";
  for (const it of list) REG.set(it.key, it);
  const pics = list.filter((it) => it.kind === "image");
  const files = list.filter((it) => it.kind !== "image");
  let html = "";
  if (pics.length === 1) html += oneHtml(pics[0], side);
  else if (pics.length > 1) html += albumHtml(pics, side);
  if (files.length) html += `<ul class="tb-fl${side === "you" ? " m-files" : ""} mx-files" aria-label="Files">${files.map(cardHtml).join("")}</ul>`;
  if (caption) html += `<p class="mx-cap">${esc(caption)}</p>`;
  // the lightbox walks every picture on screen in order, the ones behind "+N" too
  const keys = pics.length ? ` data-mx-keys="${esc(JSON.stringify(pics.map((it) => it.key)))}"` : "";
  return `<div class="mx-stack mx-${side === "you" ? "you" : "them"}"${keys}>${html}</div>`;
}

// ── the browser: load, fade, remember ────────────────────────────────────────

const CACHE_MAX = 200;
// One object-URL cache for project pictures (proposal §8: a picture seen anywhere never loads twice).
// key → {url, p}; least recently used goes first, and its URL is freed unless a picture still shows it.
const blobs = new Map();
function touch(map, key, val) { map.delete(key); map.set(key, val); }
function evict() {
  while (blobs.size > CACHE_MAX) {
    const [k, e] = blobs.entries().next().value;
    blobs.delete(k);
    if (e.url && !document.querySelector(`img[src="${CSS.escape(e.url)}"]`)) URL.revokeObjectURL(e.url);
  }
}
/** The URL a picture shows from right now, or null until it has been fetched. */
export function cachedSrc(it) {
  return it ? it.src || (blobs.get(it.key) || {}).url || null : null;
}
/** The URL a picture shows from: direct, or its project file fetched once into an object URL. */
export function loadSrc(it) {
  if (!it) return Promise.reject(new Error("No picture"));
  if (it.src) return Promise.resolve(it.src);
  let e = blobs.get(it.key);
  if (e) { touch(blobs, it.key, e); return e.p; }
  e = { url: null, p: null };
  e.p = api.projectImage(it.project, it.rel).then((b) => { e.url = URL.createObjectURL(b); return e.url; }, (err) => { blobs.delete(it.key); throw err; });
  blobs.set(it.key, e);
  evict();
  return e.p;
}

// A message redrawn (a reaction came, its turn ticked) gets new elements; its pictures keep their
// decoded pixels by moving the old <img> into the new slot, so nothing blinks.
const shown = new Map(); // key → the last decoded <img>
const SLOW_MS = 3000;
// one watcher per scrolling column: its margin reaches past the column's own edge (a viewport watcher's
// margin would be clipped by the scroller, so pictures would only start loading once already on screen)
const watchers = new Map();
function watcherFor(root) {
  if (typeof IntersectionObserver !== "function") return null;
  const sc = root.closest(".scroller") || null;
  let io = watchers.get(sc);
  if (!io) {
    io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) { io.unobserve(e.target); start(e.target); }
    }, { root: sc, rootMargin: "800px 0px" });
    watchers.set(sc, io);
  }
  return io;
}

function stateOf(box, cls, text) {
  if (!box) return;
  box.classList.remove("is-slow", "is-err");
  if (cls) box.classList.add(cls);
  const s = box.querySelector(":scope > .mx-state");
  if (s) s.textContent = text || "";
}
function landed(img, box, key) {
  clearTimeout(img._mxSlow);
  stateOf(box, null);
  box && box.classList.add("is-in");
  touch(shown, key, img);
  while (shown.size > CACHE_MAX) shown.delete(shown.keys().next().value);
}
function failed(img, box, it) {
  clearTimeout(img._mxSlow);
  img.style.opacity = "0";
  stateOf(box, "is-err", `Couldn't load ${it ? it.name : "this picture"} · Retry`);
}
/** Show an <img> once it has decoded (motion.js fadeImage); one already decoded (cached) shows at once. */
function watch(img, box, it) {
  const key = img.dataset.mxImg;
  if (img.complete && img.naturalWidth) { landed(img, box, key); return; }
  fadeImage(img);
  img.addEventListener("load", () => landed(img, box, key), { once: true });
  img.addEventListener("error", () => failed(img, box, it), { once: true });
}
/** A picture near the screen starts loading; one that takes over 3 s says so (never a spinner). */
function start(img) {
  const box = img.closest(".mx-one,.mx-tile");
  const it = REG.get(img.dataset.mxImg);
  if (img.complete && img.naturalWidth) return;
  img._mxSlow = setTimeout(() => { if (!(img.complete && img.naturalWidth) && !box.classList.contains("is-err")) stateOf(box, "is-slow", "Loading…"); }, SLOW_MS);
  if (img.getAttribute("src")) return;
  loadSrc(it).then((u) => { img.src = u; watch(img, box, it); }, () => failed(img, box, it));
}

/**
 * After the conversation draws: every new picture under `root` loads (a project picture once it nears
 * the screen), fades in once decoded, and keeps its pixels when its message is redrawn.
 */
export function hydrateMedia(root) {
  if (!root || typeof document === "undefined") return;
  const io = watcherFor(root);
  for (const img of root.querySelectorAll("img.mx-img")) {
    if (img._mx) continue;
    img._mx = true;
    const key = img.dataset.mxImg;
    const it = REG.get(key);
    const box = img.closest(".mx-one,.mx-tile");
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

/** A picture that couldn't load: try again (a press on it says Retry). True when it was one. */
export function retryMedia(el) {
  const box = el && el.closest(".mx-one,.mx-tile");
  if (!box || !box.classList.contains("is-err")) return false;
  const img = box.querySelector("img.mx-img");
  const it = REG.get(img.dataset.mxImg);
  stateOf(box, null);
  if (it && !it.src) blobs.delete(it.key);
  img.removeAttribute("src"); img.style.opacity = "0";
  if (it && it.src) { img.src = it.src + (it.src.includes("?") ? "&" : "?") + "r=" + Date.now(); watch(img, box, it); }
  else start(img);
  return true;
}

/** Every picture under `root`, in the order they're drawn, the ones behind "+N" too (the lightbox's list). */
export function galleryOf(root) {
  const keys = [];
  for (const el of root ? root.querySelectorAll("[data-mx-keys]") : []) {
    let ks = [];
    try { ks = JSON.parse(el.dataset.mxKeys); } catch { /* not ours */ }
    for (const k of ks) if (!keys.includes(k)) keys.push(k);
  }
  return keys.map((k) => REG.get(k)).filter(Boolean);
}

/** Where a picture sits on screen (its tile or frame), or null when it's behind "+N" or gone. */
export function slotOf(root, key) {
  return root ? root.querySelector(`[data-mx="${CSS.escape(key)}"]`) : null;
}

/**
 * A drag out of the conversation saves the file under its real name (Chromium's DownloadURL; Safari's own
 * image drag already does). Wire once on a root.
 */
export function wireDragOut(root) {
  if (!root || root._mxDrag) return;
  root._mxDrag = true;
  root.addEventListener("dragstart", (e) => {
    const img = e.target.closest && e.target.closest("img.mx-img");
    const it = img && REG.get(img.dataset.mxImg);
    if (!it || !img.src || !e.dataTransfer) return;
    try { e.dataTransfer.setData("DownloadURL", `${it.type || "image/png"}:${it.name}:${new URL(img.src, location.href).href}`); } catch { /* not supported */ }
  });
}
