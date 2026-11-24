// @ts-check

import { copyText, COPY_REFUSED } from "../core/platform/index.js";
import { menuKeys } from "../core/ui/a11y/keynav.js";
import { drag, glide, follow, unstyle, tick, scrollsX, scrolledY, edgeIsSafari, FLICK } from "../core/platform/gestures.js";
/** @typedef {{ scroller: HTMLElement, msgs: HTMLElement, say?: HTMLElement, toast?: (message: string) => void }} Conversation */

/** @typedef {(element: HTMLElement) => string} WordsOf */

/** @typedef {{ host: HTMLElement, card?: () => HTMLElement | null, open: () => boolean, close: () => void }} Sheet */

/** @typedef {{ phone: () => boolean, overlay: () => unknown, view: () => string, back: () => void, drawer: (open: boolean) => void, isDrawer: () => boolean, closeSettings: () => void, settingsOpen: () => boolean, viewerOpen: () => boolean, closeViewer: () => void, sheets: Sheet[], panelOpen: () => boolean, runsDeep: () => boolean, runsBack: () => void, runsCard: HTMLElement, say?: HTMLElement, toast?: (message: string) => void, canResolve: () => boolean, resolve: (id: string, resolved: boolean, row: HTMLElement) => void, threadOf: (id: string) => { id: string, state: string } | null }} SurfaceGestures */

/** @param {number} d */
const band = (d) => d * 0.28;
/** @param {number} d @param {number} v @param {number} size @param {number} frac */
const committed = (d, v, size, frac) => Math.abs(d) > size * frac || (Math.abs(v) > FLICK && Math.sign(v) === Math.sign(d) && Math.abs(d) > 24);

// never start a navigation swipe on these: they take touches of their own
const OWN = "input, textarea, select, xo-select, [contenteditable], .b-hold, pre, table, .md-code, iframe, .xterm, [data-noswipe]";

/** @param {HTMLElement | null} tdock */
export function dockGestures(tdock) {
  if (!tdock) return;
  /** @type {HTMLElement | null} */
  let tgt = null;
  drag(tdock, {
    axis: "y",
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
        await glide(/** @type {HTMLElement} */ (tgt), `translateY(${(/** @type {HTMLElement} */ (tgt)).offsetHeight}px)`, { ms: 160, opacity: 0 });
        (/** @type {HTMLElement | null} */ ((/** @type {HTMLElement} */ (tgt)).querySelector(".dock-hide")))?.click();
      } else { await glide(/** @type {HTMLElement} */ (tgt), "translateY(0)"); unstyle(tgt); }
    },
    cancel: () => unstyle(tgt),
  });
}

