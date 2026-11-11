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
// A file an agent shared may have a title in plain words (xo-space 8c6bc03); it names the file wherever it's
// shown (the picture's label, the lightbox, a card, Made), with the file name kept beside it or in a
// tooltip, so nothing is lost. A file name too long for its place is cut in its middle, its extension and
// the end of its stem kept (r3-dark…title.png): those tell files apart. A title is cut at its end.
// Pictures from the web (markdown's `![alt](https://…)`, js/markdown.js) are drawn here too, read straight
// from their host: no referrer, lazily, never with credentials. Their size is unknown until they load, so
// they get the fixed 16:10 frame and keep it. One that can't show (hotlinking refused, gone) becomes the
// outbound link it would have been, its alt or host as the words; never a broken-image icon.
//
// The layout math (fitImage, albumLayout, dedupeByMade) is pure and tested from Node
// (tests/media.test.mjs). The DOM part (hydrateMedia) only runs in a browser.

import { esc, isImagePath } from "./util.js";
import { fileIcon } from "./fileicons.js";
import { ICON } from "./ui.js";
import { api, attachmentUrl } from "./api.js";
import { fmtSize, typeWord, titleOf } from "./attach.js";
import { fadeImage, EASE, MOVE, still } from "./motion.js";
import { ARROW_OUT, outText } from "./markdown.js";

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

// ── names: a title, else the file name, cut in the middle ──────────────────────
/** How much of a stem's end a cut name keeps: enough for "-v2", "final", "320". */
export const TAIL = 5;
/** A file name's stem and its extension (".png"; "" for none, a dotfile, or a dot that ends no extension). */
export function splitExt(name) {
  const s = String(name ?? "");
  const m = /^(.+?)(\.[A-Za-z0-9]{1,10})$/.exec(s);
  return m ? { stem: m[1], ext: m[2] } : { stem: s, ext: "" };
}
/**
 * A file name in at most `max` characters, cut in its middle: the start, "…", the stem's last TAIL
 * characters and the extension (r3-dark…title.png). Short enough already: as it is.
 */
export function midName(name, max = 32) {
  const s = String(name ?? "");
  if (s.length <= max) return s;
  const { stem, ext } = splitExt(s);
  let tail = Math.min(TAIL, stem.length - 1);
  let head = max - 1 - tail - ext.length;
  if (head < 1) { tail = Math.max(0, tail + head - 1); head = 1; }
  if (head + 1 + tail + ext.length > max) return s.slice(0, Math.max(1, max - 1)) + "…"; // no room for the extension
  return stem.slice(0, head) + "…" + (tail ? stem.slice(-tail) : "") + ext;
}
/**
 * A file name as HTML that cuts in its middle to fit its box, however wide (css/media.css .mx-mid): the
 * start gives way with an ellipsis, the stem's end and the extension stay whole. `after` rides with the
 * kept end (a card's " · Markdown · 2 KB"), so only the name ever gives way. Short names are text.
 */
export function midNameHtml(name, after = "") {
  const s = String(name ?? "");
  const { stem, ext } = splitExt(s);
  const tail = Math.min(TAIL, stem.length - 1);
  if (s.length <= 12 || tail < 1) return esc(s + after);
  return `<span class="mx-mid"><span class="mx-mh">${esc(stem.slice(0, -tail))}</span><span class="mx-mt">${esc(stem.slice(-tail) + ext + after)}</span></span>`;
}
/** What names an item: its title, else its file name. */
export const labelOf = (it) => (it && (it.title || it.name)) || "";

// ── items: every source in one shape ─────────────────────────────────────────
// {key, kind: image|file, name, title (null when none), type, bytes, w, h, tint, made, by, at, and how it's read:
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
    name, title: titleOf(raw.title) || null, type, bytes: raw.bytes ?? null,
    w: dim(raw.w), h: dim(raw.h), tint: safeTint(raw.tint),
    made: raw.made_id ? String(raw.made_id) : raw.made || null,
    by: raw.by || "", at: raw.at ?? null,
    src: raw.src || null, att: raw.att || null, project: raw.project || null, rel: raw.rel || null,
    path: raw.path || null, why: raw.why || null, web: raw.web || null,
  };
  const readable = !!(it.src || it.att || (it.project && it.rel));
  it.kind = it.web || (readable && isPicture(type, name)) ? "image" : "file";
  return it;
}

