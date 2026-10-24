// Touch gestures (design-research/11-mobile-gestures.md). One primitive, `drag`, and the app's gestures
// built from it. Every gesture is a shortcut for a button that is already on screen: Back, the sidebar,
// closing a sheet, the next ask, folding the decision card, Resolve. One direction keeps one meaning:
// right steps back toward the list, down puts something away, left acts on a row. No ask is ever
// answered by a gesture (kit.js), and a terminal keeps every touch for itself.
//
// The surface follows the finger and settles on release by distance or speed, so you can change your
// mind halfway. Touch events (not pointer events) because only a cancelable touchmove can stop the
// browser's own scroll once a direction is picked.

const LOCK = 10;     // px before a touch picks its direction
const SLOPE = 1.7;   // the picked axis must lead the other by this much: within ~30° of it
export const FLICK = 0.45; // px/ms: a quick flick commits whatever the distance
const EASE = "cubic-bezier(.2,.8,.2,1)";

const RM = matchMedia("(prefers-reduced-motion: reduce)");
const IOS = /iP(hone|ad|od)/.test(navigator.platform) || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1);
const STANDALONE = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
// Safari owns its left edge (its own Back, which history makes the app's Back); a home-screen app has none
export const edgeIsSafari = (x) => IOS && !STANDALONE && x < 24;

let claimed = null; // the one touch a gesture owns
document.addEventListener("touchstart", (e) => { if (e.touches.length === 1) claimed = null; }, { capture: true, passive: true });

/** A light tick where the platform has one (Android); iOS Safari has no web vibration. */
export function tick() { try { navigator.vibrate?.(8); } catch { /* not allowed */ } }

/** Does something between `el` and `root` scroll sideways (a code block, the Now shelf, a table)? */
export function scrollsX(el, root) {
  for (let n = el; n && n !== root; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1) { const o = getComputedStyle(n).overflowX; if (o === "auto" || o === "scroll") return true; }
  }
  return false;
}
/** How far the nearest vertical scroller from `el` up to `root` is from its top (0: at the top, or none). */
export function scrolledY(el, root) {
  for (let n = el; n; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1) { const o = getComputedStyle(n).overflowY; if (o === "auto" || o === "scroll") return n.scrollTop; }
    if (n === root) break;
  }
  return 0;
}
const selecting = () => { const s = getSelection(); return !!s && !s.isCollapsed && String(s).trim() !== ""; };

/**
 * One finger, one axis. o = {
 *   axis: "x" | "y",
 *   start(t) → false to leave this touch alone; t = {x, y, target}
 *   accept(dx, dy) → false when the picked direction isn't wanted (called once, at the lock)
 *   move(dx, dy), end(dx, dy, vx, vy) with velocity in px/ms, cancel()
 * }
 */
export function drag(el, o) {
  let s = null;
  const drop = () => { if (s && claimed === s) claimed = null; s = null; };
  el.addEventListener("touchstart", (e) => {
    s = null;
    if (e.touches.length !== 1) return;
    const p = e.touches[0];
    if (o.start && o.start({ x: p.clientX, y: p.clientY, target: e.target }) === false) return;
    s = { id: p.identifier, x0: p.clientX, y0: p.clientY, locked: false, pts: [[p.clientX, p.clientY, e.timeStamp]] };
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (!s) return;
    const p = [...e.touches].find((x) => x.identifier === s.id);
    if (!p || e.touches.length !== 1) { if (s.locked) o.cancel?.(); drop(); return; }
    const dx = p.clientX - s.x0, dy = p.clientY - s.y0;
    if (!s.locked) {
      if (claimed) { s = null; return; }
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      const [a, b] = o.axis === "x" ? [dx, dy] : [dy, dx];
      // the browser already scrolls (an uncancelable move), or it's the other axis: not ours
      if (Math.abs(a) < Math.abs(b) * SLOPE || !e.cancelable || selecting() || (o.accept && o.accept(dx, dy) === false)) { s = null; return; }
      s.locked = true; claimed = s;
    }
    if (e.cancelable) e.preventDefault();
    s.pts.push([p.clientX, p.clientY, e.timeStamp]);
    if (s.pts.length > 6) s.pts.shift();
    o.move(dx, dy);
  }, { passive: false });
  el.addEventListener("touchend", (e) => {
    if (!s) return;
    const st = s;
    drop();
    if (!st.locked) return;
    const p = [...e.changedTouches].find((x) => x.identifier === st.id) || e.changedTouches[0];
    const now = e.timeStamp;
    const old = st.pts.find((q) => now - q[2] < 90) || st.pts[st.pts.length - 1];
    const dt = Math.max(1, now - old[2]);
    // the app hears when a gesture has settled (Back keeps its own history entry ready)
    Promise.resolve(o.end(p.clientX - st.x0, p.clientY - st.y0, (p.clientX - old[0]) / dt, (p.clientY - old[1]) / dt))
      .finally(() => document.dispatchEvent(new CustomEvent("xo:gesture")));
  });
  el.addEventListener("touchcancel", () => { if (s && s.locked) o.cancel?.(); drop(); });
}