/** @param {SurfaceGestures} A @param {WordsOf} wordsOf */
export function wireGestures(A, wordsOf) {
  const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (document.querySelector(s));
  const main = $("#main"), side = $("#side"), scrim = $("#side-scrim");
  const W = () => main.clientWidth || innerWidth;

  // ── swipe right on the page: back a level; at the top level, the sidebar ──
  let mode = /** @type {"back" | "drawer" | null} */ (null);
  const conv = $("#conv"), dock = $("#dock");
  drag(main, {
    axis: "x",
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
          await Promise.all([glide(conv, `translateX(${W()}px)`, { ms: 180 }), glide(dock, `translateX(${W()}px)`, { ms: 180 })]);
          A.back();
          unstyle(conv, dock);
          conv.classList.remove("is-swiped");
        } else {
          await Promise.all([glide(conv, "translateX(0)"), glide(dock, "translateX(0)")]);
          unstyle(conv, dock); conv.classList.remove("is-swiped");
        }
        return;
      }
      const w = side.offsetWidth;
      if (committed(dx, vx, w, 0.4)) {
        tick();
        await Promise.all([glide(side, "translateX(0)", { ms: 200 }), glide(scrim, "", { ms: 200, opacity: 1 })]);
        unstyle(side, scrim); side.classList.remove("is-drag");
        A.drawer(true);
      } else {
        await Promise.all([glide(side, "translateX(-102%)"), glide(scrim, "", { opacity: 0 })]);
        unstyle(side, scrim); side.classList.remove("is-drag");
        scrim.hidden = true;
      }
    },
    cancel: () => { unstyle(conv, dock, side, scrim); conv.classList.remove("is-swiped"); side.classList.remove("is-drag"); if (!A.isDrawer()) scrim.hidden = true; },
  });

  /** @type {import('../core/platform/gestures.js').Drag} */
  const closeDrawer = {
    axis: "x",
    start: ({ target }) => A.isDrawer() && !target.closest(OWN),
    accept: (dx) => dx < 0,
    move: (dx) => { follow(side, `translateX(${Math.min(0, dx)}px)`); follow(scrim, "", Math.max(0, 1 + dx / side.offsetWidth)); },
    end: async (dx, _dy, vx) => {
      if (committed(dx, vx, side.offsetWidth, 0.3)) {
        tick();
        await glide(side, "translateX(-102%)", { ms: 180 });
        A.drawer(false);
        unstyle(side, scrim);
      } else {
        await Promise.all([glide(side, "translateX(0)"), glide(scrim, "", { opacity: 1 })]);
        unstyle(side, scrim);
      }
    },
    cancel: () => unstyle(side, scrim),
  };
  drag(side, closeDrawer);
  drag(scrim, closeDrawer);

  /** @param {HTMLElement} el @param {() => boolean} open @param {() => void} close */
  const page = (el, open, close) => drag(el, {
    axis: "x",
    start: ({ x, target }) => A.phone() && open() && !edgeIsSafari(x) && !target.closest(OWN) && !scrollsX(target, el) && !target.closest(".vw-img.is-actual"),
    accept: (dx) => dx > 0,
    move: (dx) => follow(/** @type {HTMLElement} */ (el), `translateX(${dx}px)`),
    end: async (dx, _dy, vx) => {
      if (committed(dx, vx, W(), 0.35)) { tick(); await glide(/** @type {HTMLElement} */ (el), `translateX(${W()}px)`, { ms: 180 }); close(); unstyle(el); }
      else { await glide(/** @type {HTMLElement} */ (el), "translateX(0)"); unstyle(el); }
    },
    cancel: () => unstyle(el),
  });
  page($("#settings"), A.settingsOpen, A.closeSettings);
  page($("#viewer"), A.viewerOpen, A.closeViewer);

  /** @param {HTMLElement} host @param {() => HTMLElement | null} card @param {() => boolean} open @param {() => void} close */
  const putAway = (host, card, open, close, frac = 0.25) => {
    /** @type {HTMLElement | null} */
    let el = null;
    drag(host, {
      axis: "y",
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
          await glide(/** @type {HTMLElement} */ (el), `translateY(${h}px)`, { ms: 180, opacity: 0 });
          close();
          setTimeout(() => unstyle(el), 360);
        } else { await glide(/** @type {HTMLElement} */ (el), "translateY(0)"); unstyle(el); }
      },
      cancel: () => unstyle(el),
    });
  };
  for (const s of A.sheets) putAway(s.host, s.card || (() => s.host), s.open, s.close);
  const viewer = $("#viewer");
  putAway(viewer, () => viewer, () => A.phone() && A.viewerOpen(), A.closeViewer, 0.2);

  // ── Needs you: swipe the card sideways for the next ask or the one before. It never answers. ──
  const stage = $("#pn-stage"), foot = $("#pn-foot");
  const navBtn = (/** @type {number} */ d) => /** @type {HTMLButtonElement | null} */ (foot.querySelector(`[data-nav="${d}"]`));
  let can = false;
  drag(stage, {
    axis: "x",
    start: ({ target }) => A.panelOpen() && !target.closest(OWN) && !scrollsX(target, stage),
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
        await glide(stage, `translateX(${dx < 0 ? -w : w}px)`, { ms: 160, opacity: 0 });
        navBtn(dx < 0 ? 1 : -1)?.click();
        follow(stage, `translateX(${dx < 0 ? w * 0.3 : -w * 0.3}px)`, 0);
        void stage.offsetWidth;
        await glide(stage, "translateX(0)", { ms: 220, opacity: 1 });
      } else await glide(stage, "translateX(0)", { opacity: 1 });
      unstyle(stage);
    },
    cancel: () => unstyle(stage),
  });

  // (a thread's decision card's drag comes with its dock: dockGestures, called by app.js's createDock for each)

  // ── All threads: swipe a row left to Resolve it (Reopen a resolved one), with Undo in its place ──
  const allList = $("#all-list");
  /** @type {HTMLElement | null} */
  let row = null;
  drag(allList, {
    axis: "x",
    start: ({ target }) => {
      const b = /** @type {HTMLElement | null} */ (target.closest(".ar[data-go^='t:']"));
      if (!b || !A.canResolve()) return false;
      row = b;
      const t = A.threadOf((/** @type {string} */ (b.dataset.go)).slice(2));
      if (!t) return false;
      (/** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (row)).parentElement)).dataset.act = t.state === "resolved" ? "Reopen" : "Resolve";
      return true;
    },
    accept: (dx) => dx < 0,
    move: (dx) => { (/** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (row)).parentElement)).classList.add("is-swiping"); follow(/** @type {HTMLElement} */ (row), `translateX(${Math.min(0, dx)}px)`); (/** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (row)).parentElement)).classList.toggle("is-armed", -dx > (/** @type {HTMLElement} */ (row)).offsetWidth * 0.4); },
    end: async (dx, _dy, vx) => {
      const li = (/** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (row)).parentElement)), w = (/** @type {HTMLElement} */ (row)).offsetWidth;
      if (committed(dx, vx, w, 0.4)) {
        tick();
        await glide(/** @type {HTMLElement} */ (row), `translateX(${-w}px)`, { ms: 160 });
        const t = A.threadOf((/** @type {string} */ ((/** @type {HTMLElement} */ (row)).dataset.go)).slice(2));
        if (t) A.resolve(t.id, t.state !== "resolved", li);
      } else { await glide(/** @type {HTMLElement} */ (row), "translateX(0)"); unstyle(row); li.classList.remove("is-swiping", "is-armed"); }
    },
    cancel: () => { unstyle(row); row?.parentElement?.classList.remove("is-swiping", "is-armed"); },
  });

  // ── a sub-agent opened in its page: swipe right goes back to the list ──
  const runsCard = A.runsCard;
  drag(runsCard, {
    axis: "x",
    start: ({ x, target }) => A.runsDeep() && !edgeIsSafari(x) && !target.closest(OWN) && !scrollsX(target, runsCard),
    accept: (dx) => dx > 0,
    move: (dx) => follow(runsCard, `translateX(${dx}px)`),
    end: async (dx, _dy, vx) => {
      if (committed(dx, vx, runsCard.offsetWidth, 0.35)) { tick(); await glide(runsCard, `translateX(${runsCard.offsetWidth}px)`, { ms: 160, opacity: 0 }); A.runsBack(); }
      else await glide(runsCard, "translateX(0)");
      unstyle(runsCard);
    },
    cancel: () => unstyle(runsCard),
  });

  conversationGestures({ scroller: $("#scroller"), msgs: /** @type {HTMLElement} */ (document.getElementById("msgs")), say: A.say, toast: A.toast }, wordsOf);
}

