// @ts-check

import { requireHtml } from "../core/platform/dom.js";
import { copyText, COPY_REFUSED } from "../core/platform/index.js";
import { menuKeys } from "../core/ui/a11y/keynav.js";
import { createScope } from "../core/kernel/scope.js";
import { drag, glide, follow, unstyle, tick, scrollsX, scrolledY, edgeIsSafari, FLICK } from "../core/platform/gestures.js";
/** @typedef {{ scroller: HTMLElement, msgs: HTMLElement, say?: HTMLElement, toast?: (message: string) => void }} Conversation */

/** @typedef {(element: HTMLElement) => string} WordsOf */

/** @import { Lifetime } from "../core/kernel/types" */
/** @import { Sheet, SurfaceGestures } from "./gesture-types.d.ts" */

/** @param {number} d */
const band = (d) => d * 0.28;
/** @param {number} d @param {number} v @param {number} size @param {number} frac */
const committed = (d, v, size, frac) => Math.abs(d) > size * frac || (Math.abs(v) > FLICK && Math.sign(v) === Math.sign(d) && Math.abs(d) > 24);

// never start a navigation swipe on these: they take touches of their own
const OWN = "input, textarea, select, xo-select, xo-date, [contenteditable], .b-hold, pre, table, .md-code, iframe, .xterm, [data-noswipe]";

/** @param {HTMLElement | null} tdock @param {import("../core/kernel/types").Lifetime} scope */
export function dockGestures(tdock, scope) {
  if (!tdock) return;
  /** @type {HTMLElement | null} */
  let tgt = null;
  drag(tdock, {
    axis: "y", signal: scope.signal,
    start: ({ target }) => {
      tgt = /** @type {HTMLElement | null} */ (target.closest(".card.is-dock:not(.r-done)") || target.closest(".dock-fold"));
      if (!tgt || target.closest(OWN)) return false;
      return (/** @type {HTMLElement} */ (tgt)).classList.contains("dock-fold") || scrolledY(target, tgt) <= 0;
    },
    accept: (_dx, dy) => ((/** @type {HTMLElement} */ (tgt)).classList.contains("dock-fold") ? dy < 0 : dy > 0),
    move: (_dx, dy) => follow(/** @type {HTMLElement} */ (tgt), `translateY(${(/** @type {HTMLElement} */ (tgt)).classList.contains("dock-fold") ? Math.max(-36, dy * 0.5) : Math.max(0, dy)}px)`),
    end: async (_dx, dy, _vx, vy) => {
      const fold = (/** @type {HTMLElement} */ (tgt)).classList.contains("dock-fold");
      if (fold ? committed(dy, vy, 60, 1) || dy < -28 : committed(dy, vy, (/** @type {HTMLElement} */ (tgt)).offsetHeight, 0.3)) {
        tick();
        if (fold) { unstyle(tgt); (/** @type {HTMLElement} */ (tgt)).click(); return; }
        await glide(/** @type {HTMLElement} */ (tgt), `translateY(${(/** @type {HTMLElement} */ (tgt)).offsetHeight}px)`, { ms: 160, opacity: 0, scope });
        if (scope.signal.aborted) return;
        (/** @type {HTMLElement | null} */ ((/** @type {HTMLElement} */ (tgt)).querySelector(".dock-hide")))?.click();
      } else { await glide(/** @type {HTMLElement} */ (tgt), "translateY(0)", { scope }); if (!scope.signal.aborted) unstyle(tgt); }
    },
    cancel: () => unstyle(tgt),
  });
}