/** Move `el` to `transform` (and `opacity`) smoothly; resolves when it's there. */
export function glide(el, transform, { ms = 220, opacity } = {}) {
  const d = RM.matches ? 0 : ms;
  el.style.transition = d ? `transform ${d}ms ${EASE}, opacity ${d}ms ${EASE}` : "none";
  el.style.transform = transform;
  if (opacity != null) el.style.opacity = String(opacity);
  return new Promise((res) => setTimeout(res, d));
}
/** Follow the finger: no transition while it's down. */
export function follow(el, transform, opacity) {
  el.style.transition = "none";
  el.style.transform = transform;
  if (opacity != null) el.style.opacity = String(opacity);
}
export function unstyle(...els) { for (const el of els) if (el) { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; } }
/** Past the end there is nothing to reach: it stretches a little and springs back. */
const band = (d) => d * 0.28;
const committed = (d, v, size, frac) => Math.abs(d) > size * frac || (Math.abs(v) > FLICK && Math.sign(v) === Math.sign(d) && Math.abs(d) > 24);

// never start a navigation swipe on these: they take touches of their own
const OWN = "input, textarea, select, [contenteditable], .b-hold, pre, table, .md-code, .vw-code, iframe, .xterm, [data-noswipe]";

/**
 * The app's gestures. `A` is what app.js lets them do:
 *   phone() · overlay() (anything over the page) · view() · back() · drawer(open?) · isDrawer()
 *   closeSettings() · settingsOpen() · viewerOpen() · closeViewer()
 *   sheets: [{host, card?(), open(), close()}] · panelOpen() · runsDeep() · runsBack()
 *   say (the composer's field) · canResolve() · resolve(tid, resolved, li) · threadOf(id)
 */
