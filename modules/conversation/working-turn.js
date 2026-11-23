// @ts-check
import { elapsed, RM } from "../../core/platform/index.js";

/** @typedef {{timer?: ReturnType<typeof setTimeout>, cardKey?: string, open?: boolean, rows?: Set<string> | null, h?: number, resize?: {animation: Animation, from: number, to: number, duration: number} | null, card?: HTMLElement | null}} WorkCard */

/** @typedef {WorkCard & {text: string, shown: string, since: number, swapped: number, w?: number}} Working */

const WAVE_MS = 2400; // the wave of this layer's own animations (mx-shimmer, mx-doing, mx-await)
/** @param {ParentNode} [root] */
export function wave(root = document) {
  for (const e of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(".mx-wl, .tc-segs, .tc-segs .sg.s-doing"))) if (!e.style.getPropertyValue("--mx-wave")) e.style.setProperty("--mx-wave", `${-(Date.now() % WAVE_MS)}ms`);
}

/** @param {import("./decoration-types.js").Conversation} E @param {string} SEL @param {() => void} decorate @param {(() => void)[]} gone */
export function createWorkingTurn(E, SEL, decorate, gone) {
  const msgs = E.msgs;

  const toLatest = E.follow.toLatest;

  /** @type {string | null | undefined} */
  let toHeader = null;


/** @type {Map<string | undefined, Working>} */
  const WORKING = new Map(); // turn key → { text, since, w }

/** @type {Map<string | undefined, WorkCard>} */
  const FINISHED_CARDS = new Map(); // only completed turns whose work card has been opened

/** @type {Set<string | undefined>} */
  const ENDED = new Set();

/** @type {Map<string | undefined, number>} */
  const HOLD = new Map();
  const holdSheet = document.head.appendChild(Object.assign(document.createElement("style"), { id: E.main ? "mx-hold" : `mx-hold-${msgs.id}` }));
  /** @param {HTMLElement} el */
  function naturalHeight(el) {
    const top = el.getBoundingClientRect().top;
    let h = 0;
    for (const c of el.children) { const r = c.getBoundingClientRect(); if (r.height) h = Math.max(h, r.bottom - top); }
    return Math.round(h);
  }
  function holdRules() { holdSheet.textContent = [...HOLD].map(([k, h]) => `:root[data-msgx] ${SEL}>[data-k="${CSS.escape(/** @type {string} */ (k))}"]{min-height:${h}px}`).join("\n"); }
  const orderSheet = document.head.appendChild(Object.assign(document.createElement("style"), { id: E.main ? "mx-order" : `mx-order-${msgs.id}` }));
  /** @param {string | undefined} key @param {string | undefined} lastKey */
  function keepEnded(key, lastKey) {
    if (ENDED.has(key)) return;
    ENDED.add(key);
    const n = ENDED.size;
    orderSheet.append(`:root[data-msgx] ${SEL}>[data-k="${CSS.escape(/** @type {string} */ (key))}"]{order:${2 * n - 1}}\n:root[data-msgx] ${SEL}>[data-k="${CSS.escape(/** @type {string} */ (lastKey))}"]~*{order:${2 * n}}\n`);
  }
  /** @param {HTMLElement} turn */
  function nowText(turn) {
    const all = [.../** @type {NodeListOf<HTMLElement>} */ (turn.querySelectorAll(".tb-rows.is-cur > li, .tb-think.is-live .tb-ht, .tb-narr, .tb-act.is-live > .tb-h .tb-ht"))];
    const last = all.pop();
    if (!last) return "Working";
    const label = last.querySelector(".tb-rl") || last;
    let t = (last.matches(".tb-narr") ? (last.innerText.trim().split(/\n+/).pop() || "") : (label.textContent || "").split(/\n/)[0]).trim();
    t = t.replace(/\s*·\s*[\d.]+\s*(?:ms|s|m|min)(?:\s*\d+\s*s)?$/i, "").replace(/`/g, "").replace(/\s+/g, " ").trim();
    return t || "Working";
  }
  /** @param {HTMLElement} el */
  function working(el) {
    const live = el.classList.contains("is-live") || !!el.querySelector(".turn.is-live");
    el.classList.toggle("mx-live", live);
    const key = el.dataset.k;
    const mb = el.querySelector(":scope > .mb");
    el.classList.toggle("mx-expanded", !!el.querySelector('.turn [aria-expanded="true"], .turn .is-waiting'));
    el.classList.toggle("mx-av-row", !!el.querySelector(':scope > .mb > .turn > :is(.tb-work.is-open, .tb-answer, .tb-text, .tb.is-unfolded):first-child'));
    if (!live || !mb) {
      const stale = mb && (/** @type {HTMLButtonElement | null} */ (mb.querySelector(":scope > .mx-work")));
      if (stale) {
        if (stale.contains(document.activeElement)) [...(/** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll(".turn .tb-work > .tb-h, .turn .tb-h, [data-mx-copy]")))].find((x) => x.getClientRects().length)?.focus({ preventScroll: true });
        stale.remove();
      }
      if (WORKING.has(key)) {
        const last = [.../** @type {HTMLCollectionOf<HTMLElement>} */ (msgs.children)].filter((c) => c !== el && c.dataset.k).pop();
        if (last && last.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) keepEnded(key, last.dataset.k);
        const from = (/** @type {Working} */ (WORKING.get(key))).h;
        const letGo = () => { HOLD.delete(key); holdRules(); };
        const to = naturalHeight(el);
        if (from && to < from - 1 && !RM.matches) {
          const cs = getComputedStyle(el), d = cs.getPropertyValue("--d-move").trim();
          const ms = parseFloat(d) * (d.endsWith("ms") ? 1 : 1000) || 320;
          const a = el.animate([{ minHeight: `${from}px` }, { minHeight: `${to}px` }], { duration: ms, delay: ms, fill: "backwards", easing: cs.getPropertyValue("--ease").trim() || "ease" });
          a.finished.then(letGo, letGo);
        } else letGo();
      }
      const previous = FINISHED_CARDS.get(key) || WORKING.get(key);
      if (previous?.timer) clearTimeout(previous.timer);
      if (mb && (previous || el.classList.contains("mx-expanded"))) {
        const state = previous || {};
        settle(el, state);
        if (state.open) FINISHED_CARDS.set(key, state); else FINISHED_CARDS.delete(key);
      }
      WORKING.delete(key); return;
    }
    let w = /** @type {HTMLButtonElement | null} */ (mb.querySelector(":scope > .mx-work"));
    const was = WORKING.get(key);
    let text = nowText(el);
    const now = Date.now();
    if (was && text !== was.text && now - (was.swapped || 0) < 2500) {
      clearTimeout(was.timer);
      was.timer = setTimeout(decorate, 2500 - (now - was.swapped) + 20);
      text = was.text;
    }
    const since = +((/** @type {HTMLElement | null} */ (el.querySelector(".elapsed[data-since]")))?.dataset.since || 0) || was?.since || Date.now();
    if (!w) {
      w = document.createElement("button");
      w.type = "button"; w.className = "mx-work"; w.dataset.own = "";
      w.title = "See every step";
      w.innerHTML = `<span class="mx-wt"></span><span class="mx-we"></span>`;
      w.addEventListener("click", () => {
        if ((/** @type {HTMLButtonElement} */ (w)).contains(document.activeElement)) toHeader = el.dataset.k;
        (/** @type {HTMLElement | null} */ (el.querySelector(".turn .tb-h")))?.click();
        toLatest(true);
      });
      mb.append(w);
    }
    const wt = /** @type {HTMLElement} */ (w.querySelector(".mx-wt"));
    const cur = wt.querySelector(".mx-wl:not(.is-out)");
    const shown = fitLine(w, text);
    w.title = shown === text ? "See every step" : `${text}\nSee every step`;
    if (!cur || cur.textContent !== shown) {
      const old = cur || (was && was.text !== text ? Object.assign(document.createElement("span"), { className: "mx-wl", textContent: was.shown || was.text }) : null);
      if (old) { if (!old.parentNode) wt.append(old); old.className = "mx-wl is-out"; setTimeout(() => old.remove(), 220); }
      const line = Object.assign(document.createElement("span"), { className: old || !was ? "mx-wl is-in" : "mx-wl", textContent: shown });
      wt.append(line);
    }
    const pv = [...msgs.children].filter((c) => c !== el && !c.classList.contains("mx-live")).pop();
    const said = el.classList.contains("has-said");
    w.classList.add("is-them");
    w.classList.toggle("mx-tail", !said && !(pv && pv.matches(".m-them:not(.mx-other)")));
    w.classList.toggle("mx-under", said && !!el.querySelector(":scope > .mb > .turn > .tb-work"));
    /** @type {Working} */
    const st = Object.assign(was || {}, { text, shown, since, swapped: !was || was.text !== text ? now : was.swapped });
    WORKING.set(key, st);
    settle(el, st);
    sizeWork(w, key, shown);
    const held = HOLD.get(key) || 0;
    st.h = naturalHeight(el);
    if (Math.abs(held - st.h) >= 1) {
      HOLD.set(key, st.h); holdRules();
      if (held > st.h + 1 && !RM.matches) {
        const cs = getComputedStyle(el), d = cs.getPropertyValue("--d-move").trim();
        el.animate([{ minHeight: `${held}px` }, { minHeight: `${st.h}px` }], { duration: parseFloat(d) * (d.endsWith("ms") ? 1 : 1000) || 320, easing: cs.getPropertyValue("--ease").trim() || "ease" });
      }
    }
    tick();
  }

  /** @param {HTMLElement} el @param {WorkCard} st */
  function settle(el, st) {
    wave(el);
    const card = el.classList.contains("mx-expanded") ? (/** @type {HTMLElement | null} */ (el.querySelector('.turn > .tb-work.is-open, .turn > .tb:is(.tb-think,.tb-act,.tb-plan):has(> .tb-h[aria-expanded="true"])'))) : null;
    const key = (/** @type {HTMLElement | null | undefined} */ (card?.querySelector(":scope > .tb-h")))?.dataset.tb;
    if (!card || st.cardKey !== key) {
      st.resize?.animation.cancel();
      if (st.card) st.card.style.overflow = "";
      st.open = false; st.rows = null; st.h = 0; st.resize = null; st.card = null; st.cardKey = key;
      if (!card) return;
    }
    if (!st.open) card.classList.add("mx-opening");
    const seen = st.rows || new Set();
    for (const r of (/** @type {NodeListOf<HTMLElement>} */ (card.querySelectorAll(".tb-rail > .tb, .tb-rows > li, .tb-steps > li, .tb-plan-l > li")))) {
      const block = r.closest(".tb");
      const blockKey = (/** @type {HTMLElement | null | undefined} */ (block?.querySelector(":scope > .tb-h")))?.dataset.tb || key;
      const listKey = (/** @type {HTMLElement} */ (r.parentElement)).matches(".tb-steps") ? "thinking" : (/** @type {HTMLElement} */ (r.parentElement)).matches(".tb-plan-l") ? "plan" : "rows";
      const k = r.matches(".tb") ? `block:${blockKey}` : r.dataset.callId != null ? `call:${r.dataset.callId}` : `${blockKey}:${listKey}:${[...(/** @type {HTMLElement} */ (r.parentElement)).children].indexOf(r)}`;
      if (st.open && !seen.has(k)) r.classList.add("mx-row-in");
      seen.add(k);
    }
    st.rows = seen;
    if (st.card === card) return;
    const h = card.offsetHeight;
    const previous = st.resize;
    const progress = (/** @type {{animation: {effect: AnimationEffect}} | null | undefined} */ (previous))?.animation.effect.getComputedTiming().progress ?? 1;
    const from = previous ? previous.from + (previous.to - previous.from) * progress : st.h;
    const style = getComputedStyle(card);
    const durationToken = style.getPropertyValue("--d-move").trim();
    const fullDuration = parseFloat(durationToken) * (durationToken.endsWith("ms") ? 1 : 1000);
    const duration = previous && previous.to === h ? Math.max(0, previous.duration - (/** @type {number} */ (previous.animation.currentTime || 0))) : fullDuration;
    previous?.animation.cancel();
    if (st.card) st.card.style.overflow = "";
    st.resize = null;
    if (st.open && from && Math.abs(h - from) > 1 && duration > 0 && !RM.matches) {
      card.style.overflow = "hidden";
      const animation = card.animate([{ height: `${from}px` }, { height: `${h}px` }], { duration, easing: style.getPropertyValue("--ease").trim(), fill: "both" });
      const resize = st.resize = { animation, from, to: h, duration };
      animation.finished.then(() => {
        if (st.resize !== resize) return;
        card.style.overflow = ""; st.resize = null; animation.cancel();
      }, () => {});
    }
    st.open = true; st.card = card; st.h = h;
  }
  const WORK_MAX = 560, WORK_CHROME = 16 + 12 + 64 + 16 + 2;
  /** @param {HTMLElement} w */
  const lineFont = (w) => { const c = getComputedStyle(w); return `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`; };
  const measureCtx = /** @type {CanvasRenderingContext2D} */ (document.createElement("canvas").getContext("2d"));
  /** @param {HTMLElement} w @param {string} text */
  function fitLine(w, text) {
    const room = Math.min(WORK_MAX, (w.parentElement?.clientWidth || WORK_MAX) * 0.88) - WORK_CHROME;
    measureCtx.font = lineFont(w);
    if (measureCtx.measureText(text).width <= room) return text;
    const words = text.split(" ");
    while (words.length > 1) {
      words.pop();
      const t = words.join(" ").replace(/[\s,;:·–—-]+$/, "") + "…";
      if (measureCtx.measureText(t).width <= room) return t;
    }
    let t = text;
    while (t.length > 1 && measureCtx.measureText(t + "…").width > room) t = t.slice(0, -1);
    return t + "…";
  }
  /** @param {HTMLElement} w @param {string | undefined} key @param {string} text */
  function sizeWork(w, key, text) {
    const probe = document.createElement("span");
    probe.className = "mx-wsize"; probe.textContent = text;
    w.append(probe);
    const natural = 16 + probe.offsetWidth + 12 + Math.max(64, (/** @type {HTMLElement} */ (w.querySelector(".mx-we"))).offsetWidth) + 16 + 2;
    probe.remove();
    const max = (/** @type {HTMLElement} */ (w.parentElement)).clientWidth * 0.88;
    const st = WORKING.get(key);
    const target = Math.max(Math.min(natural, WORK_MAX, max), st && st.w ? Math.min(st.w, WORK_MAX, max) : 0);
    if (st && st.w && Math.abs(st.w - target) > 1) {
      w.style.transition = "none"; w.style.width = `${st.w}px`; void w.offsetWidth;
      w.style.transition = ""; w.style.width = `${target}px`;
    } else w.style.width = `${target}px`;
    if (st) st.w = target;
  }
  function tick() {
    for (const w of document.querySelectorAll(".mx-work")) {
      const st = WORKING.get((/** @type {HTMLElement | null} */ (w.closest(".m")))?.dataset.k);
      if (!st) continue;
      const s = Math.max(0, Math.floor((Date.now() - st.since) / 1000));
      const t = s >= 3 ? elapsed(s) : "";
      const e = /** @type {HTMLElement} */ (w.querySelector(".mx-we"));
      if (e.textContent !== t) e.textContent = t;
    }
  }
  { const tk = setInterval(tick, 1000); gone.push(() => clearInterval(tk)); }

  /** @param {HTMLElement} el */
  function restoreFocus(el) {
    const a = document.activeElement;
    /** @param {Element | null} x @returns {x is HTMLElement} */
    const shown = (x) => !!x && x.getClientRects().length > 0;
    if (toHeader === el.dataset.k) {
      toHeader = null;
      const h = el.querySelector(".turn .tb-work > .tb-h, .turn .tb-h");
      if (shown(h)) { h.focus({ preventScroll: true }); return; }
    }
    if (el.contains(a) && !shown(a)) { const w = el.querySelector(":scope > .mb > .mx-work"); if (shown(w)) w.focus({ preventScroll: true }); }
  }

  return { working, restoreFocus, removeSheets: () => { holdSheet.remove(); orderSheet.remove(); } };
}
