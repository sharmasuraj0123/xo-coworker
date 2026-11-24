// @ts-check


import { esc } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";
import { seedList, setText } from "../../core/ui/motion.js";
import { radioKeys, rovingTab } from "../../core/ui/a11y/keynav.js";
import { ICON } from "../../core/ui/icons/names.js";
import { galleryLines, linesIn } from "../../core/ui/virtual.js";
import { artsView, KINDS } from "./model.js";

/** @import { GalleryState, GalleryDeps } from "./page-types.d.ts" */

/** @param {GalleryDeps} deps */
export function createArtifactsPage({ MS, PV, syncCards, PROJ, sk }) {
  const A = /** @type {GalleryState} */ ({ kind: "all", pid: "", q: "", els: new Map(), byKey: new Map() });
  const observed = new WeakSet();
  const tracks = (/** @type {Element} */ ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").filter(Boolean).length;
  /** The gallery's sizes, read from a hidden heading and stand-in card (so they follow the CSS, the width and the phone). */
  function artsMetrics(/** @type {HTMLElement} */ be) {
    let p = be.querySelector(":scope > .ar-probe");
    if (!p) {
      p = document.createElement("div");
      p.className = "ar-probe";
      p.setAttribute("aria-hidden", "true");
      p.innerHTML = `<h2 class="ar-gh">Today</h2><ul class="md-grid ar-grid">${sk.tile("page")}</ul>`;
      be.prepend(p);
    }
    const ul = /** @type {HTMLElement} */ (p.querySelector("ul"));
    return { cols: Math.max(1, tracks(ul)), gap: parseFloat(getComputedStyle(ul).rowGap) || 0, headH: (/** @type {HTMLElement} */ (p.firstElementChild)).offsetHeight, cardH: (/** @type {HTMLElement} */ (ul.firstElementChild)).offsetHeight };
  }
  /** Draw the lines within a screen of view, let the others go. */
  function artsPlace() {
    A.placeT = 0;
    const box = A.box, be = box?.querySelector("#arts-body");
    if (!box || !(be instanceof HTMLElement) || box.hidden || !A.lines || !A.M) return;
    const top = box.scrollTop - be.offsetTop, H = box.clientHeight;
    const want = linesIn(A.lines, top - H, top + 2 * H);
    const keep = new Set(want.map((l) => l.key));
    const ae = document.activeElement && be.contains(document.activeElement) ? document.activeElement : null;
    const fCard = /** @type {HTMLElement | null} */ (ae && ae.closest(".md-it")), fKey = fCard && fCard.dataset.k, fCtl = ae && (ae.matches(".md-pin") ? ".md-pin" : ae.matches(".md-from") ? ".md-from" : ".md-open");
    const focusLine = fKey ? A.lines.find((l) => l.kind === "row" && l.g.items.slice(l.start, l.start + l.n).some((it) => it.key === fKey)) : null;
    const moved = !!focusLine && !A.els.get(focusLine.key)?.contains(fCard);
    if (focusLine && moved && !keep.has(focusLine.key)) { want.push(focusLine); want.sort((a, b) => a.y - b.y); keep.add(focusLine.key); }
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
        else if (l.kind === "row") { el = document.createElement("ul"); el.className = "md-grid ar-grid ar-line"; seedList(el, !!A.arrive); }
        else { el = document.createElement("div"); el.className = "ar-line"; el.setAttribute("aria-hidden", "true"); }
        A.els.set(l.key, el);
      }
      if (l.kind === "tail") redraw(el, `<ul class="md-grid ar-grid">${Array.from({ length: l.rows * A.M.cols }, (_, i) => sk.tile("page", i)).join("")}</ul>`);
      const y = `${l.y}px`;
      if (el.style.top !== y) el.style.top = y;
      if (l.kind === "head") setText(el, l.g.label);
      else if (l.kind === "row") {
        const items = l.g.items.slice(l.start, l.start + l.n);
        syncCards(el, items, "page");
        if (A.tio) for (const c of /** @type {HTMLElement[]} */ ([...el.children])) {
          const m = A.byKey.get(c.dataset.k || "");
          if (!observed.has(c) && m && ((m.kind === "image" && !PV.thumbs.has(m.key)) || PV.wantsText(m))) {
            observed.add(c); A.tio.observe(c);
          }
        }
      }
      const at = prev ? prev.nextElementSibling : be.firstElementChild;
      if (at !== el) be.insertBefore(el, at);
      prev = el;
    }
    if (moved) (/** @type {HTMLElement | null} */ (be.querySelector(`.md-it[data-k="${CSS.escape(/** @type {string} */ (fKey))}"] ${fCtl}`)))?.focus();
    A.arrive = false;
  }
  function artsWatch(/** @type {HTMLElement} */ box) {
    const be = /** @type {HTMLElement} */ (box.querySelector("#arts-body"));
    box.addEventListener("scroll", () => { if (!A.placeT) A.placeT = requestAnimationFrame(artsPlace); }, { passive: true });
    if (typeof ResizeObserver === "function") { let w = 0; new ResizeObserver(() => { if (!box.hidden && be.clientWidth && be.clientWidth !== w) { w = be.clientWidth; if (A.lines) artsRender(); } }).observe(be); }
    if (typeof IntersectionObserver === "function") {
      A.tio = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          A.tio?.unobserve(e.target);
          const m = A.byKey.get((/** @type {HTMLElement} */ (e.target)).dataset.k || "");
          if (m) { PV.nearY.set(m.key, { y: e.boundingClientRect.top - (e.rootBounds?.top || 0) + box.scrollTop }); PV.loadThumbs([m]); PV.loadTexts([m]); }
        }
      }, { root: box, rootMargin: "50% 0px" });
    }
  }
  function artsRender() {
    const box = A.box || (A.box = document.getElementById("arts"));
    if (!box || box.hidden) return; // nothing is measured or drawn unseen
    if (!A.built) {
      box.innerHTML = `<header class="ar-head"><span class="tw-ic" aria-hidden="true">${ICON.stack}</span><span class="tw-t"><h1 id="arts-h">Artifacts</h1><p class="pj-s ar-sub" id="arts-sub"></p></span></header><div class="ar-wrap">` +
        `<div class="ar-tools"><label class="ar-q">${ICON.search}<span class="sr-only">Find an artifact</span><input id="arts-q" placeholder="Find an artifact" autocomplete="off" spellcheck="false"></label>` +
        `<label class="ar-pj"><span class="sr-only">Project</span><xo-select id="arts-pj"></xo-select></label></div>` +
        `<div class="ar-kinds" id="arts-f" role="radiogroup" aria-label="Show"></div><div class="ar-body" id="arts-body"></div></div>`;
      A.built = true;
      radioKeys(/** @type {HTMLElement} */ (box.querySelector("#arts-f")));
      box.addEventListener("input", (e) => { const t = /** @type {HTMLInputElement} */ (e.target); if (t.id === "arts-q") { A.q = t.value; artsRender(); } });
      box.addEventListener("change", (e) => { const t = /** @type {HTMLSelectElement} */ (e.target); if (t.id === "arts-pj") { A.pid = t.value; artsRender(); } });
      box.addEventListener("click", (e) => { const k = (/** @type {Element} */ (e.target)).closest("[data-arts-kind]"); if (k) { A.kind = k.getAttribute("data-arts-kind") || "all"; artsRender(); } });
      box.addEventListener("keydown", (e) => { const t = /** @type {HTMLInputElement} */ (e.target); if (e.key === "Escape" && t.id === "arts-q" && t.value) { e.preventDefault(); e.stopPropagation(); t.value = ""; A.q = ""; artsRender(); } });
      artsWatch(box);
    }
    const pending = MS.madePending(null);
    const all = pending ? [] : MS.madeOf(null);
    if (!pending) MS.olderPages(); // what's older than each chat's newest page, read in the background
    const v = artsView(all, { pid: A.pid, kind: A.kind, q: A.q });
    redraw(box.querySelector("#arts-sub"), pending ? sk.bar("18em") : all.length ? esc(`${all.length} ${all.length === 1 ? "thing" : "things"} your threads made, newest first`) : "What your threads make shows up here");
    const made = new Set(all.map((m) => m.project));
    const pids = MS.projectsMade().filter((p) => made.has(p.id));
    const opts = `<option value="">All projects</option>` + pids.map((p) => `<option value="${esc(p.id)}"${A.pid === p.id ? " selected" : ""}>${esc(p.name || p.id)}</option>`).join("");
    redraw(box.querySelector("#arts-pj"), opts, { preserve: (node) => node instanceof Element && node.tagName !== "OPTION" });
    const kf = box.querySelector("#arts-f"), kh = KINDS.filter(([k]) => k === "all" || v.counts[k] || k === A.kind).map(([k, w]) => `<button type="button" role="radio" data-arts-kind="${k}" aria-checked="${A.kind === k}"${rovingTab(A.kind === k)}>${w}<span>${pending ? "" : v.counts[k] || 0}</span></button>`).join("");
    redraw(kf, kh);
    box.classList.toggle("is-pics", A.kind === "image");
    const be = /** @type {HTMLElement} */ (box.querySelector("#arts-body"));
    const scope = `${A.pid}|${A.kind}|${A.q}|${pending ? "…" : ""}`;
    if (A.filter !== scope) {
      A.arrive = /…$/.test(A.filter || "");
      A.filter = scope; A.placeholder = ""; redraw(be, ""); be.style.height = ""; A.tio?.disconnect();
      A.els = new Map(); A.lines = null;
    }
    if (pending || !v.groups.length) {
      const html = pending ? `<section class="ar-g" aria-hidden="true"><h2 class="ar-gh">${sk.bar("64px")}</h2><ul class="md-grid ar-grid">${Array.from({ length: 12 }, (_, i) => sk.tile("page", i)).join("")}</ul></section>`
        : `<p class="ar-none">${!all.length ? "<b>Nothing made yet.</b> Files, pages and pictures your threads share land here, newest first."
          : A.q ? `Nothing matches “${esc(A.q)}”.`
          : `No ${esc(((KINDS.find(([k]) => k === A.kind) || [])[1] || "things").toLowerCase())} ${A.pid ? "in this project" : "yet"}.`}</p>`;
      if (A.placeholder !== html) { redraw(be, html); A.placeholder = html; be.style.height = ""; A.els.clear(); A.lines = null; }
      return;
    }
    if (A.placeholder) { redraw(be, ""); A.placeholder = ""; A.els.clear(); }
    const M = (A.M = artsMetrics(be));
    A.byKey = new Map();
    for (const g of v.groups) for (const m of g.items) A.byKey.set(m.key, m);
    const reading = MS.olderLeft();
    const view = box.scrollTop - be.offsetTop;
    let anchor = null;
    if (A.lines && view > 0) {
      const l = linesIn(A.lines, view, view).find((x) => x.kind === "row");
      if (l) anchor = { key: l.g.items[l.start]?.key, off: l.y - view };
    }
    const { lines, height } = galleryLines(v.groups, { cols: M.cols, cardH: M.cardH, headH: M.headH, gap: M.gap, tail: reading ? 2 : 0 });
    A.lines = lines;
    const h = `${height}px`;
    if (be.style.height !== h) be.style.height = h;
    if (anchor && anchor.key) {
      const l = lines.find((x) => x.kind === "row" && x.g.items.slice(x.start, x.start + x.n).some((m) => m.key === anchor.key));
      const to = l ? Math.round(be.offsetTop + l.y - anchor.off) : null;
      if (to != null && Math.abs(to - box.scrollTop) >= 1) box.scrollTop = to;
    }
    artsPlace();
  }

  return { render: artsRender, box: () => A.box ?? null };
}
