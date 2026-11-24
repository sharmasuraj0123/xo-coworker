// @ts-check

import { arrive, still, EASE, MOVE } from "../../core/ui/motion.js";

/** @typedef {HTMLElement & {_h?: string}} RenderedRow */

/** @typedef {HTMLElement & {parentElement: HTMLElement}} FoldPart */

/** @typedef {{scroller: HTMLElement, msgs: HTMLElement & {children: HTMLCollectionOf<RenderedRow>}}} Conversation */

/** @param {{takeFoldChange: ReturnType<typeof import("./transcript-folds.js").createTranscriptFolds>["takeChange"], MAIN: Conversation}} options */
export function createReadingLayout({ takeFoldChange, MAIN }) {
  /** @param {string} k */
  const isMessageRow = (k) => k !== "hist" && k !== "note" && k !== "empty" && !k.startsWith("day|");
  /** @param {Conversation} [C] */
  function readingPlace(C = MAIN) {
    const top = C.scroller.getBoundingClientRect().top;
    for (const el of C.msgs.children) {
      const k = el.dataset.k;
      if (!k || !isMessageRow(k)) continue;
      const r = el.getBoundingClientRect();
      if (r.height && r.bottom > top + 1) return { k, top: r.top };
    }
    return null;
  }
  /** @param {Conversation} C @param {string} k */
  const childOf = (C, k) => { for (const el of C.msgs.children) if (el.dataset.k === k) return el; return null; };
  /** @param {Conversation} C @param {{k: string, top: number}} a */
  function holdPlace(C, a) {
    const el = childOf(C, a.k);
    if (!el) return;
    const d = el.getBoundingClientRect().top - a.top;
    if (Math.abs(d) >= 1) { C.scroller.scrollTop += d; }
  }
  /** @param {Element} el @param {Element} root */
  function stirred(el, root) {
    for (let x = /** @type {Element | null} */ (el); x && x !== root.parentElement; x = x.parentElement) if (getComputedStyle(x).animationName !== "none") return true;
    return false;
  }
  /** @param {Conversation} C @param {{key: string, html: string}[]} items */
  function foldsBefore(C, items) {
    const out = [];
    /** @type {Map<string, RenderedRow>} */
    const now = new Map();
    for (const el of C.msgs.children) if (el.dataset.k) now.set(el.dataset.k, el);
    for (const it of items) {
      const el = now.get(it.key);
      if (!el || el._h === it.html || !el.querySelector("[data-tb]")) continue;
      /** @type {Map<string, number>} */
      const parts = new Map();
      if (el.classList.contains("m-turn")) for (const x of /** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll("[data-b],[data-r]"))) parts.set(x.dataset.b ? `b:${x.dataset.b}` : `r:${x.dataset.r}`, x.offsetHeight);
      else parts.set("self", el.offsetHeight);
      out.push({ k: it.key, parts });
    }
    return out;
  }
  /** @param {Conversation} C @param {{k: string, parts: Map<string, number>}[]} folds */
  function workMotion(C, folds) {
    const toggled = takeFoldChange(C.msgs);
    const hook = toggled && `[data-tb="${CSS.escape(toggled.key)}"]`;
    if (hook && toggled?.restoreFocus) (/** @type {HTMLElement | null} */ (C.msgs.querySelector(hook)))?.focus({ preventScroll: true });
    if (still() || !folds.length) return;
    const top = C.scroller.getBoundingClientRect().top, bottom = top + C.scroller.clientHeight;
    /** @param {DOMRect} r */
    const seen = (r) => r.bottom > top && r.top < bottom;
    for (const f of folds) {
      const el = childOf(C, f.k);
      if (!el || !seen(el.getBoundingClientRect())) continue;
      const opened = hook ? el.querySelector(hook)?.closest("[data-b],[data-r]") : null;
      /** @param {HTMLElement} x @param {number | undefined} h0 */
      const glide = (x, h0) => {
        const h1 = x.offsetHeight;
        if (!h0 || !h1 || Math.abs(h1 - h0) < 1 || x.getBoundingClientRect().top < top || stirred(x, el)) return;
        x.animate([{ height: `${h0}px`, overflow: "hidden" }, { height: `${h1}px`, overflow: "hidden" }], { duration: MOVE, easing: EASE });
      };
      if (f.parts.has("self")) { glide(el, f.parts.get("self")); continue; }
      for (const x of /** @type {NodeListOf<FoldPart>} */ (el.querySelectorAll("[data-b],[data-r]"))) {
        const id = x.dataset.b ? `b:${x.dataset.b}` : `r:${x.dataset.r}`;
        if (f.parts.has(id)) { glide(x, f.parts.get(id)); continue; }
        // new: a step, a block of its work (not its answer: words are the message layer's to bring in)
        if ((opened && opened.contains(x)) || x.matches(".tb-answer, .tb-text, .tb-files") || !seen(x.getBoundingClientRect()) || stirred(x, el)) continue;
        if (x.parentElement.closest("[data-r]") ||
          (x.parentElement.closest("[data-b]") && !f.parts.has(`b:${(/** @type {HTMLElement} */ (x.parentElement.closest("[data-b]"))).dataset.b}`))) continue;
        arrive(x);
      }
      // the chevron of what you opened turns, as it would had it not been redrawn
      const chev = opened && opened.querySelector(`${hook} .tb-chev`);
      if (chev && toggled) chev.animate([{ transform: toggled.open ? "none" : "rotate(180deg)" }, { transform: toggled.open ? "rotate(180deg)" : "none" }], { duration: MOVE, easing: EASE });
    }
  }

  return { readingPlace, holdPlace, foldsBefore, workMotion };
}
