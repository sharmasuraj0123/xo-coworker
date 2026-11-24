// @ts-check

import { write } from "../../core/platform/storage.js";
import { PHONE } from "../../core/platform/viewport.js";
import { READABLE } from "./camera.js";
import { setOf } from "./tree.js";

/** @import {MapInputDeps, MapViewportDeps, MountScope, PointerStart, Scope} from "./map-types.d.ts" */

const PRESS_PX = 24;
const onPhone = () => PHONE?.matches === true;
const pressMin = () => (onPhone() ? 36 : PRESS_PX);
/** @param {HTMLElement} b @param {number} s */
const tooSmall = (b, s, anyScale = false) => (onPhone() ? pressPx(b, s) < 36 : (anyScale || s < READABLE) && pressPx(b, s) < PRESS_PX);
/** @param {HTMLElement} b @param {number} s */
function pressScale(b, s, anyScale = false) {
  const floor = pressMin() / Math.max(1, Math.min(b.offsetWidth, b.offsetHeight));
  return Math.min(2.4, onPhone() || anyScale ? Math.max(READABLE, s, floor) : READABLE);
}
/** @param {HTMLElement} nb @param {number} s */
function pressPx(nb, s) {
  const b = getComputedStyle(nb, "::before"), hit = b.content !== "none" && b.position === "absolute";
  /** @param {string} v */
  const grow = (v) => (hit ? Math.max(0, -parseFloat(v) || 0) : 0);
  return Math.min(nb.offsetWidth + 2 * grow(b.left), nb.offsetHeight + 2 * grow(b.top)) * s;
}
/** @param {HTMLElement} nb */
function nodePt(nb) {
  const transform = nb.style.transform;
  const matrix = transform && typeof DOMMatrixReadOnly === "function" ? new DOMMatrixReadOnly(transform) : null;
  return { x: (matrix?.e ?? 0) + nb.offsetLeft + nb.offsetWidth / 2, y: (matrix?.f ?? 0) + nb.offsetTop + nb.offsetHeight / 2 };
}