export function wireGestures(A) {
  const $ = (s) => document.querySelector(s);
  const main = $("#main"), side = $("#side"), scrim = $("#side-scrim");
  const W = () => main.clientWidth || innerWidth;

  // ── swipe right on the page: back a level; at the top level, the sidebar ──
  let mode = null;
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
        for (const el of [conv, dock]) follow(el, `translateX(${dx}px)`);
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

  // ── swipe left on the open sidebar (or its scrim): put it away ──
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

  // ── swipe right on Settings or the file viewer (full screen on a phone): close, back where you were ──
  const page = (el, open, close) => drag(el, {
    axis: "x",
    start: ({ x, target }) => A.phone() && open() && !edgeIsSafari(x) && !target.closest(OWN) && !scrollsX(target, el) && !target.closest(".vw-img.is-actual"),
    accept: (dx) => dx > 0,
    move: (dx) => follow(el, `translateX(${dx}px)`),
    end: async (dx, _dy, vx) => {
      if (committed(dx, vx, W(), 0.35)) { tick(); await glide(el, `translateX(${W()}px)`, { ms: 180 }); close(); unstyle(el); }
      else { await glide(el, "translateX(0)"); unstyle(el); }
    },
    cancel: () => unstyle(el),
  });
  page($("#settings"), A.settingsOpen, A.closeSettings);
  page($("#viewer"), A.viewerOpen, A.closeViewer);

  // ── drag down to put a sheet (or the full-screen viewer) away ──
  const putAway = (host, card, open, close, frac = 0.25) => {
    let el = null;
    drag(host, {
      axis: "y",
      start: ({ target }) => {
        el = card();
        if (!el || !open() || !el.contains(target) || target.closest(OWN) || target.closest(".vw-img.is-actual")) return false;
        if (window.visualViewport && visualViewport.scale > 1.01) return false; // pinch-zoomed: the finger pans
        return scrolledY(target, el) <= 0;
      },
      accept: (_dx, dy) => dy > 0,
      move: (_dx, dy) => follow(el, `translateY(${Math.max(0, dy)}px)`),
      end: async (_dx, dy, _vx, vy) => {
        const h = el.offsetHeight || innerHeight;
        if (committed(dy, vy, h, frac)) {
          tick();
          await glide(el, `translateY(${h}px)`, { ms: 180, opacity: 0 });
          close();
          setTimeout(() => unstyle(el), 360);
        } else { await glide(el, "translateY(0)"); unstyle(el); }
      },
      cancel: () => unstyle(el),
    });
  };
  for (const s of A.sheets) putAway(s.host, s.card || (() => s.host), s.open, s.close);
  const viewer = $("#viewer");
  putAway(viewer, () => viewer, () => A.phone() && A.viewerOpen(), A.closeViewer, 0.2);

  // ── Needs you: swipe the card sideways for the next ask or the one before. It never answers. ──
  const stage = $("#pn-stage"), foot = $("#pn-foot");
  const navBtn = (d) => foot.querySelector(`[data-nav="${d}"]`);
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

  // ── a thread's decision card: drag down to fold it ("Read the thread first"), up on the bar to open it ──
  const tdock = $("#tdock");
  let tgt = null;
  drag(tdock, {
    axis: "y",
    start: ({ target }) => {
      tgt = target.closest(".card.is-dock:not(.r-done)") || target.closest(".dock-fold");
      if (!tgt || target.closest(OWN)) return false;
      return tgt.classList.contains("dock-fold") || scrolledY(target, tgt) <= 0;
    },
    accept: (_dx, dy) => (tgt.classList.contains("dock-fold") ? dy < 0 : dy > 0),
    move: (_dx, dy) => follow(tgt, `translateY(${tgt.classList.contains("dock-fold") ? Math.max(-36, dy * 0.5) : Math.max(0, dy)}px)`),
    end: async (_dx, dy, _vx, vy) => {
      const fold = tgt.classList.contains("dock-fold");
      if (fold ? committed(dy, vy, 60, 1) || dy < -28 : committed(dy, vy, tgt.offsetHeight, 0.3)) {
        tick();
        if (fold) { unstyle(tgt); tgt.click(); return; }
        await glide(tgt, `translateY(${tgt.offsetHeight}px)`, { ms: 160, opacity: 0 });
        tgt.querySelector(".dock-hide")?.click();
      } else { await glide(tgt, "translateY(0)"); unstyle(tgt); }
    },
    cancel: () => unstyle(tgt),
  });

  // ── All threads: swipe a row left to Resolve it (Reopen a resolved one), with Undo in its place ──
  const allList = $("#all-list");
  let row = null;
  drag(allList, {
    axis: "x",
    start: ({ target }) => {
      const b = target.closest(".ar[data-go^='t:']");
      if (!b || !A.canResolve()) return false;
      row = b;
      const t = A.threadOf(b.dataset.go.slice(2));
      if (!t) return false;
      row.parentElement.dataset.act = t.state === "resolved" ? "Reopen" : "Resolve";
      return true;
    },
    accept: (dx) => dx < 0,
    move: (dx) => { row.parentElement.classList.add("is-swiping"); follow(row, `translateX(${Math.min(0, dx)}px)`); row.parentElement.classList.toggle("is-armed", -dx > row.offsetWidth * 0.4); },
    end: async (dx, _dy, vx) => {
      const li = row.parentElement, w = row.offsetWidth;
      if (committed(dx, vx, w, 0.4)) {
        tick();
        await glide(row, `translateX(${-w}px)`, { ms: 160 });
        const t = A.threadOf(row.dataset.go.slice(2));
        if (t) A.resolve(t.id, t.state !== "resolved", li);
      } else { await glide(row, "translateX(0)"); unstyle(row); li.classList.remove("is-swiping", "is-armed"); }
    },
    cancel: () => { unstyle(row); row?.parentElement?.classList.remove("is-swiping", "is-armed"); },
  });

  // ── a sub-agent opened in its sheet: swipe right goes back to the list ──
  const runsCard = $("#runs-card");
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

  // ── while typing, a drag down over the conversation lowers the keyboard (the draft is kept) ──
  {
    const sc = $("#scroller");
    let y0 = null, x0 = 0;
    sc.addEventListener("touchstart", (e) => { y0 = document.activeElement === A.say && e.touches.length === 1 ? e.touches[0].clientY : null; x0 = e.touches[0]?.clientX || 0; }, { passive: true });
    sc.addEventListener("touchmove", (e) => {
      if (y0 == null) return;
      const p = e.touches[0], dy = p.clientY - y0;
      if (dy > 28 && dy > Math.abs(p.clientX - x0)) { A.say.blur(); y0 = null; }
    }, { passive: true });
  }

  longPress(A);
}

