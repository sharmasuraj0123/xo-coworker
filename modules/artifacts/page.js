// @ts-check

// The Artifacts page: everything threads made, across projects; only the lines near the screen are drawn, the filters see the whole set, and stand-ins hold the place while it's read.

import { esc } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";
import { setHtml, setText } from "../../core/ui/motion.js";
import { radioKeys, rovingTab } from "../../core/ui/a11y/keynav.js";
import { ICON } from "../../core/ui/icons/names.js";
import { galleryLines, linesIn } from "../../core/ui/virtual.js";
import { artsView, KINDS } from "./model.js";

/** @param {{ MS: any, PV: any, syncCards: (ul: HTMLElement, items: any[], where: boolean | "page") => void, PROJ: (pid: string) => string, sk: { tile: (where: any, i?: number) => string, bar: (w?: string, cls?: string) => string } }} deps */
export function createArtifactsPage({ MS, PV, syncCards, PROJ, sk }) {
  const A = /** @type {any} */ ({ box: null, kind: "all", pid: "", q: "", lines: null, els: new Map(), byKey: new Map(), M: null, placeT: 0, arrive: false, tio: null });
  const tracks = (/** @type {Element} */ ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").filter(Boolean).length;
  /** The gallery's sizes, read from a hidden heading and stand-in card (so they follow the CSS, the width and the phone). */
  function artsMetrics(/** @type {any} */ be) {
    let p = be.querySelector(":scope > .ar-probe");
    if (!p) {
      p = document.createElement("div");
      p.className = "ar-probe";
      p.setAttribute("aria-hidden", "true");
      p.innerHTML = `<h2 class="ar-gh">Today</h2><ul class="md-grid ar-grid">${sk.tile("page")}</ul>`;
      be.prepend(p);
    }
    const ul = p.querySelector("ul");
    return { cols: Math.max(1, tracks(ul)), gap: parseFloat(getComputedStyle(ul).rowGap) || 0, headH: p.firstElementChild.offsetHeight, cardH: ul.firstElementChild.offsetHeight };
  }
  /** Draw the lines within a screen of view, let the others go. */
  function artsPlace() {
    A.placeT = 0;
    const box = A.box, be = box && box.querySelector("#arts-body");
    if (!be || box.hidden || !A.lines) return;
    const top = box.scrollTop - be.offsetTop, H = box.clientHeight;
    const want = /** @type {any} */ (linesIn)(A.lines, top - H, top + 2 * H);
    const keep = new Set(want.map((/** @type {any} */ l) => l.key));
    // the card you're on stays, wherever the scroll goes; but a card that moved (pinned or unpinned to another group) is drawn where it went, and the line it left goes with the rest, its control taking focus there
    const ae = document.activeElement && be.contains(document.activeElement) ? document.activeElement : null;
    const fCard = /** @type {HTMLElement | null} */ (ae && ae.closest(".md-it")), fKey = fCard && fCard.dataset.k, fCtl = ae && (ae.matches(".md-pin") ? ".md-pin" : ae.matches(".md-from") ? ".md-from" : ".md-open");
    // where that card is now, in the whole layout (not only the lines near the screen: pinned, it can move far above them); moved, its new line is drawn too, wherever it is, and focus lands there
    const at = fKey ? A.lines.find((/** @type {any} */ l) => l.kind === "row" && l.g.items.slice(l.start, l.start + l.n).some((/** @type {any} */ it) => it.key === fKey)) : null;
    const moved = !!at && !(A.els.get(at.key) && A.els.get(at.key).contains(fCard));
    if (moved && !keep.has(at.key)) { want.push(at); want.sort((/** @type {any} */ x, /** @type {any} */ y) => x.y - y.y); keep.add(at.key); }
    const focus = ae && !moved ? ae.closest(".ar-line") : null;
    for (const [k, el] of A.els) {
      if (keep.has(k) || el === focus) continue;
      if (A.tio) for (const c of el.querySelectorAll(".md-it")) A.tio.unobserve(c);
      el.remove();
      A.els.delete(k);
    }
    let prev = be.querySelector(":scope > .ar-probe");
    for (const l of want) {
      let el = A.els.get(l.key);
      if (!el) {
        if (l.kind === "head") { el = document.createElement("h2"); el.className = "ar-gh ar-line"; }
        else if (l.kind === "row") { el = document.createElement("ul"); el.className = "md-grid ar-grid ar-line"; el._seeded = A.arrive; }
        else { el = document.createElement("div"); el.className = "ar-line"; el.setAttribute("aria-hidden", "true"); }
        A.els.set(l.key, el);
      }
      if (l.kind === "tail" && el._n !== l.rows * A.M.cols) { el._n = l.rows * A.M.cols; el.innerHTML = `<ul class="md-grid ar-grid">${Array.from({ length: el._n }, (/** @type {any} */ _, /** @type {any} */ i) => sk.tile("page", i)).join("")}</ul>`; }
      const y = `${l.y}px`;
      if (el.style.top !== y) el.style.top = y;
      if (l.kind === "head") setText(el, l.g.label);
      else if (l.kind === "row") {
        const items = l.g.items.slice(l.start, l.start + l.n);
        syncCards(el, items, "page");
        // pictures: read when their card comes within a screen of view
        if (A.tio) for (const c of el.children) { const m = A.byKey.get(c.dataset.k); if (!c._tw && m && ((m.kind === "image" && !PV.thumbs.has(m.key)) || PV.wantsText(m))) { c._tw = true; A.tio.observe(c); } }
      }
      // in order, so Tab goes card by card down the page
      const at = prev ? prev.nextElementSibling : be.firstElementChild;
      if (at !== el) be.insertBefore(el, at);
      prev = el;
    }
    // landed where it went, brought into view (the page doesn't jump to it otherwise: it stays anchored)
    if (moved) be.querySelector(`.md-it[data-k="${CSS.escape(/** @type {string} */ (fKey))}"] ${fCtl}`)?.focus();
    A.arrive = false;
  }
  function artsWatch(/** @type {any} */ box) {
    const be = box.querySelector("#arts-body");
    box.addEventListener("scroll", () => { if (!A.placeT) A.placeT = requestAnimationFrame(artsPlace); }, { passive: true });
    // a new width (the window, the panel opening beside it) can mean a new number of columns
    if (typeof ResizeObserver === "function") { let w = 0; new ResizeObserver(() => { if (!box.hidden && be.clientWidth && be.clientWidth !== w) { w = be.clientWidth; if (A.lines) artsRender(); } }).observe(be); }
    if (typeof IntersectionObserver === "function") {
      A.tio = new IntersectionObserver((/** @type {any} */ es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          A.tio.unobserve(e.target);
          const m = A.byKey.get(e.target.dataset.k);
          if (m) { PV.nearY.set(m.key, { y: e.boundingClientRect.top - e.rootBounds.top + A.box.scrollTop }); PV.loadThumbs([m]); PV.loadTexts([m]); }
        }
      }, { root: box, rootMargin: "50% 0px" });
    }
  }
  function artsRender() {
    const box = A.box || (A.box = document.getElementById("arts"));
    if (!box || box.hidden) return; // nothing is measured or drawn unseen
    if (!box._built) {
      box.innerHTML = `<header class="ar-head"><span class="tw-ic" aria-hidden="true">${ICON.stack}</span><span class="tw-t"><h1 id="arts-h">Artifacts</h1><p class="pj-s ar-sub" id="arts-sub"></p></span></header><div class="ar-wrap">` +
        `<div class="ar-tools"><label class="ar-q">${ICON.search}<span class="sr-only">Find an artifact</span><input id="arts-q" placeholder="Find an artifact" autocomplete="off" spellcheck="false"></label>` +
        `<label class="ar-pj"><span class="sr-only">Project</span><xo-select id="arts-pj"></xo-select></label></div>` +
        `<div class="ar-kinds" id="arts-f" role="radiogroup" aria-label="Show"></div><div class="ar-body" id="arts-body"></div></div>`;
      box._built = true;
      box.addEventListener("input", (/** @type {any} */ e) => { if (e.target.id === "arts-q") { A.q = e.target.value; artsRender(); } });
      box.addEventListener("change", (/** @type {any} */ e) => { if (e.target.id === "arts-pj") { A.pid = e.target.value; artsRender(); } });
      box.addEventListener("click", (/** @type {any} */ e) => { const k = e.target.closest("[data-arts-kind]"); if (k) { A.kind = k.dataset.artsKind; artsRender(); } });
      box.addEventListener("keydown", (/** @type {any} */ e) => { if (e.key === "Escape" && e.target.id === "arts-q" && e.target.value) { e.preventDefault(); e.stopPropagation(); e.target.value = ""; A.q = ""; artsRender(); } });
      artsWatch(box);
    }
    const pending = MS.madePending(null);
    const all = pending ? [] : MS.madeOf(null);
    if (!pending) MS.olderPages(); // what's older than each chat's newest page, read in the background
    const v = artsView(all, { pid: A.pid, kind: A.kind, q: A.q });
    setHtml(box.querySelector("#arts-sub"), pending ? sk.bar("18em") : all.length ? esc(`${all.length} ${all.length === 1 ? "thing" : "things"} your threads made, newest first`) : "What your threads make shows up here");
    // projects that made something, in the sidebar's order
    const made = new Set(all.map((/** @type {any} */ m) => m.project));
    const pids = MS.projectsMade().filter((/** @type {any} */ p) => made.has(p.id));
    const opts = `<option value="">All projects</option>` + pids.map((/** @type {any} */ p) => `<option value="${esc(p.id)}"${A.pid === p.id ? " selected" : ""}>${esc(p.name || p.id)}</option>`).join("");
    setHtml(box.querySelector("#arts-pj"), opts);
    // the kinds: one Tab stop (the chosen one), arrows choose (radioKeys), drawn in place so the focused one stays the kind you chose stays in the strip even where it has nothing (another project): one choice checked and one Tab stop, always
    const kf = box.querySelector("#arts-f"), kh = KINDS.filter(([k]) => k === "all" || v.counts[k] || k === A.kind).map(([k, w]) => `<button type="button" role="radio" data-arts-kind="${k}" aria-checked="${A.kind === k}"${rovingTab(A.kind === k)}>${w}<span>${pending ? "" : v.counts[k] || 0}</span></button>`).join("");
    if (kf._h !== kh) { redraw(kf, kh); kf._h = kh; }
    if (!kf._keys) { kf._keys = true; radioKeys(kf); }
    // Images is the one filter shown as pictures on a phone; everything else is a list of rows (css/artifacts.css)
    box.classList.toggle("is-pics", A.kind === "image");
    const be = box.querySelector("#arts-body");
    // a new filter is a new list: drawn afresh, still
    const scope = `${A.pid}|${A.kind}|${A.q}|${pending ? "…" : ""}`;
    if (be._scope !== scope) {
      A.arrive = /…$/.test(be._scope || ""); // what was being read has come: its first cards arrive
      be._scope = scope; be._h = null; be.innerHTML = ""; be.style.height = "";
      A.els = new Map(); A.lines = null;
    }
    if (pending || !v.groups.length) {
      // still reading: a screen of stand-ins in the gallery's own shape; or nothing to show
      const html = pending ? `<section class="ar-g" aria-hidden="true"><h2 class="ar-gh">${sk.bar("64px")}</h2><ul class="md-grid ar-grid">${Array.from({ length: 12 }, (/** @type {any} */ _, /** @type {any} */ i) => sk.tile("page", i)).join("")}</ul></section>`
        : `<p class="ar-none">${!all.length ? "<b>Nothing made yet.</b> Files, pages and pictures your threads share land here, newest first."
          : A.q ? `Nothing matches “${esc(A.q)}”.`
          : `No ${esc(((KINDS.find(([k]) => k === A.kind) || [])[1] || "things").toLowerCase())} ${A.pid ? "in this project" : "yet"}.`}</p>`;
      if (be._h !== html) { be.innerHTML = html; be._h = html; be.style.height = ""; A.els = new Map(); A.lines = null; }
      return;
    }
    if (be._h) { be.innerHTML = ""; be._h = null; A.els = new Map(); }
    const M = (A.M = artsMetrics(be));
    A.byKey = new Map();
    for (const g of v.groups) for (const m of g.items) A.byKey.set(m.key, m);
    // older pages still on their way: two rows of stand-ins under the list
    const reading = MS.olderLeft();
    // what you're looking at stays where it is when things land above it (a new thing at the top, a pinned one from an older page): the first card in view is the anchor, and the scroll follows it
    const view = box.scrollTop - be.offsetTop;
    let anchor = null;
    if (A.lines && view > 0) {
      const l = /** @type {any} */ (linesIn)(A.lines, view, view).find((/** @type {any} */ x) => x.kind === "row");
      if (l) anchor = { key: l.g.items[l.start]?.key, off: l.y - view };
    }
    const { lines, height } = galleryLines(v.groups, { cols: M.cols, cardH: M.cardH, headH: M.headH, gap: M.gap, tail: reading ? 2 : 0 });
    A.lines = lines;
    const h = `${height}px`;
    if (be.style.height !== h) be.style.height = h;
    if (anchor && anchor.key) {
      const l = lines.find((/** @type {any} */ x) => x.kind === "row" && x.g.items.slice(x.start, x.start + x.n).some((/** @type {any} */ m) => m.key === anchor.key));
      const to = l ? Math.round(be.offsetTop + l.y - anchor.off) : null;
      if (to != null && Math.abs(to - box.scrollTop) >= 1) box.scrollTop = to;
    }
    artsPlace();
  }

  return { render: artsRender, box: () => A.box };
}
