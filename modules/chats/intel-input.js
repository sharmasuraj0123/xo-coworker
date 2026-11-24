// @ts-check

import * as K from "../../core/platform/keys.js";

/** @import { InputOptions, IntelMove, IntelPop, IntelState, IntelTarget } from "./intel-types.js" */

/** @param {IntelState} P @param {ReturnType<typeof import("../../core/kernel/scope.js").createScope>} scope @param {InputOptions} options */
export function bindIntelInput(P, scope, {
  pop, threadOf, deepPick, save, close, render, lookAt, setRuntime, stepBack, moveGo,
  pickMove, route, done, pickModel, pickEffort, place,
}) {
  scope.listen(pop, "click", /** @type {EventListener} */ ((/** @type {MouseEvent & {target: IntelTarget}} */ e) => {
    const sm = e.target.closest("[data-lsimple]");
    if (sm) {
      if (sm.getAttribute("aria-disabled") === "true" || sm.getAttribute("aria-checked") === "true") return;
      const s = (/** @type {string} */ (P.session));
      // every change of this setting goes through the one ordered save (save()): a Done still out for this
      if (sm.dataset.lsimple === "auto") { save(s, { auto: true }, P.gen); close({ apply: false }); return; }
      const d = deepPick(s);
      if (d) { save(s, { auto: false, model: d.model, effort: d.effort }, P.gen); close({ apply: false }); }
      return;
    }
    if (e.target.closest("[data-lfull]")) { P.full = true; render(); pop.focus({ preventScroll: true }); return; }
    const rt = e.target.closest("[data-lrt]");
    if (rt) {
      if (rt.getAttribute("aria-disabled") === "true" || rt.disabled) return;
      if (threadOf((/** @type {string} */ (P.session)))) { lookAt(rt.dataset.lrt); return; }
      setRuntime((/** @type {string} */ (P.session)), rt.dataset.lrt); return;
    }
    // a choice that waits (aria-disabled: a save or a move is out) does nothing, and keeps focus
    const waiting = e.target.closest('[aria-disabled="true"]');
    if (e.target.closest("[data-mv-cancel]")) { if (waiting) return; stepBack(); return; }
    if (e.target.closest("[data-mv-go]")) { moveGo(); return; }
    const mvp = e.target.closest("[data-mvp]");
    if (mvp && P.mv) { if (waiting || P.mv.busy) return; P.mv.effort = mvp.dataset.mvp || null; render(); return; }
    const mvm = e.target.closest("[data-mvm]");
    if (mvm && P.mv) { if (waiting || P.mv.busy) return; pickMove(mvm.dataset.mvm); pop.querySelector(`[data-mvm="${CSS.escape(mvm.dataset.mvm)}"]`)?.focus({ preventScroll: true }); return; }
    const r = e.target.closest("[data-lroute]");
    if (r) { if (waiting) return; const s = (/** @type {string} */ (P.session)); close(); route(s, r.dataset.lroute); return; }
    if (e.target.closest("[data-lauto]")) { const s = (/** @type {string} */ (P.session)); P.draft = null; save(s, { auto: true }, P.gen); close({ apply: false }); return; }
    if (e.target.closest("[data-ldone]")) { done(); return; }
    if (e.target.closest("[data-lmore]")) { P.more = !P.more; render(); pop.querySelector("[data-lmore]")?.focus({ preventScroll: true }); return; }
    const dm = e.target.closest("[data-dmodel]");
    if (dm && (waiting || P.saving)) return;
    if (dm) { pickModel(dm.dataset.dmodel); pop.querySelector(`[data-dmodel="${CSS.escape(dm.dataset.dmodel)}"]`)?.focus({ preventScroll: true }); return; }
    const de = e.target.closest("[data-deffort]");
    if (de && (waiting || P.saving)) return;
    if (de) { pickEffort(de.dataset.deffort); pop.querySelector(`[data-deffort="${CSS.escape(de.dataset.deffort)}"]`)?.focus({ preventScroll: true }); }
  }));
  scope.listen(pop, "keydown", /** @type {EventListener} */ ((/** @type {KeyboardEvent & {target: IntelTarget}} */ e) => {
    if (e.key === "Tab") {
      const f = [...pop.querySelectorAll('button:not([disabled]),[tabindex="0"]')].filter((x) => x.offsetParent);
      const i = (/** @type {Element[]} */ (f)).indexOf(/** @type {Element} */ (document.activeElement));
      if (f.length && e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (f.length && !e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      return;
    }
    const row = e.target.closest("[data-dmodel],[data-mvm]");
    if (row && (e.key === " " || (e.key === "Enter" && row.getAttribute("aria-checked") !== "true"))) {
      e.preventDefault();
      if (row.getAttribute("aria-disabled") === "true") return; // a save or a move is out: the choice waits
      if (row.dataset.mvm != null) { pickMove(row.dataset.mvm); pop.querySelector(`[data-mvm="${CSS.escape(row.dataset.mvm)}"]`)?.focus({ preventScroll: true }); }
      else { pickModel(row.dataset.dmodel); pop.querySelector(`[data-dmodel="${CSS.escape(row.dataset.dmodel)}"]`)?.focus({ preventScroll: true }); }
      return;
    }
    const seg = e.target.closest(".iq-route:not(.iq-depth) button");
    if (seg && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const all = [...(/** @type {IntelPop} */ (seg.parentElement)).querySelectorAll("button:not([disabled])")];
      all[Math.max(0, Math.min(all.length - 1, all.indexOf(seg) + (e.key === "ArrowRight" ? 1 : -1)))]?.focus();
      return;
    }
    if (seg && (e.key === "Enter" || e.key === " ")) return; // the segment's own click
    if (P.busy || P.saving || (P.mv && P.mv.busy)) { if (e.key !== "Escape") return; }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (e.target.closest(".iq-route:not(.iq-depth), .iq-moreb")) return;   // runtime and routing keep the browser's own keys
      const vertical = e.key === "ArrowDown" || e.key === "ArrowUp";
      const group = e.target.closest(".iq-depth") || (vertical ? pop.querySelector(".iq-list") : pop.querySelector(".iq-depth"));
      if (!group) return;
      const items = [...(/** @type {IntelPop} */ (group)).querySelectorAll("[role=radio]")];
      const cur = Math.max(0, items.findIndex((x) => x.getAttribute("aria-checked") === "true"));
      const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
      const next = items[Math.max(0, Math.min(items.length - 1, cur + step))];
      if (!next) return;
      e.preventDefault();
      if (next.dataset.mvm != null) { pickMove(next.dataset.mvm); pop.querySelector(`[data-mvm="${CSS.escape(next.dataset.mvm)}"]`)?.focus({ preventScroll: true }); }
      else if (next.dataset.mvp != null) { (/** @type {IntelMove} */ (P.mv)).effort = next.dataset.mvp || null; render(); pop.querySelector(`[data-mvp="${CSS.escape(next.dataset.mvp)}"]`)?.focus({ preventScroll: true }); }
      else if (next.dataset.deffort != null) { pickEffort(next.dataset.deffort); pop.querySelector(`[data-deffort="${CSS.escape(next.dataset.deffort)}"]`)?.focus({ preventScroll: true }); }
      else if (next.dataset.dmodel != null) { pickModel(next.dataset.dmodel); pop.querySelector(`[data-dmodel="${CSS.escape(next.dataset.dmodel)}"]`)?.focus({ preventScroll: true }); }
      return;
    }
    else if (e.key === "Enter" && !P.mv && !e.target.closest("button:not([role=radio])")) { e.preventDefault(); done(); return; }
    else if (K.is(e, "auto") && !e.target.closest("input,textarea")) { e.preventDefault(); if (threadOf((/** @type {string} */ (P.session)))) { const s = (/** @type {string} */ (P.session)); save(s, { auto: true }, P.gen); close({ apply: false }); } else pickModel(""); return; }
    if (e.key !== "Escape") return;
    e.preventDefault(); e.stopPropagation();
    // Esc steps back out of continuing elsewhere first, then closes
    if (P.mv && !P.mv.busy) stepBack(); else if (!(P.mv && P.mv.busy)) close({ apply: false });
  }));
  scope.listen(document, "pointerdown", (e) => { if (P.open && !(P.mv && P.mv.busy) && !pop.contains((/** @type {Node} */ (e.target))) && !P.anchor?.contains((/** @type {Node} */ (e.target)))) close({ restore: false }); });
  scope.listen(window, "resize", () => { if (P.open) place(); });

}