/** @param {Conversation} C @param {WordsOf} wordsOf */
export function conversationGestures(C, wordsOf) {
  // ── while typing, a drag down over the conversation lowers the keyboard (the draft is kept) ──
  const sc = C.scroller;
  let y0 = /** @type {number | null} */ (null), x0 = 0;
  sc.addEventListener("touchstart", (e) => { y0 = document.activeElement === C.say && e.touches.length === 1 ? e.touches[0].clientY : null; x0 = e.touches[0]?.clientX || 0; }, { passive: true });
  sc.addEventListener("touchmove", (e) => {
    if (y0 == null) return;
    const p = e.touches[0], dy = p.clientY - y0;
    if (dy > 28 && dy > Math.abs(p.clientX - x0)) { (/** @type {HTMLElement} */ (C.say)).blur(); y0 = null; }
  }, { passive: true });
  longPress(C, wordsOf);
}

const HOLD = 480;
/** @param {Conversation} A @param {WordsOf} wordsOf */
function longPress(A, wordsOf) {
  const msgs = A.msgs;
  let timer = 0, at = /** @type {{ x: number, y: number } | null} */ (null), menu = /** @type {HTMLElement | null} */ (null), from = /** @type {HTMLElement | null} */ (null), fired = false;
  const WHAT = ".m-you .bubble, .m-them:not(.m-turn):not(.m-card) > .mb > .prose, .m-turn .tb-answer";
  const shut = () => {
    if (!menu) return;
    if (menu.contains(document.activeElement) && from && from.isConnected) {
      if (!from.hasAttribute("tabindex")) from.tabIndex = -1;
      from.focus({ preventScroll: true });
    }
    menu.remove(); menu = null; from = null;
    document.removeEventListener("touchstart", outside, true);
    document.removeEventListener("keydown", esc, true);
  };
  const outside = (/** @type {TouchEvent} */ e) => { if (menu && !menu.contains(/** @type {Node} */ (e.target))) shut(); };
  const esc = (/** @type {KeyboardEvent} */ e) => { if (e.key === "Escape") { e.stopPropagation(); shut(); } };
  const clearSel = () => { for (const el of msgs.querySelectorAll(".is-selecting")) el.classList.remove("is-selecting"); };
  document.addEventListener("selectionchange", () => { const s = getSelection(); if (s && s.isCollapsed) clearSel(); });

  msgs.addEventListener("touchstart", (e) => {
    clearTimeout(timer);
    fired = false;
    const el = e.touches.length === 1 && !(/** @type {Element} */ (e.target)).closest("a, button, input, textarea, .md-code, [data-copy]") ? (/** @type {Element} */ (e.target)).closest(WHAT) : null;
    if (!el || el.classList.contains("is-selecting")) return;
    const p = e.touches[0];
    at = { x: p.clientX, y: p.clientY };
    timer = setTimeout(() => { fired = true; tick(); open(/** @type {HTMLElement} */ (el), /** @type {{ x: number, y: number }} */ (at)); }, HOLD);
  }, { passive: true });
  msgs.addEventListener("touchmove", (e) => {
    if (!at || !timer) return;
    const p = e.touches[0];
    if (Math.hypot(p.clientX - at.x, p.clientY - at.y) > 8) { clearTimeout(timer); timer = 0; }
  }, { passive: true });
  const stop = (/** @type {TouchEvent} */ e) => { clearTimeout(timer); timer = 0; if (fired && e.cancelable) e.preventDefault(); };
  msgs.addEventListener("touchend", stop);
  msgs.addEventListener("touchcancel", stop);
  // Android opens its own menu on a long-press: ours is the one shown
  msgs.addEventListener("contextmenu", (e) => { if (fired || (matchMedia("(pointer: coarse)").matches && (/** @type {Element} */ (e.target)).closest(WHAT) && !(/** @type {Element} */ (e.target)).closest(".is-selecting"))) e.preventDefault(); });
  A.scroller.addEventListener("scroll", shut, { passive: true });

  /** @param {HTMLElement} el @param {{ x: number, y: number }} p */
  function open(el, p) {
    shut();
    from = el;
    menu = document.createElement("div");
    menu.className = "lp-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Message");
    menu.innerHTML = `<button type="button" role="menuitem" data-lp="copy">Copy</button><button type="button" role="menuitem" data-lp="select">Select text</button>`;
    menuKeys(menu, { close: shut }); // ↓ ↑ Home End; Tab closes it back to the message (Escape: esc below)
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    const x = Math.max(10, Math.min(innerWidth - r.width - 10, p.x - r.width / 2));
    const y = p.y - r.height - 18 > 10 ? p.y - r.height - 18 : p.y + 18;
    menu.style.left = `${x}px`; menu.style.top = `${y}px`;
    menu.addEventListener("click", (e) => {
      const b = /** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest("[data-lp]"));
      if (!b) return;
      // "Copied" only once it's on the clipboard; refused, said so
      if (b.dataset.lp === "copy") { copyText(wordsOf(el)).then((ok) => A.toast?.(ok ? "Copied" : COPY_REFUSED)); } // its words, as the desktop's Copy reads them
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
    setTimeout(() => { document.addEventListener("touchstart", outside, true); document.addEventListener("keydown", esc, true); }, 0);
    (/** @type {HTMLButtonElement} */ (menu.querySelector("button"))).focus({ preventScroll: true });
  }
}