/** @param {SurfaceGestures} A @param {import("../core/kernel/types").Lifetime} scope */
export function wireGestures(A, scope) {
  const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (document.querySelector(s));
  const main = $("#main"), side = $("#side"), scrim = $("#side-scrim");
  const W = () => main.clientWidth || innerWidth;

  // ── swipe right on the page: back a level; at the top level, the sidebar ──
  let mode = /** @type {"back" | "drawer" | null} */ (null);
  const conv = $("#conv"), dock = $("#dock");
  drag(main, {
    axis: "x", signal: scope.signal,
    start: ({ x, target }) => {
      mode = null;
      if (edgeIsSafari(x) || target.closest(OWN) || target.closest("#dock, #panel, #viewer, #settings, .iq-pop") || A.overlay()) return false;
      if (scrollsX(target, main)) return false;
      const v = A.view();
      mode = v.startsWith("t:") || v.startsWith("c:") ? "back" : A.phone() ? "drawer" : null;
      return !!mode;
    },
    accept: (dx) => dx > 0,
    move: (dx) => {
      if (mode === "back") {
        for (const el of [conv, dock]) follow(/** @type {HTMLElement} */ (el), `translateX(${dx}px)`);
        conv.classList.add("is-swiped");
      } else {
        const w = side.offsetWidth;
        side.classList.add("is-drag");
        follow(side, `translateX(${Math.min(0, dx - w)}px)`);
        scrim.hidden = false;
        follow(scrim, "", Math.min(1, dx / w));
      }
    },
    end: async (dx, _dy, vx) => {
      if (mode === "back") {
        if (committed(dx, vx, W(), 0.35)) {
          tick();
          await Promise.all([glide(conv, `translateX(${W()}px)`, { scope, ms: 180 }), glide(dock, `translateX(${W()}px)`, { scope, ms: 180 })]);
          if (!scope.signal.aborted) A.back();
          unstyle(conv, dock);
          conv.classList.remove("is-swiped");
        } else {
          await Promise.all([glide(conv, "translateX(0)", { scope }), glide(dock, "translateX(0)", { scope })]);
          unstyle(conv, dock); conv.classList.remove("is-swiped");
        }
        return;
      }
      const w = side.offsetWidth;
      if (committed(dx, vx, w, 0.4)) {
        tick();
        await Promise.all([glide(side, "translateX(0)", { scope, ms: 200 }), glide(scrim, "", { scope, ms: 200, opacity: 1 })]);
        unstyle(side, scrim); side.classList.remove("is-drag");
        if (!scope.signal.aborted) A.drawer(true);
      } else {
        await Promise.all([glide(side, "translateX(-102%)", { scope }), glide(scrim, "", { scope, opacity: 0 })]);
        unstyle(side, scrim); side.classList.remove("is-drag");
        scrim.hidden = true;
      }
    },
    cancel: () => { unstyle(conv, dock, side, scrim); conv.classList.remove("is-swiped"); side.classList.remove("is-drag"); if (!A.isDrawer()) scrim.hidden = true; },
  });

  /** @type {import('../core/platform/gestures.js').Drag} */
  const closeDrawer = {
    axis: "x", signal: scope.signal,
    start: ({ target }) => A.isDrawer() && !target.closest(OWN),
    accept: (dx) => dx < 0,
    move: (dx) => { follow(side, `translateX(${Math.min(0, dx)}px)`); follow(scrim, "", Math.max(0, 1 + dx / side.offsetWidth)); },
    end: async (dx, _dy, vx) => {
      if (committed(dx, vx, side.offsetWidth, 0.3)) {
        tick();
        await glide(side, "translateX(-102%)", { scope, ms: 180 });
        if (!scope.signal.aborted) A.drawer(false);
        unstyle(side, scrim);
      } else {
        await Promise.all([glide(side, "translateX(0)", { scope }), glide(scrim, "", { scope, opacity: 1 })]);
        unstyle(side, scrim);
      }
    },
    cancel: () => unstyle(side, scrim),
  };
  drag(side, closeDrawer);
  drag(scrim, closeDrawer);
}

/** @param {Lifetime} scope @param {HTMLElement} el @param {() => boolean} open @param {() => void} close */
export function pageGesture(scope, el, open, close) {
  drag(el, {
    axis: "x", signal: scope.signal,
    start: ({ x, target }) => open() && !edgeIsSafari(x) && !target.closest(OWN) && !scrollsX(target, el) && !target.closest(".vw-img.is-actual"),
    accept: (dx) => dx > 0,
    move: (dx) => follow(/** @type {HTMLElement} */ (el), `translateX(${dx}px)`),
    end: async (dx, _dy, vx) => {
      const width = document.getElementById("main")?.clientWidth || innerWidth;
      if (committed(dx, vx, width, 0.35)) {
        tick();
        await glide(el, `translateX(${width}px)`, { scope, ms: 180 });
        if (!scope.signal.aborted) close();
      } else await glide(el, "translateX(0)", { scope });
      unstyle(el);
    },
    cancel: () => unstyle(el),
  });
}

/** @param {Lifetime} scope @param {Sheet} sheet */
export function sheetGesture(scope, { host, card = () => host, open, close, fraction: frac = 0.25 }) {
  /** @type {HTMLElement | null} */
  let el = null;
  drag(host, {
    axis: "y", signal: scope.signal,
    start: ({ target }) => {
      el = card();
      if (!el || !open() || !el.contains(target) || target.closest(OWN) || target.closest(".vw-img.is-actual")) return false;
      if (window.visualViewport && (/** @type {VisualViewport} */ (visualViewport)).scale > 1.01) return false; // pinch-zoomed: the finger pans
      return scrolledY(target, el) <= 0;
    },
    accept: (_dx, dy) => dy > 0,
    move: (_dx, dy) => follow(/** @type {HTMLElement} */ (el), `translateY(${Math.max(0, dy)}px)`),
    end: async (_dx, dy, _vx, vy) => {
      const h = (/** @type {HTMLElement} */ (el)).offsetHeight || innerHeight;
      if (committed(dy, vy, h, frac)) {
        tick();
        await glide(/** @type {HTMLElement} */ (el), `translateY(${h}px)`, { scope, ms: 180, opacity: 0 });
        if (scope.signal.aborted) { unstyle(el); return; }
        close();
        const closed = el;
        const finish = scope.effect(() => () => unstyle(closed));
        scope.timeout(finish, 360);
      } else { await glide(/** @type {HTMLElement} */ (el), "translateY(0)", { scope }); unstyle(el); }
    },
    cancel: () => unstyle(el),
  });
}