/** @param {MapViewportDeps} options */
function createViewportInput({ M, camera, clamp, tool }) {
  const { applyCam, camOf, fit, keepInView, zoomAt } = camera;
  /** @param {HTMLElement} v @param {Scope} scope @param {Element} t */
  function reveal(v, scope, t) {
    if (!v.clientWidth) return;
    const c = camOf(scope), b = v.getBoundingClientRect(), r = t.getBoundingClientRect();
    const m = 12, W = v.clientWidth, H = v.clientHeight - 44;
    const x0 = r.left - b.left - v.clientLeft, y0 = r.top - b.top - v.clientTop, x1 = x0 + r.width, y1 = y0 + r.height;
    let dx = 0, dy = 0;
    if (x0 < m || x1 > W - m) dx = x0 < m || x1 - x0 > W - 2 * m ? m - x0 : W - m - x1;
    if (y0 < m || y1 > H - m) dy = y0 < m || y1 - y0 > H - 2 * m ? m - y0 : H - m - y1;
    if (!dx && !dy) return;
    c.x += dx; c.y += dy; c.user = true; c.fitAll = false; applyCam(c, false);
  }
  /** @param {HTMLElement} v @param {Scope} scope @param {MountScope} lifetime */
  function wire(v, scope, lifetime) {
    /** @type {PointerStart["pts"]} */
    const pts = new Map();
    /** @type {PointerStart | null} */
    let start = null;
    lifetime.effect(() => () => {
      for (const id of pts.keys()) if (v.hasPointerCapture?.(id)) v.releasePointerCapture(id);
      M.dragged = false;
      v.classList.remove("is-drag");
    });
    lifetime.listen(v, "focusin", ({ target }) => {
      if (target instanceof Element && target !== v && target.closest(".dg-world")) reveal(v, scope, target);
    });
    lifetime.listen(v, "focusout", (event) => {
      const e = /** @type {FocusEvent} */ (event);
      const { target, relatedTarget } = e;
      if (!(target instanceof Element) || !target.closest(".dg-world")) return;
      if (relatedTarget instanceof Element && relatedTarget.closest(".dg-world")) return;
      const c = camOf(scope);
      if (c.follow && M.lead) keepInView(c, M.lead);
    });
    lifetime.listen(v, "pointerdown", (event) => {
      const e = /** @type {PointerEvent} */ (event);
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (/** @type {Element} */ (e.target).closest(".dg-tools, .dg-key, .dg-tag")) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const c = camOf(scope);
      start = { pts: new Map(pts), x: c.x, y: c.y, s: c.s, moved: false };
    });
    lifetime.listen(v, "pointermove", (event) => {
      const e = /** @type {PointerEvent} */ (event);
      if (!pts.has(e.pointerId) || !start) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const c = camOf(scope);
      const [a, b] = [...pts.values()];
      const [a0, b0] = [...start.pts.values()];
      if (pts.size === 1 && a0) {
        const dx = a.x - a0.x, dy = a.y - a0.y;
        if (!start.moved && Math.hypot(dx, dy) < 5) return;
        if (!start.moved) { start.moved = true; v.setPointerCapture(e.pointerId); v.classList.add("is-drag"); }
        c.x = start.x + dx; c.y = start.y + dy;
      } else if (b && b0) {
        const r = v.getBoundingClientRect();
        const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1, d1 = Math.hypot(b.x - a.x, b.y - a.y);
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        const s = clamp(start.s * (d1 / d0), 0.25, 2.4);
        c.x = mx - (mx - start.x) * (s / start.s); c.y = my - (my - start.y) * (s / start.s); c.s = s;
        start.moved = true;
      } else return;
      c.user = true; c.follow = false; c.fitAll = false;
      applyCam(c, false);
    });
    /** @param {Event} event */
    const up = (event) => {
      const e = /** @type {PointerEvent} */ (event);
      pts.delete(e.pointerId);
      if (start && start.moved) { M.dragged = true; lifetime.timeout(() => { M.dragged = false; }, 0); }
      v.classList.remove("is-drag");
      if (!pts.size) {
        start = null;
      } else {
        const c = camOf(scope);
        start = { pts: new Map(pts), x: c.x, y: c.y, s: c.s, moved: true };
      }
    };
    lifetime.listen(v, "pointerup", up);
    lifetime.listen(v, "pointercancel", up);
    lifetime.listen(v, "wheel", (event) => {
      const e = /** @type {WheelEvent} */ (event);
      e.preventDefault();
      const c = camOf(scope);
      if (e.ctrlKey || e.metaKey) {
        const r = v.getBoundingClientRect();
        zoomAt(c, Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
      } else {
        c.x -= e.deltaX;
        c.y -= e.deltaY;
        c.user = true;
        c.follow = false;
        c.fitAll = false;
        applyCam(c, false);
      }
    }, { passive: false });
    lifetime.listen(v, "keydown", (event) => {
      const e = /** @type {KeyboardEvent} */ (event);
      if (e.target !== v || e.metaKey || e.ctrlKey || e.altKey) return;
      const c = camOf(scope);
      const mid = () => /** @type {[number, number]} */ ([v.clientWidth / 2, v.clientHeight / 2]);
      const k = e.key;
      if (k === "+" || k === "=") zoomAt(c, 1.2, ...mid());
      else if (k === "-" || k === "_") zoomAt(c, 1 / 1.2, ...mid());
      else if (k === "0") { c.user = true; c.follow = false; c.fitAll = true; fit(c, true, true); }
      else if (k === "f" || k === "F") tool("follow");
      else if (k === "g" || k === "G") tool(M.mode === "graph" ? "tree" : "graph");
      else if (k.startsWith("Arrow")) {
        const delta = 60;
        c.x += k === "ArrowLeft" ? delta : k === "ArrowRight" ? -delta : 0;
        c.y += k === "ArrowUp" ? delta : k === "ArrowDown" ? -delta : 0;
        c.user = true;
        c.follow = false;
        c.fitAll = false;
        applyCam(c, true);
      }
      else return;
      e.preventDefault();
    });
  }
  return wire;
}

/** @param {MapInputDeps} options */
export function createMapInput({ M, host, view, camera, clamp, paint, load, tagW, modeKey, announce, go, openFile }) {
  const { camOf, centerOn, fit, zoomAt } = camera;
  /** @param {string} what */
  function tool(what, { focus = true } = {}) {
    const scope = M.scope, v = view();
    if (!v || !scope) return;
    const c = camOf(scope);
    if (what === "in" || what === "out") zoomAt(c, what === "in" ? 1.25 : 0.8, v.clientWidth / 2, v.clientHeight / 2);
    else if (what === "fit") { c.user = true; c.follow = false; c.fitAll = true; fit(c, true, true); }
    else if (what === "tree" || what === "graph") {
      if (M.mode === what) return;
      M.mode = what;
      const next = camOf(scope);
      if (!next.user || next.fitAll) {
        next.done = false;
        next.settleUntil = 0;
        next.target = null;
        next.fitB = null;
      }
      write(modeKey, what);
      host().dataset.scope = "";
      paint();
      if (focus) view()?.focus({ preventScroll: true });
      announce(what === "graph" ? "Graph view." : "Diagram view.");
    }
    else if (what === "follow") {
      c.follow = !c.follow;
      if (c.follow) c.fitAll = false;
      if (c.follow && M.lead) { c.target = M.lead.key; centerOn(c, M.lead.pt, true); }
      host().querySelector('[data-dg="follow"]')?.setAttribute("aria-pressed", String(!!c.follow));
      announce(c.follow ? "Following the agent." : "Not following.");
    }
  }
  /** @param {HTMLElement} node @param {MountScope} mountScope */
  function bind(node, mountScope) {
    if (document.fonts) mountScope.listen(document.fonts, "loadingdone", () => { M.reachKey = ""; });
    mountScope.listen(node, "click", (event) => {
      const t = event.target, scope = M.scope;
      if (!(t instanceof Element) || !scope) return;
      const e = /** @type {MouseEvent} */ (event);
      const tl = t.closest("[data-dg]");
      if (tl instanceof HTMLElement && tl.dataset.dg) { tool(tl.dataset.dg); return; }
      const g = t.closest("[data-mp-go]");
      if (g instanceof HTMLElement && g.dataset.mpGo !== undefined) {
        const cg = camOf(scope), cur = g.closest(".dg-cur");
        const m = cur instanceof HTMLElement && /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(cur.style.transform);
        if (e.detail > 0 && m && tooSmall(g, cg.s, true)) {
          cg.user = true; cg.follow = false; cg.fitAll = false;
          centerOn(cg, { x: +m[1], y: +m[2] }, true, pressScale(g, cg.s, true));
          announce(`Closer to ${g.textContent.trim() || "it"}: press it again to open it.`);
          return;
        }
        go(g.dataset.mpGo); return;
      }
      const fc = t.closest("[data-mp-focus]");
      if (fc instanceof HTMLElement && fc.dataset.mpFocus !== undefined) {
        const c = camOf(scope), cur = M.curs.get(fc.dataset.mpFocus);
        if (cur) {
          const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(cur.el.style.transform);
          if (m) { c.user = true; c.follow = false; c.fitAll = false; centerOn(c, { x: +m[1], y: +m[2] }, true, Math.max(c.s, 0.9)); }
          cur.el.classList.remove("is-ping"); void cur.el.offsetWidth; cur.el.classList.add("is-ping");
        }
        return;
      }
      const nb = t.closest("[data-node]");
      if (!(nb instanceof HTMLElement) || nb.dataset.node === undefined || M.dragged) return;
      const id = nb.dataset.node, r = M.refs.get(id);
      if (!r) return;
      const cz = camOf(scope);
      if (e.detail > 0 && tooSmall(nb, cz.s)) {
        cz.user = true; cz.follow = false; cz.fitAll = false;
        const pt = nodePt(nb);
        centerOn(cz, { x: pt.x - tagW() / 2, y: pt.y }, true, pressScale(nb, cz.s));
        announce(`Closer to ${nb.textContent.trim() || "it"}: press it again to open it.`);
        return;
      }
      const key = scope.key;
      if (r.toggle != null || r.more != null) {
        M.anchorId = id;
        cz.user = true;
        if (r.more != null) setOf(M.more, key).add(r.more);
        else if (r.toggle != null) {
          const opened = setOf(M.opened, key), closed = setOf(M.closed, key);
          if (r.open) {
            opened.delete(r.toggle);
            closed.add(r.toggle);
          } else {
            closed.delete(r.toggle);
            opened.add(r.toggle);
          }
        }
        paint();
      }
      else if (r.retry != null && r.fold) load(r.fold, r.retry, { again: true });
      else if (r.go) go(r.go);
      else if (r.open && typeof r.open === "object") openFile(r.open, nb);
    });

  }
  return { wire: createViewportInput({ M, camera, clamp, tool }), bind, tool };
}
