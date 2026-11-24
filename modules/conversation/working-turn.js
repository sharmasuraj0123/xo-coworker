// @ts-check
import { elapsed, RM } from "../../core/platform/index.js";
import { EASE } from "../../core/platform/motion.js";
import { LOOP, MOVE, OUT } from "../../core/ui/tokens.js";

/** @typedef {{cancel?: () => void, cardKey?: string, open?: boolean, rows?: Set<string> | null, cardHeight?: number, resize?: {animation: Animation, from: number, to: number, duration: number} | null, card?: HTMLElement | null}} WorkCard */

/** @typedef {WorkCard & {text: string, since: number, swapped: number, height?: number, pill: HTMLButtonElement}} Working */

/** @param {ParentNode} [root] */
export function wave(root = document) {
  if (!LOOP) return;
  const phase = `${-(Date.now() % LOOP)}ms`;
  for (const e of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(".mx-wl, .tc-segs, .tc-segs .sg.s-doing"))) {
    if (!e.style.getPropertyValue("--mx-wave")) e.style.setProperty("--mx-wave", phase);
  }
}

/** @param {Pick<import("./decoration-types.js").Conversation, "msgs" | "follow">} E @param {ReturnType<typeof import("../../core/kernel/scope.js").createScope>} scope */
export function createWorkingTurn(E, scope) {
  const msgs = E.msgs;

  const toLatest = E.follow.toLatest;

  /** @type {string | null | undefined} */
  let toHeader = null;


  /** @type {Map<HTMLElement, Working>} */
  const active = new Map();
  /** @type {WeakMap<HTMLElement, WorkCard>} */
  const finished = new WeakMap();
  /** @type {Map<HTMLElement, HTMLElement>} */
  const ended = new Map();
  /** @param {HTMLElement} el */
  function naturalHeight(el) {
    const top = el.getBoundingClientRect().top;
    let h = 0;
    for (const c of el.children) { const r = c.getBoundingClientRect(); if (r.height) h = Math.max(h, r.bottom - top); }
    return Math.round(h);
  }
  let hadOrder = false;
  function updateOrder() {
    for (const [row, state] of active) {
      if (row.parentNode === msgs) continue;
      state.cancel?.();
      state.resize?.animation.cancel();
      active.delete(row);
    }
    for (const [row, boundary] of ended) {
      if (row.parentNode !== msgs || boundary.parentNode !== msgs) ended.delete(row);
    }
    if (!hadOrder && !ended.size) return;
    hadOrder = ended.size > 0;
    const rows = /** @type {HTMLCollectionOf<HTMLElement>} */ (msgs.children);
    const boundaries = new Map();
    const exceptions = new Map();
    let rank = 0;
    for (const [row, boundary] of ended) {
      rank += 2;
      boundaries.set(boundary, rank);
      exceptions.set(row, rank - 1);
    }
    let order = 0;
    for (const row of rows) {
      const value = exceptions.get(row) ?? order;
      row.toggleAttribute("data-work-order", !!value);
      if (value) row.style.setProperty("--work-order", String(value));
      else row.style.removeProperty("--work-order");
      order = Math.max(order, boundaries.get(row) ?? 0);
    }
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
    const mb = el.querySelector(":scope > .mb");
    el.classList.toggle("mx-expanded", !!el.querySelector('.turn [aria-expanded="true"], .turn .is-waiting'));
    el.classList.toggle("mx-av-row", !!el.querySelector(':scope > .mb > .turn > :is(.tb-work.is-open, .tb-answer, .tb-text, .tb.is-unfolded):first-child'));
    if (!live || !mb) {
      const stale = mb && (/** @type {HTMLButtonElement | null} */ (mb.querySelector(":scope > .mx-work")));
      if (stale) {
        if (stale.contains(document.activeElement)) [...(/** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll(".turn .tb-work > .tb-h, .turn .tb-h, [data-mx-copy]")))].find((x) => x.getClientRects().length)?.focus({ preventScroll: true });
        stale.remove();
      }
      const state = active.get(el);
      if (state) finishTurn(el, state);
      const previous = finished.get(el) || state;
      previous?.cancel?.();
      if (mb && (previous || el.classList.contains("mx-expanded"))) {
        const card = previous || {};
        settle(el, card);
        if (card.open) finished.set(el, card); else finished.delete(el);
      }
      active.delete(el);
      return;
    }
    let w = /** @type {HTMLButtonElement | null} */ (mb.querySelector(":scope > .mx-work"));
    const was = active.get(el);
    let text = nowText(el);
    const now = Date.now();
    if (was && text !== was.text && now - (was.swapped || 0) < 2500) {
      was.cancel?.();
      was.cancel = scope.timeout(() => { if (el.parentNode === msgs) working(el); }, 2500 - (now - was.swapped) + 20);
      text = was.text;
    }
    const since = +((/** @type {HTMLElement | null} */ (el.querySelector(".elapsed[data-since]")))?.dataset.since || 0) || was?.since || Date.now();
    if (!w) {
      w = document.createElement("button");
      w.type = "button"; w.className = "mx-work"; w.dataset.own = "";
      w.title = "See every step";
      w.innerHTML = `<span class="mx-wt"></span><span class="mx-we"></span>`;
      mb.append(w);
    }
    const wt = /** @type {HTMLElement} */ (w.querySelector(".mx-wt"));
    const cur = wt.querySelector(".mx-wl:not(.is-out)");
    w.title = text === "Working" ? "See every step" : `${text}\nSee every step`;
    if (!cur || cur.textContent !== text) {
      const old = cur || (was && was.text !== text ? Object.assign(document.createElement("span"), { className: "mx-wl", textContent: was.text }) : null);
      if (old) { if (!old.parentNode) wt.append(old); old.className = "mx-wl is-out"; scope.timeout(() => old.remove(), OUT); }
      const line = Object.assign(document.createElement("span"), { className: old || !was ? "mx-wl is-in" : "mx-wl", textContent: text });
      wt.append(line);
    }
    const said = el.classList.contains("has-said");
    w.classList.add("is-them");
    w.classList.toggle("mx-under", said && !!el.querySelector(":scope > .mb > .turn > .tb-work"));
    /** @type {Working} */
    const st = Object.assign(was || {}, { text, pill: w, since, swapped: !was || was.text !== text ? now : was.swapped });
    active.set(el, st);
    settle(el, st);
    updateElapsed(st, now);
    const from = st.height;
    st.height = naturalHeight(el);
    el.toggleAttribute("data-work-height", true);
    el.style.setProperty("--work-height", `${st.height}px`);
    if (from && from > st.height + 1 && !RM.matches) resizeTurn(el, from, st.height);
  }

  /** @param {HTMLElement} el @param {Working} state */
  function finishTurn(el, state) {
    const last = Array.from(/** @type {HTMLCollectionOf<HTMLElement>} */ (msgs.children)).findLast((row) => row !== el && row.dataset.k);
    if (!ended.has(el) && last && last.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) ended.set(el, last);
    el.removeAttribute("data-work-height");
    el.style.removeProperty("--work-height");
    const to = naturalHeight(el);
    if (state.height && to < state.height - 1 && !RM.matches) resizeTurn(el, state.height, to, true);
  }

  /** @param {HTMLElement} el @param {number} from @param {number} to @param {boolean} [delay] */
  function resizeTurn(el, from, to, delay = false) {
    const animation = el.animate([{ minHeight: `${from}px` }, { minHeight: `${to}px` }], {
      duration: MOVE, delay: delay ? MOVE : 0, fill: "backwards", easing: EASE,
    });
    ownAnimation(animation);
  }

  /** @param {Animation} animation */
  function ownAnimation(animation) {
    const cancel = scope.effect(() => () => animation.cancel());
    animation.finished.then(cancel, cancel);
  }

  /** @param {HTMLElement} el @param {WorkCard} st */
  function settle(el, st) {
    wave(el);
    const card = el.classList.contains("mx-expanded") ? (/** @type {HTMLElement | null} */ (el.querySelector('.turn > .tb-work.is-open, .turn > .tb:is(.tb-think,.tb-act,.tb-plan):has(> .tb-h[aria-expanded="true"])'))) : null;
    const key = (/** @type {HTMLElement | null | undefined} */ (card?.querySelector(":scope > .tb-h")))?.dataset.tb;
    if (!card || st.cardKey !== key) {
      st.resize?.animation.cancel();
      if (st.card) st.card.style.overflow = "";
      st.open = false; st.rows = null; st.cardHeight = 0; st.resize = null; st.card = null; st.cardKey = key;
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
    const from = previous ? previous.from + (previous.to - previous.from) * progress : st.cardHeight;
    const duration = previous && previous.to === h ? Math.max(0, previous.duration - (/** @type {number} */ (previous.animation.currentTime || 0))) : MOVE;
    previous?.animation.cancel();
    if (st.card) st.card.style.overflow = "";
    st.resize = null;
    if (st.open && from && Math.abs(h - from) > 1 && duration > 0 && !RM.matches) {
      card.style.overflow = "hidden";
      const animation = card.animate([{ height: `${from}px` }, { height: `${h}px` }], { duration, easing: EASE, fill: "both" });
      ownAnimation(animation);
      const resize = st.resize = { animation, from, to: h, duration };
      animation.finished.then(() => {
        if (st.resize !== resize) return;
        card.style.overflow = ""; st.resize = null; animation.cancel();
      }, () => {});
    }
    st.open = true; st.card = card; st.cardHeight = h;
  }
  /** @param {Working} state @param {number} now */
  function updateElapsed(state, now) {
    const e = state.pill.querySelector(".mx-we");
    const s = Math.max(0, Math.floor((now - state.since) / 1000));
    const text = s >= 3 ? elapsed(s) : "";
    if (e && e.textContent !== text) e.textContent = text;
  }
  scope.interval(() => {
    const now = Date.now();
    for (const [row, state] of active) if (row.parentNode === msgs) updateElapsed(state, now);
  }, 1000);
  scope.listen(msgs, "click", (event) => {
    const pill = (/** @type {Element} */ (event.target)).closest(".mx-work");
    const row = /** @type {HTMLElement | null} */ (pill?.closest(".m"));
    if (!row || active.get(row)?.pill !== pill) return;
    if (pill?.contains(document.activeElement)) toHeader = row.dataset.k;
    (/** @type {HTMLElement | null} */ (row.querySelector(".turn .tb-h")))?.click();
    toLatest(true);
  });
  scope.effect(() => () => {
    for (const row of /** @type {HTMLCollectionOf<HTMLElement>} */ (msgs.children)) {
      row.removeAttribute("data-work-order");
      row.removeAttribute("data-work-height");
      row.style.removeProperty("--work-order");
      row.style.removeProperty("--work-height");
    }
    active.clear();
    ended.clear();
  });

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

  function updateTails() {
    if (!active.size) return;
    let previous = msgs.lastElementChild;
    while (previous?.classList.contains("mx-live")) previous = previous.previousElementSibling;
    const continuesAgent = previous?.matches(".m-them:not(.mx-other)");
    for (const [row, { pill }] of active) {
      if (row.parentNode === msgs) pill.classList.toggle("mx-tail", !continuesAgent && !row.classList.contains("has-said"));
    }
  }

  return { working, restoreFocus, updateOrder, updateTails };
}