/** @param {Lifetime} scope @param {() => boolean} open */
export function decisionGesture(scope, open) {
  const stage = requireHtml("#pn-stage"), foot = requireHtml("#pn-foot");
  const navBtn = (/** @type {number} */ d) => /** @type {HTMLButtonElement | null} */ (foot.querySelector(`[data-nav="${d}"]`));
  let can = false;
  drag(stage, {
    axis: "x", signal: scope.signal,
    start: ({ target }) => open() && !target.closest(OWN) && !scrollsX(target, stage),
    accept: () => true,
    move: (dx) => {
      const b = navBtn(dx < 0 ? 1 : -1);
      can = !!b && !b.disabled;
      const x = can ? dx : band(dx);
      follow(stage, `translateX(${x}px)`, 1 - Math.min(0.5, Math.abs(x) / stage.offsetWidth / 1.6));
    },
    end: async (dx, _dy, vx) => {
      const w = stage.offsetWidth;
      if (can && committed(dx, vx, w, 0.28)) {
        tick();
        await glide(stage, `translateX(${dx < 0 ? -w : w}px)`, { scope, ms: 160, opacity: 0 });
        if (scope.signal.aborted) { unstyle(stage); return; }
        navBtn(dx < 0 ? 1 : -1)?.click();
        follow(stage, `translateX(${dx < 0 ? w * 0.3 : -w * 0.3}px)`, 0);
        void stage.offsetWidth;
        await glide(stage, "translateX(0)", { scope, ms: 220, opacity: 1 });
      } else await glide(stage, "translateX(0)", { scope, opacity: 1 });
      unstyle(stage);
    },
    cancel: () => unstyle(stage),
  });
}

/** @param {HTMLElement} runsCard @param {() => boolean} detail @param {() => void} back @param {AbortSignal} signal */
export function wireRunsGesture(runsCard, detail, back, signal) {
  drag(runsCard, {
    axis: "x", signal,
    start: ({ x, target }) => detail() && !edgeIsSafari(x) && !target.closest(OWN) && !scrollsX(target, runsCard),
    accept: (dx) => dx > 0,
    move: (dx) => follow(runsCard, `translateX(${dx}px)`),
    end: async (dx, _dy, vx) => {
      if (committed(dx, vx, runsCard.offsetWidth, 0.35)) {
        tick();
        await glide(runsCard, `translateX(${runsCard.offsetWidth}px)`, { ms: 160, opacity: 0 });
        if (!signal.aborted) back();
      }
      else await glide(runsCard, "translateX(0)");
      unstyle(runsCard);
    },
    cancel: () => unstyle(runsCard),
  });
}

/** @param {Conversation} C @param {WordsOf} wordsOf @param {import("../core/kernel/types").Lifetime} scope */
export function conversationGestures(C, wordsOf, scope) {
  // ── while typing, a drag down over the conversation lowers the keyboard (the draft is kept) ──
  const sc = C.scroller;
  let y0 = /** @type {number | null} */ (null), x0 = 0;
  scope.listen(sc, "touchstart", (event) => {
    const { touches } = /** @type {TouchEvent} */ (event);
    y0 = document.activeElement === C.say && touches.length === 1 ? touches[0].clientY : null;
    x0 = touches[0]?.clientX || 0;
  }, { passive: true });
  scope.listen(sc, "touchmove", (event) => {
    if (y0 == null) return;
    const p = (/** @type {TouchEvent} */ (event)).touches[0], dy = p.clientY - y0;
    if (dy > 28 && dy > Math.abs(p.clientX - x0)) { (/** @type {HTMLElement} */ (C.say)).blur(); y0 = null; }
  }, { passive: true });
  longPress(C, wordsOf, scope);
}