/**
 * A picture from the web ({alt, url}, from markdown). Its name is the address's last part (else its host);
 * its alt, when it has one, is its title. by: its host, which the lightbox names.
 */
export function fromWebImage({ alt = "", url }, { at = null } = {}) {
  let host = "", file = "";
  try { const u = new URL(url); host = u.host.replace(/^www\./i, ""); file = decodeURIComponent(u.pathname.split("/").pop() || ""); } catch { /* checked by markdown.js */ }
  return mediaItem({ key: `web:${url}`, name: file || host || "picture", title: alt, src: url, web: { url, host }, by: host, at });
}

// ── pictures from the web that couldn't show ────────────────────────────────
const gone = new Set(); // addresses that failed in this page: drawn as their links from then on, not tried again
/** A web picture as the outbound link it would have been: underlined with ↗, its alt as the words, else its host. */
export function webLinkHtml(it) {
  const w = it.web || {};
  // set like any outbound link (js/markdown.js outText): its last word, or an address's last piece, keeps the ↗
  const words = it.title ? outText(it.title) : outText(w.host || w.url, { address: true });
  return `<a href="${esc(w.url)}" target="_blank" rel="noopener noreferrer nofollow" class="lk lk-out mx-weblink" title="${esc(w.url)}">${words}</a>`;
}
/** Has this web picture failed in this page? (then it's a link) */
export const webGone = (url) => gone.has(String(url));
/** Note that a web picture couldn't show: the next drawing of it is its link. */
export function markWebGone(url) { gone.add(String(url)); }
/**
 * Pictures from the web, as markdown found them ({alt, url}): one picture or an album, the ones that
 * already failed in this page as their links under it.
 */
export function webImagesHtml(list) {
  const items = (list || []).map((x) => fromWebImage(x));
  const show = items.filter((it) => !gone.has(it.web.url)), links = items.filter((it) => gone.has(it.web.url));
  const linkP = links.length ? `<p class="mx-weblinks">${links.map(webLinkHtml).join("")}</p>` : "";
  return show.length ? mediaHtml(show, { side: "them" }).replace(/<\/div>$/, `${linkP}</div>`) : `<div class="mx-stack mx-them">${linkP}</div>`;
}

/**
 * A file on a message: an upload of yours ({id}, read through its chat) or a file an agent shared
 * ({project_id, relative_path}, read from its project). by: who made it, for the lightbox's caption.
 */
export function fromAttachment(f, { chat = null, by = "", at = null } = {}) {
  const c = f.chat || chat;
  const base = { name: f.name, title: f.title, type: f.type, bytes: f.bytes ?? f.size, w: f.w, h: f.h, tint: f.tint, made_id: f.made_id, by, at };
  if (f.id && c) return mediaItem({ ...base, key: `att:${c}:${f.id}`, att: { chat: c, id: String(f.id) }, src: attachmentUrl(c, f.id) });
  if (f.project_id && f.relative_path) return mediaItem({ ...base, key: `prj:${f.project_id}:${f.relative_path}`, project: String(f.project_id), rel: String(f.relative_path), path: f.path || f.relative_path });
  return mediaItem({ ...base, key: `none:${f.name || ""}` }); // not uploaded yet: a card that can't open
}

/**
 * A file in a turn's shared_files block. Newer servers send its project route; older blocks only have
 * the agent's path, which `route(path)` resolves ({project, rel} or {why}; timeline.js sharedFileRoute).
 */
