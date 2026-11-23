// @ts-check

import { drag, follow, glide, unstyle, tick, FLICK } from "../../core/platform/gestures.js";

const MIN_H = 140;

/** @param {import('./dock-types.js').DockState} R @param {import('./dock-types.js').DockInputOptions} input */
export function bindDockInput(R, {
  root, side, listEl, tabsEl, grip, LIST, showList, toggle, activate, detach, attach, startRename, askClose,
  openProject, openWorkspace, askCloseDetached, changed, keepIt, closeShell, closeDetached, away, saveRename,
  render, renameBack, owns, persist,
}) {
  // the sidebar's toggle: the same as the key. Opening with nothing attached shows the list of every shell.
  side.addEventListener("click", () => {
    if (!R.open && !R.tabs.size) { showList(null); return; }
    toggle();
  });
  root.addEventListener("click", (e) => {
    const t = /** @type {import("./dock-types.js").DockTarget} */ (e.target);
    if (t.closest('[aria-disabled="true"]')) return; // waiting on the backend: it answers nothing
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
  root.addEventListener("keydown", (e) => {
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
  root.addEventListener("focusout", (e) => {
    const inp = /** @type {(HTMLInputElement & {dataset: {shName: string}}) | null} */ ((/** @type {import("./dock-types.js").DockTarget} */ (e.target)).closest?.("[data-sh-name]"));
    if (inp && R.edit === inp.dataset.shName) setTimeout(() => { if (R.edit === inp.dataset.shName && document.activeElement !== inp) saveRename(inp.dataset.shName, inp.value); }, 0);
  });

  /** @param {number} h */
  const clampH = (h) => Math.round(Math.max(MIN_H, Math.min(innerHeight * 0.85, h)));
  grip.addEventListener("pointerdown", (e) => {
    if (R.min) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const y0 = e.clientY, h0 = R.h;
    root.classList.add("is-dragging");
    const move = (/** @type {PointerEvent} */ ev) => { R.h = clampH(h0 + (y0 - ev.clientY)); root.style.setProperty("--shd-h", `${R.h}px`); };
    const up = () => {
      grip.removeEventListener("pointermove", move);
      root.classList.remove("is-dragging");
      persist();
      R.tabs.get(R.active)?.handle.refit();
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up, { once: true });
    grip.addEventListener("pointercancel", up, { once: true });
  });
  grip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    R.h = clampH(R.h + (e.key === "ArrowUp" ? 32 : -32));
    render(); persist();
  });

  // on a phone the dock is a sheet: drag its bar between full screen and half, or down to put it away
  const PHONE = matchMedia("(max-width: 760px)");
  const bar = /** @type {HTMLElement} */ (root.querySelector(".shd-bar"));
  const refit = () => R.tabs.get(R.active)?.handle.refit();
  drag(bar, {
    axis: "y",
    start: ({ target }) => PHONE.matches && R.open && !R.min && !target.closest("input"),
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
        await glide(root, `translateY(${H - root.offsetTop}px)`, { ms: 180 });
        R.min = true; R.half = false; unstyle(root); changed();
        away();
        return;
      }
      const target = to === "half" ? Math.round(H * 0.45) : 0;
      await glide(root, `translateY(${target - root.offsetTop}px)`, { ms: 200 });
      R.half = to === "half"; unstyle(root); render(); refit();
    },
    cancel: () => unstyle(root),
  });
  PHONE.addEventListener("change", () => { if (R.half) { R.half = false; render(); refit(); } });

  // a reload while a shell is on screen asks first (⌘W / Ctrl+W can't be caught)
  addEventListener("beforeunload", (e) => {
    if ([...R.tabs.values()].some((t) => t.state === "live")) { e.preventDefault(); e.returnValue = ""; }
  });

  return { PHONE, refit };
}