const HOLD = 480;
/** @param {Conversation} A @param {WordsOf} wordsOf @param {import("../core/kernel/types").Lifetime} scope */
function longPress(A, wordsOf, scope) {
  const msgs = A.msgs;
  let cancelHold = () => {}, cancelMenu = () => {}, fired = false;
  let at = /** @type {{ x: number, y: number } | null} */ (null);
  let menu = /** @type {HTMLElement | null} */ (null), from = /** @type {HTMLElement | null} */ (null);
  const WHAT = ".m-you .bubble, .m-them:not(.m-turn):not(.m-card) > .mb > .prose, .m-turn .tb-answer";
  const shut = (restoreFocus = true) => {
    if (!menu) return;
    if (restoreFocus && menu.contains(document.activeElement) && from?.isConnected) {
      if (!from.hasAttribute("tabindex")) from.tabIndex = -1;
      from.focus({ preventScroll: true });
    }
    menu.remove(); menu = null; from = null;
    cancelMenu();
  };
  const outside = (/** @type {Event} */ e) => { if (menu && !menu.contains(/** @type {Node} */ (e.target))) shut(); };
  const esc = (/** @type {Event} */ e) => { if ((/** @type {KeyboardEvent} */ (e)).key === "Escape") { e.stopPropagation(); shut(); } };
  const clearSel = () => { for (const el of msgs.querySelectorAll(".is-selecting")) el.classList.remove("is-selecting"); };
  scope.effect(() => () => shut(false));
  scope.listen(document, "selectionchange", () => { const s = getSelection(); if (s && s.isCollapsed) clearSel(); });

  const stopHold = () => { cancelHold(); at = null; };
  scope.listen(msgs, "touchstart", (event) => {
    const e = /** @type {TouchEvent} */ (event);
    stopHold();
    fired = false;
    const el = e.touches.length === 1 && !(/** @type {Element} */ (e.target)).closest("a, button, input, textarea, .md-code, [data-copy]") ? (/** @type {Element} */ (e.target)).closest(WHAT) : null;
    if (!el || el.classList.contains("is-selecting")) return;
    const p = e.touches[0];
    const origin = at = { x: p.clientX, y: p.clientY };
    cancelHold = scope.timeout(() => { fired = true; tick(); open(/** @type {HTMLElement} */ (el), origin); }, HOLD);
  }, { passive: true });
  scope.listen(msgs, "touchmove", (event) => {
    if (!at) return;
    const p = (/** @type {TouchEvent} */ (event)).touches[0];
    if (Math.hypot(p.clientX - at.x, p.clientY - at.y) > 8) stopHold();
  }, { passive: true });
  const stop = (/** @type {Event} */ e) => { stopHold(); if (fired && e.cancelable) e.preventDefault(); };
  scope.listen(msgs, "touchend", stop);
  scope.listen(msgs, "touchcancel", stop);
  // Android opens its own menu on a long-press: ours is the one shown
  scope.listen(msgs, "contextmenu", (e) => { if (fired || (matchMedia("(pointer: coarse)").matches && (/** @type {Element} */ (e.target)).closest(WHAT) && !(/** @type {Element} */ (e.target)).closest(".is-selecting"))) e.preventDefault(); });
  scope.listen(A.scroller, "scroll", () => shut(), { passive: true });

  /** @param {HTMLElement} el @param {{ x: number, y: number }} p */
  function open(el, p) {
    shut();
    const menuScope = createScope();
    cancelMenu = menuScope.dispose;
    from = el;
    menu = document.createElement("div");
    menu.className = "lp-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Message");
    menu.innerHTML = `<button type="button" role="menuitem" data-lp="copy">Copy</button><button type="button" role="menuitem" data-lp="select">Select text</button>`;
    menuKeys(menu, { close: () => shut() });
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    const x = Math.max(10, Math.min(innerWidth - r.width - 10, p.x - r.width / 2));
    const y = p.y - r.height - 18 > 10 ? p.y - r.height - 18 : p.y + 18;
    menu.style.left = `${x}px`; menu.style.top = `${y}px`;
    menuScope.listen(menu, "click", (e) => {
      const b = /** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest("[data-lp]"));
      if (!b) return;
      // "Copied" only once it's on the clipboard; refused, said so
      if (b.dataset.lp === "copy") {
        copyText(wordsOf(el)).then((ok) => { if (!scope.signal.aborted) A.toast?.(ok ? "Copied" : COPY_REFUSED); });
      }
      else {
        // focus goes to the message first (shut), then its words are selected: the selection stays
        shut();
        el.classList.add("is-selecting");
        const s = getSelection();
        (/** @type {Selection} */ (s)).removeAllRanges();
        (/** @type {Selection} */ (s)).selectAllChildren(el);
        return;
      }
      shut();
    });
    menuScope.timeout(() => {
      menuScope.listen(document, "touchstart", outside, true);
      menuScope.listen(document, "keydown", esc, true);
    }, 0);
    (/** @type {HTMLButtonElement} */ (menu.querySelector("button"))).focus({ preventScroll: true });
  }
}
