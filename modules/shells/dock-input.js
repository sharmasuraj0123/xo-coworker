// @ts-check

import { drag, follow, glide, unstyle, tick, FLICK } from "../../core/platform/gestures.js";
import { PHONE } from "../../core/platform/viewport.js";
import { bindDockResize } from "./dock-resize.js";

/** @param {import('./dock-types.js').DockState} R @param {import('./dock-types.js').DockInputOptions} input */
export function bindDockInput(R, {
  root, side, listEl, tabsEl, grip, LIST, showList, toggle, activate, detach, attach, startRename, askClose,
  openProject, openWorkspace, askCloseDetached, changed, keepIt, closeShell, closeDetached, away, saveRename,
  render, renameBack, owns, persist, scope,
}) {
  scope.listen(side, "click", () => {
    if (!R.open && !R.tabs.size) { showList(null); return; }
    toggle();
  });
  scope.listen(root, "click", (e) => {
    const t = /** @type {import("./dock-types.js").DockTarget} */ (e.target);
    if (t.closest('[aria-disabled="true"]')) return;
    const tb = t.closest("[data-sh-tab]");
    if (tb) { activate(tb.dataset.shTab); return; }
    const dt = t.closest("[data-sh-detach]");
    if (dt) { detach(dt.dataset.shDetach); return; }
    const op = t.closest("[data-sh-open]");
    if (op) { attach(op.dataset.shOpen); return; }
    const rn = t.closest("[data-sh-rename]");
    if (rn) { startRename(rn.dataset.shRename); return; }
    const cl = t.closest("[data-sh-close]");
    if (cl) { askClose(cl.dataset.shClose, !!cl.closest(".shl-row")); return; }
    const rt = t.closest("[data-sh-retry]");
    // Retry now / Try again: the note goes as it reconnects; the shell itself has focus, under it
    if (rt) { const tab = R.tabs.get(rt.dataset.shRetry); tab?.handle.reconnect(); tab?.handle.focus(); return; }
    if (t.closest("[data-sh-new]")) { const f = R.filter; if (f && f !== "workspace") openProject(f, { fresh: true }); else openWorkspace({ fresh: true }); return; }
    if (t.closest("[data-sh-closedet]")) { askCloseDetached(); return; }
    const fl = t.closest("[data-sh-filter]");
    // Show every shell: the button goes with the filter; focus on New shell (the same control, now for the workspace)
    if (fl) { R.filter = fl.dataset.shFilter || null; changed(); listEl.querySelector("[data-sh-new]")?.focus(); return; }
    if (t.closest("[data-sh-no]")) { keepIt(); return; }
    if (t.closest("[data-sh-yes]")) { const c = R.confirm; if (c?.kind === "close") closeShell(c.id); else if (c) closeDetached(c.ids); return; }
    if (t.closest("[data-sh-min]")) { toggle(); return; }
    if (t.closest("[data-sh-hide]")) { R.open = false; changed(); away(); return; }
    // a click on the minimised bar opens it again
    if (R.min && t.closest(".shd-bar")) { R.min = false; activate(R.active); }
  });
  scope.listen(root, "keydown", (event) => {
    const e = /** @type {KeyboardEvent} */ (event);
    const inp = /** @type {(HTMLInputElement & {dataset: {shName: string}}) | null} */ ((/** @type {import("./dock-types.js").DockTarget} */ (e.target)).closest?.("[data-sh-name]"));
    if (inp) {
      if (e.key === "Enter") { e.preventDefault(); saveRename(inp.dataset.shName, inp.value); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); const id = inp.dataset.shName; R.edit = null; render(); root.querySelector(renameBack(id))?.focus(); }
      return;
    }
    if (owns(e)) return; // the shell has every key
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      if (R.confirm) { keepIt(); return; }
      R.min = true; changed();
      away();
      return;
    }
    // ← → between tabs; Home and End to the ends
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) && (/** @type {import("./dock-types.js").DockTarget} */ (e.target)).closest?.("[data-sh-tab]")) {
      const ids = [LIST, ...R.order];
      const i = ids.indexOf((/** @type {HTMLElement & {dataset: {shTab: string}}} */ ((/** @type {Element} */ (e.target)).closest("[data-sh-tab]"))).dataset.shTab);
      const nx = e.key === "Home" ? ids[0] : e.key === "End" ? ids[ids.length - 1] : ids[(i + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length];
      e.preventDefault();
      activate(nx, { focus: false });
      tabsEl.querySelector(`[data-sh-tab="${CSS.escape(nx)}"]`)?.focus();
    }
  });
  scope.listen(root, "focusout", (e) => {
    const inp = /** @type {(HTMLInputElement & {dataset: {shName: string}}) | null} */ ((/** @type {import("./dock-types.js").DockTarget} */ (e.target)).closest?.("[data-sh-name]"));
    if (inp && R.edit === inp.dataset.shName) scope.timeout(() => { if (R.edit === inp.dataset.shName && document.activeElement !== inp) saveRename(inp.dataset.shName, inp.value); }, 0);
  });

  const bar = /** @type {HTMLElement} */ (root.querySelector(".shd-bar"));
  const refit = () => R.tabs.get(R.active)?.handle.refit();
  bindDockResize(R, { grip, root, scope, render, persist, refit });
  scope.effect(() => () => unstyle(root));
  drag(bar, {
    axis: "y",
    signal: scope.signal,
    start: ({ target }) => !!PHONE?.matches && R.open && !R.min && !target.closest("input"),
    move: (_dx, dy) => follow(root, `translateY(${Math.max(R.half ? -root.offsetTop : 0, dy)}px)`),
    end: async (_dx, dy, _vx, vy) => {
      const H = innerHeight, top = root.offsetTop + dy;
      const flick = Math.abs(vy) > FLICK ? Math.sign(vy) : 0;
      // where it settles: full, half, or away; a flick moves one step its way
      let to = top < H * 0.25 ? "full" : top < H * 0.72 ? "half" : "away";
      if (flick > 0) to = R.half ? "away" : "half";
      if (flick < 0) to = "full";
      if (to !== (R.half ? "half" : "full")) tick();
      if (to === "away") {
        await glide(root, `translateY(${H - root.offsetTop}px)`, { ms: 180, scope });
        if (scope.signal.aborted) return;
        R.min = true; R.half = false; unstyle(root); changed();
        away();
        return;
      }
      const target = to === "half" ? Math.round(H * 0.45) : 0;
      await glide(root, `translateY(${target - root.offsetTop}px)`, { ms: 200, scope });
      if (scope.signal.aborted) return;
      R.half = to === "half"; unstyle(root); render(); refit();
    },
    cancel: () => unstyle(root),
  });
  if (PHONE) scope.listen(PHONE, "change", () => { if (R.half) { R.half = false; render(); refit(); } });

  scope.listen(window, "beforeunload", (event) => {
    const e = /** @type {BeforeUnloadEvent} */ (event);
    if ([...R.tabs.values()].some((t) => t.state === "live")) { e.preventDefault(); e.returnValue = ""; }
  });

  return { PHONE, refit };
}
