// @ts-check

// A made thing's card, the same everywhere (the panel's Made, Home's strip, the Artifacts page): made once, then updated in place.

import { esc, short } from "../../core/platform/index.js";
import { gitState } from "../../core/services/git-state.js";
import { syncList, fadeImage, setHtml, setText } from "../../core/ui/motion.js";
import { ICON } from "../../core/ui/icons/names.js";
import { fileIcon, fileColor } from "../../core/ui/icons/fileicons.js";
import { KIND_WORD } from "./model.js";

/** @typedef {boolean | "page"} Where */

/** A kind's icon: links and branches, and ⌘K's made rows. */
export const KIND_IC = /** @type {Record<string, string>} */ ({ image: ICON.image, page: ICON.globe, doc: ICON.doc, data: ICON.list, code: ICON.edit, link: ICON.arrow, branch: ICON.branch });

/** @param {{ PV: any, PROJ: (pid: string) => string, naming: (m: any, max?: number) => any }} deps */
export function createCards({ PV, PROJ, naming: madeNaming }) {
  /** On the Artifacts page and Home's strip a card shows the thing itself on a well tinted in its file icon's colour: a picture from its top left, a document's title and first words, code's first lines; the kind's icon stays for a phone's one-line rows. @param {any} m */
  function wellHtml(m) {
    // every well takes its file icon's colour, pictures too
    const tint = fileColor(m.name || m.path) || "";
    const wt = tint ? ` style="--wt:${esc(tint)}"` : "";
    // drawn at once: until its preview lands the well holds the kind's icon, already in its colour
    const wait = () => (PV.previewable(m) && !PV.failed.has(m.key) ? `<span class="md-well is-wait"${wt}>${iconHtml(m)}</span>` : "");
    if (m.kind === "image") { const u = PV.thumbs.get(m.key); return u ? `<span class="md-well"${wt}><img class="md-pic" src="${esc(u)}" alt="" decoding="async"></span>` : wait(); }
    const p = PV.texts.get(m.key);
    if (!p) return wait();
    const page = p.kind === "doc"
      ? `${p.title ? `<span class="md-pt">${esc(p.title)}</span>` : ""}<span class="md-pp">${esc(p.text)}</span>`
      : `<span class="md-pl">${p.lines.map((/** @type {string} */ l) => esc(l) || " ").join("\n")}</span>`;
    return `<span class="md-well"${wt}><span class="md-sheet${p.kind === "doc" ? " is-doc" : ""}">${page}</span></span>`;
  }
  /** @param {any} m @param {Where} where */
  function thumbHtml(m, where) {
    // the Artifacts page and Home's Recently made show the thing itself, on its colour
    if (where === "page" || where === true) { const w = wellHtml(m); if (w) return w + iconHtml(m); }
    if (m.kind === "image") {
      const u = PV.thumbs.get(m.key);
      if (u) return `<img src="${esc(u)}" alt="" loading="lazy" decoding="async">`;
    }
    return iconHtml(m);
  }
  /** @param {any} m */
  function iconHtml(m) {
    const tag = m.kind === "link" ? hostOf(m.url) : m.kind === "branch" ? gitState(null, m.git).word || "branch" : (/\.([\w-]+)$/.exec(m.name) || [])[1] || /** @type {Record<string, string>} */ (KIND_WORD)[m.kind];
    const ic = m.kind === "link" || m.kind === "branch" ? KIND_IC[m.kind] : fileIcon(m.name || m.path);
    return `<span class="md-ic">${ic}</span><span class="md-ext${m.kind === "link" || m.kind === "branch" ? " is-word" : ""}">${esc(tag)}</span>`;
  }
  /** @param {string} u */
  const hostOf = (u) => { try { return new URL(u).host; } catch { return "link"; } };
  /** @param {number | null | undefined | ""} n */
  const size = (n) => (n == null || n === "" ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
  /** A card. where: false in a project's Made, true on Home's strip (the project instead of the kind), "page" on the Artifacts page (the project, the kind and the thread that made it). @param {any} m @param {{ where?: Where }} [opts] */
  function cardHtml(m, { where = false } = {}) {
    const ago = short(m.at) === "now" ? "now" : short(m.at) + " ago";
    const n = madeNaming(m);
    // a titled file's name takes the kind word's place (its thumbnail already says the kind); gone says gone
    const what = m.exists === false ? "Gone" : m.title ? n.file : /** @type {Record<string, string>} */ (KIND_WORD)[m.kind];
    // on the page a card says where it's from, what it is and when; its size is in the file itself
    const meta = (where === "page" ? [PROJ(m.project), what, ago] : [what, size(m.bytes), ago]).filter(Boolean).join(" · ");
    return `<li class="md-it${m.pinned ? " is-pin" : ""}${m.exists === false ? " is-gone" : ""}">` +
      `<button type="button" class="md-open" data-made-file="${esc(m.key)}" title="${esc(n.tip)}" aria-label="Open ${esc(n.label)}"><span class="md-th k-${m.kind}${(where === "page" || where === true) && ((m.kind === "image" ? PV.thumbs.get(m.key) : PV.texts.get(m.key)) || (PV.previewable(m) && !PV.failed.has(m.key))) ? " has-well" : ""}">${thumbHtml(m, where)}</span>` +
      `<span class="md-meta"><b>${n.html}</b><span>${esc(where === true ? `${PROJ(m.project)} · ${ago}` : meta)}</span></span></button>` +
      (where === true ? "" : m.tid ? `<button type="button" class="md-from" data-made-go="t:${esc(m.tid)}" title="Open the thread that made it">${ICON.threadOne}<span>${esc(n.from)}</span></button>`
        : where === "page" ? `<span class="md-from is-none" aria-hidden="true"><span>&nbsp;</span></span>` : "") + // on the page every card is one height
      `<button type="button" class="md-pin" data-made-pin="${esc(m.key)}" aria-pressed="${m.pinned}" aria-label="${m.pinned ? "Unpin" : "Pin"} ${esc(n.label)}" title="${m.pinned ? "Unpin" : "Pin it on top"}">${ICON.pin}</button></li>`;
  }

  // A card is made once and then updated in place: its time, pin and picture change without redrawing it, so a picture never flashes
  const tpl = document.createElement("template");
  /** @param {Where} where @returns {(m: any) => any} */
  const cardMake = (where) => (m) => {
    const html = cardHtml(m, { where });
    tpl.innerHTML = html.trim();
    const el = /** @type {any} */ (tpl.content.firstElementChild);
    el._sig = html;
    const th = /** @type {any} */ (el.querySelector(".md-th"));
    th._h = th.innerHTML;
    fadeImage(th.querySelector("img"));
    return el;
  };
  /** @param {Where} where @returns {(el: any, m: any) => void} */
  const cardUpdate = (where) => (el, m) => {
    const html = cardHtml(m, { where });
    if (el._sig === html) return; // nothing about it changed: not even parsed again (a page can hold thousands)
    el._sig = html;
    tpl.innerHTML = html.trim();
    const nx = /** @type {any} */ (tpl.content.firstElementChild);
    el.className = nx.className;
    const th = el.querySelector(".md-th"), th2 = nx.querySelector(".md-th");
    if (th && th2) { th.className = th2.className; if (setHtml(th, th2.innerHTML)) fadeImage(th.querySelector("img")); }
    setHtml(el.querySelector(".md-meta b"), nx.querySelector(".md-meta b").innerHTML); // a name cut in the middle is two spans
    // the meta's own line (its age), not a span inside a name cut in the middle
    setText(el.querySelector(".md-meta > span"), nx.querySelector(".md-meta > span").textContent);
    const fr = el.querySelector(".md-from span"), fr2 = nx.querySelector(".md-from span");
    if (fr && fr2) setText(fr, fr2.textContent);
    for (const sel of [".md-open", ".md-pin"]) {
      const a = el.querySelector(sel), b = nx.querySelector(sel);
      if (a && b) for (const at of ["title", "aria-label", "aria-pressed", "data-made-file", "data-made-pin"]) { const v = b.getAttribute(at); if (v != null && a.getAttribute(at) !== v) a.setAttribute(at, v); }
    }
  };
  /** @param {HTMLElement} ul @param {any[]} items @param {Where} where */
  const syncCards = (ul, items, where) => syncList(ul, items, { make: cardMake(where), update: cardUpdate(where) });

  return { syncCards };
}