// ── long-press a message: Copy, Select text ─────────────────────────────────
const HOLD = 480;
function longPress(A) {
  const msgs = document.getElementById("msgs");
  let timer = 0, at = null, menu = null, fired = false;
  const WHAT = ".m-you .bubble, .m-them:not(.m-turn):not(.m-card) > .mb > .prose, .m-turn .tb-answer";
  const shut = () => {
    if (!menu) return;
    menu.remove(); menu = null;
    document.removeEventListener("touchstart", outside, true);
    document.removeEventListener("keydown", esc, true);
  };
  const outside = (e) => { if (menu && !menu.contains(e.target)) shut(); };
  const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); shut(); } };
  const clearSel = () => { for (const el of msgs.querySelectorAll(".is-selecting")) el.classList.remove("is-selecting"); };
  document.addEventListener("selectionchange", () => { const s = getSelection(); if (s && s.isCollapsed) clearSel(); });

  msgs.addEventListener("touchstart", (e) => {
    clearTimeout(timer);
    fired = false;
    const el = e.touches.length === 1 && !e.target.closest("a, button, input, textarea, .md-code, [data-copy]") ? e.target.closest(WHAT) : null;
    if (!el || el.classList.contains("is-selecting")) return;
    const p = e.touches[0];
    at = { x: p.clientX, y: p.clientY };
    timer = setTimeout(() => { fired = true; tick(); open(el, at); }, HOLD);
  }, { passive: true });
  msgs.addEventListener("touchmove", (e) => {
    if (!at || !timer) return;
    const p = e.touches[0];
    if (Math.hypot(p.clientX - at.x, p.clientY - at.y) > 8) { clearTimeout(timer); timer = 0; }
  }, { passive: true });
  const stop = (e) => { clearTimeout(timer); timer = 0; if (fired && e.cancelable) e.preventDefault(); };
  msgs.addEventListener("touchend", stop);
  msgs.addEventListener("touchcancel", stop);
  // Android opens its own menu on a long-press: ours is the one shown
  msgs.addEventListener("contextmenu", (e) => { if (fired || (matchMedia("(pointer: coarse)").matches && e.target.closest(WHAT) && !e.target.closest(".is-selecting"))) e.preventDefault(); });
  document.getElementById("scroller").addEventListener("scroll", shut, { passive: true });

  function open(el, p) {
    shut();
    menu = document.createElement("div");
    menu.className = "lp-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `<button type="button" role="menuitem" data-lp="copy">Copy</button><button type="button" role="menuitem" data-lp="select">Select text</button>`;
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    const x = Math.max(10, Math.min(innerWidth - r.width - 10, p.x - r.width / 2));
    const y = p.y - r.height - 18 > 10 ? p.y - r.height - 18 : p.y + 18;
    menu.style.left = `${x}px`; menu.style.top = `${y}px`;
    menu.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lp]");
      if (!b) return;
      if (b.dataset.lp === "copy") { copyText((el.innerText || el.textContent || "").trim()); A.toast?.("Copied"); }
      else {
        el.classList.add("is-selecting");
        const s = getSelection();
        s.removeAllRanges();
        s.selectAllChildren(el);
      }
      shut();
    });
    setTimeout(() => { document.addEventListener("touchstart", outside, true); document.addEventListener("keydown", esc, true); }, 0);
    menu.querySelector("button").focus({ preventScroll: true });
  }
}
/** Copy, even where the async clipboard isn't offered (a plain-http address on the network). */
export function copyText(text) {
  if (navigator.clipboard && isSecureContext) { navigator.clipboard.writeText(text).catch(() => legacy(text)); return; }
  legacy(text);
}
function legacy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch { /* nothing more to try */ }
  ta.remove();
}