export function fromSharedFile(f, { route = null, by = "", at = null } = {}) {
  const base = { name: f.name || f.path, title: f.title, type: f.type, bytes: f.bytes, w: f.w, h: f.h, tint: f.tint, made_id: f.made_id, path: f.path || f.name, by, at };
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

/**
 * The <img>: a direct URL loads by itself; a project file is fetched by hydrateMedia (it needs a header).
 * A web picture tells its host nothing of where it's shown (no referrer) and sends no credentials (no
 * crossorigin attribute, so no CORS request either).
 */
function imgHtml(it, cls = "") {
  const src = it.src ? ` src="${esc(it.src)}" loading="lazy"` : "";
  const web = it.web ? ` referrerpolicy="no-referrer" data-mx-web` : "";
  return `<img class="mx-img${cls}" data-mx-img="${esc(it.key)}"${web}${src} alt="${esc(labelOf(it))}" decoding="async" draggable="true">`;
}
/** A titled picture's tooltip names its file too (nothing on the picture says it otherwise); a web picture's, its host. */
const tipAttr = (it) => (it.web ? ` title="${esc(`${labelOf(it)} · ${it.web.host}`)}"` : it.title ? ` title="${esc(`${it.title} · ${it.name}`)}"` : "");
/** Loading… and Couldn't load, said on the picture itself (hydrateMedia fills it). */
const STATE = `<span class="mx-state" aria-hidden="true"></span>`;

function oneHtml(it, side) {
  const L = LIMITS[side] || LIMITS.them;
  const f = fitImage(it.w, it.h, L.w, L.h);
  const style = [`--mx-w:${f.w}px`, `--mx-r:${r6(f.w / f.h)}`, it.tint && `--mx-tint:${it.tint}`, f.mode === "tiny" && `--mx-iw:${f.iw}px;--mx-ih:${f.ih}px`].filter(Boolean).join(";");
  const tag = f.mode === "long" ? `<span class="mx-tag">Long image · ${it.w} × ${it.h}</span>` : "";
  const label = ["Open " + labelOf(it), "image", sizeWords(it)].filter(Boolean).join(", ");
  return `<button type="button" class="mx-one is-${f.mode}" data-mx="${esc(it.key)}" style="${style}" aria-label="${esc(label)}"${tipAttr(it)}>${imgHtml(it)}${tag}${STATE}</button>`;
}

function albumHtml(list, side) {
  const L = LIMITS[side] || LIMITS.them;
  const lay = albumLayout(list.map((it) => (it.w && it.h ? it.w / it.h : NaN)), { W: L.w, maxH: L.h });
  const n = list.length;
  const rows = lay.rows.map((row) => `<div class="mx-row" style="--mx-r:${r6(lay.w / row.h)}">` + row.tiles.map((t) => {
    const it = list[t.i];
    const last = lay.more && t.i === MAX_TILES - 1;
    const label = last ? `Open ${labelOf(it)} and ${lay.more - 1} more ${lay.more - 1 === 1 ? "picture" : "pictures"}` : `Open ${labelOf(it)}, image ${t.i + 1} of ${n}`;
    const style = [`--mx-g:${t.w}`, it.tint && `--mx-tint:${it.tint}`].filter(Boolean).join(";");
    return `<button type="button" class="mx-tile" data-mx="${esc(it.key)}" style="${style}" aria-label="${esc(label)}"${tipAttr(it)}>${imgHtml(it)}${STATE}` +
      (last ? `<span class="mx-more" aria-hidden="true">+${lay.more}</span>` : "") + `</button>`;
  }).join("") + `</div>`).join("");
  return `<div class="mx-album" role="group" aria-label="${n} pictures" style="--mx-w:${lay.w}px">${rows}</div>`;
}

/**
 * A file that isn't a picture: today's file card, with its Pierre icon. Titled, the title leads and the
 * file name opens its second line; untitled, the name leads, cut in its middle when it must be.
 */
function cardHtml(it) {
  const meta = [it.type ? typeWord(it.type, it.name) : "", fmtSize(it.bytes)].filter(Boolean).join(" · ");
  // a titled file's name opens the second line, and is what gives way there (its type and size stay)
  const second = it.title ? midNameHtml(it.name, meta ? ` · ${meta}` : "") : esc(meta);
  const can = !!(it.att || it.project || it.why);
  return `<li class="tb-file"><button type="button" class="tb-fb" ${can ? `data-mx="${esc(it.key)}" aria-label="Open ${esc(labelOf(it))}"` : "disabled"} title="${esc(it.path || it.name)}">` +
    `<span class="tb-fi">${fileIcon(it.name)}</span><span class="tb-ft"><span class="tb-fn">${it.title ? esc(it.title) : midNameHtml(it.name)}</span><span class="tb-fm">${second}</span></span>` +
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
  if (box && box.classList.contains("mx-one") && box.classList.contains("is-frame")) settle(img, box);
  touch(shown, key, img);
  while (shown.size > CACHE_MAX) shown.delete(shown.keys().next().value);
}
/**
 * A lone picture of unknown size (a web picture, an old upload) waited in the 16:10 frame so nothing
 * jumped; once its size is known, the frame settles to the picture's own shape in one glide (320 ms)
 * instead of keeping bars beside it. Only when it isn't above what you're reading: there, a change of
 * height would move the text under your eyes, so it keeps the frame. Never taller than its side's cap.
 */
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
function failed(img, box, it) {
  clearTimeout(img._mxSlow);
  img.style.opacity = "0";
  if (it && it.web) { webFailed(box, it); return; }
  stateOf(box, "is-err", `Couldn't load ${it ? labelOf(it) : "this picture"} · Retry`);
}
/**
 * A web picture that couldn't show turns into its link where it was: a lone picture is replaced by it; an
 * album loses the tile (its row closes up) and the link joins the line under it. The lightbox forgets it.
 */
function webFailed(box, it) {
  markWebGone(it.web.url);
  const stack = box && box.closest(".mx-stack");
  if (!stack || box._mxGone) return;
  box._mxGone = true;
  try {
    const ks = JSON.parse(stack.dataset.mxKeys || "[]").filter((k) => k !== it.key);
    if (ks.length) stack.dataset.mxKeys = JSON.stringify(ks); else delete stack.dataset.mxKeys;
  } catch { /* not ours */ }
  let line = stack.querySelector(":scope > .mx-weblinks");
  const fresh = !line;
  if (fresh) { line = document.createElement("p"); line.className = "mx-weblinks"; }
  line.insertAdjacentHTML("beforeend", webLinkHtml(it));
  const album = box.closest(".mx-album");
  if (!album) { if (fresh) box.replaceWith(line); else box.remove(); return; }
  const row = box.closest(".mx-row");
  box.remove();
  if (row && !row.querySelector(".mx-tile")) row.remove();
  if (!album.querySelector(".mx-tile")) { if (fresh) album.replaceWith(line); else album.remove(); }
  else if (fresh) album.after(line);
}
// a web picture can fail anywhere it's drawn (an ask's excerpt, a document), not only where hydrateMedia
// watches: one listener catches them all (an <img>'s error doesn't bubble, so it's caught on the way down)
if (typeof document !== "undefined") {
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (!img || !img.matches || !img.matches("img[data-mx-web]")) return;
    const it = REG.get(img.dataset.mxImg);
    if (it) failed(img, img.closest(".mx-one,.mx-tile"), it);
  }, true);
}
// a control whose face is a picture says hover and press with a veil over it (css/media.css), chosen against the
// picture: its tone is read once per picture (8×8 of it, the mean luminance) as the pointer comes over it, before the
// hover draws. A veil in the theme's ink vanished over a picture of that tone (the controls grader on aba434f, S233: a
// black picture in light, hover and held identical to rest). One that can't be read (from elsewhere) keeps the ink's
export const PICTURE_FACE = ".mx-one, .mx-tile, button.att-ic.is-img";
const TONE = new Map();
export function pictureTone(img) {
  const k = img.currentSrc || img.src;
  if (!k || !img.complete || !img.naturalWidth) return "";
  if (TONE.has(k)) return TONE.get(k);
  let t = "";
  try {
    const c = document.createElement("canvas"); c.width = c.height = 8;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data; let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 16) continue; sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
    if (n) t = sum / n < 128 ? "dark" : "light";
  } catch { /* a picture from elsewhere taints the canvas: the ink's veil */ }
  TONE.set(k, t); return t;
}
if (typeof document !== "undefined") {
  document.addEventListener("pointerover", (e) => {
    const face = e.target && e.target.closest && e.target.closest(PICTURE_FACE);
    if (!face) return;
    const t = pictureTone(face.querySelector("img") || {});
    if (t) { if (face.dataset.tone !== t) face.dataset.tone = t; } else if (face.dataset.tone) delete face.dataset.tone;
  }, true);
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
