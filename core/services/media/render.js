// @ts-check

import { esc } from "../../platform/index.js";
import { fileIcon } from "../../ui/icons/fileicons.js";
import { ICON } from "../../ui/icons/names.js";
import { outText } from "../../ui/markdown/inline.js";
import { fmtSize, typeWord } from "./attachment-rules.js";
import { LIMITS, MAX_TILES, fitImage, albumLayout } from "./layout.js";
import { labelOf, midNameHtml, fromWebImage } from "./items.js";
import { webGone } from "./cache.js";
import { stackAttrs } from "./stack-data.js";

/** @typedef {ReturnType<typeof import("./items.js").mediaItem>} MediaItem */

/** A web picture as the outbound link it would have been: underlined with ↗, its alt as the words, else its host. @param {MediaItem} it */
export function webLinkHtml(it) {
  const w = /** @type {Partial<NonNullable<MediaItem["web"]>>} */ (it.web || {});
  const words = it.title ? outText(it.title) : outText(/** @type {string} */ (w.host || w.url), { address: true });
  return `<a href="${esc(w.url)}" target="_blank" rel="noopener noreferrer nofollow" class="lk lk-out mx-weblink" title="${esc(w.url)}">${words}</a>`;
}
/** @param {readonly Parameters<typeof fromWebImage>[0][] | null | undefined} list */
export function webImagesHtml(list) {
  const items = (list || []).map((x) => fromWebImage(x));
  const show = items.filter((it) => !webGone(/** @type {NonNullable<MediaItem["web"]>} */ (it.web).url)), links = items.filter((it) => webGone(/** @type {NonNullable<MediaItem["web"]>} */ (it.web).url));
  const linkP = links.length ? `<p class="mx-weblinks">${links.map(webLinkHtml).join("")}</p>` : "";
  return show.length ? mediaHtml(show, { side: "them" }).replace(/<\/div>$/, `${linkP}</div>`) : `<div class="mx-stack mx-them">${linkP}</div>`;
}


/** @param {number} x */
const r6 = (x) => Math.round(x * 1e6) / 1e6;
/** @param {MediaItem} it */
const sizeWords = (it) => (it.w && it.h ? `${it.w} by ${it.h}` : "");

/** @param {MediaItem} it */
function imgHtml(it, cls = "") {
  const src = it.src ? ` src="${esc(it.src)}" loading="lazy"` : "";
  const web = it.web ? ` referrerpolicy="no-referrer" data-mx-web` : "";
  return `<img class="mx-img${cls}" data-mx-img="${esc(it.key)}"${web}${src} alt="${esc(labelOf(it))}" decoding="async" draggable="true">`;
}
/** A titled picture's tooltip names its file too (nothing on the picture says it otherwise); a web picture's, its host. @param {MediaItem} it */
const tipAttr = (it) => (it.web ? ` title="${esc(`${labelOf(it)} · ${it.web.host}`)}"` : it.title ? ` title="${esc(`${it.title} · ${it.name}`)}"` : "");
/** Loading… and Couldn't load, said on the picture itself (hydrateMedia fills it). */
const STATE = `<span class="mx-state" aria-hidden="true"></span>`;

/** @param {MediaItem} it @param {keyof typeof LIMITS} side */
function oneHtml(it, side) {
  const L = LIMITS[side] || LIMITS.them;
  const f = fitImage(it.w, it.h, L.w, L.h);
  const style = [`--mx-w:${f.w}px`, `--mx-r:${r6(f.w / f.h)}`, it.tint && `--mx-tint:${it.tint}`, f.mode === "tiny" && `--mx-iw:${f.iw}px;--mx-ih:${f.ih}px`].filter(Boolean).join(";");
  const tag = f.mode === "long" ? `<span class="mx-tag">Long image · ${it.w} × ${it.h}</span>` : "";
  const label = ["Open " + labelOf(it), "image", sizeWords(it)].filter(Boolean).join(", ");
  return `<button type="button" class="mx-one is-${f.mode}" data-mx="${esc(it.key)}" style="${style}" aria-label="${esc(label)}"${tipAttr(it)}>${imgHtml(it)}${tag}${STATE}</button>`;
}

/** @param {MediaItem[]} list @param {keyof typeof LIMITS} side */
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

/** @param {MediaItem} it */
function cardHtml(it) {
  const meta = [it.type ? typeWord(it.type, it.name) : "", fmtSize(it.bytes)].filter(Boolean).join(" · ");
  // a titled file's name opens the second line, and is what gives way there (its type and size stay)
  const second = it.title ? midNameHtml(it.name, meta ? ` · ${meta}` : "") : esc(meta);
  const can = !!(it.att || it.project || it.why);
  return `<li class="tb-file"><button type="button" class="tb-fb" ${can ? `data-mx="${esc(it.key)}" aria-label="Open ${esc(labelOf(it))}"` : "disabled"} title="${esc(it.path || it.name)}">` +
    `<span class="tb-fi">${fileIcon(it.name)}</span><span class="tb-ft"><span class="tb-fn">${it.title ? esc(it.title) : midNameHtml(it.name)}</span><span class="tb-fm">${second}</span></span>` +
    (can ? `<span class="tb-fo" aria-hidden="true">Open${ICON.chevron}</span>` : "") + `</button></li>`;
}

/** @param {readonly (MediaItem | null | undefined)[] | null | undefined} items @param {{side?: keyof typeof LIMITS, caption?: string}} [options] */
export function mediaHtml(items, { side = "them", caption = "" } = {}) {
  const list = /** @type {MediaItem[]} */ ((items || []).filter(Boolean));
  if (!list.length) return "";
  const pics = list.filter((it) => it.kind === "image");
  const files = list.filter((it) => it.kind !== "image");
  let html = "";
  if (pics.length === 1) html += oneHtml(pics[0], side);
  else if (pics.length > 1) html += albumHtml(pics, side);
  if (files.length) html += `<ul class="tb-fl${side === "you" ? " m-files" : ""} mx-files" aria-label="Files">${files.map(cardHtml).join("")}</ul>`;
  if (caption) html += `<p class="mx-cap">${esc(caption)}</p>`;
  return `<div class="mx-stack mx-${side === "you" ? "you" : "them"}"${stackAttrs(list, pics)}>${html}</div>`;
}
