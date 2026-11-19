// @ts-check

// Settings › Keyboard: every shortcut and its key, changed by recording a new one; drawn in place.

import { esc } from "../../js/world.js";
import { redraw } from "../../js/redraw.js";

/** @param {import("./types").KeysPageDeps} deps */
export function createKeysPage({ K, box, state: S, announce, resetIcon }) {
  /** @param {string} sel */
  const $ = (sel) => /** @type {HTMLElement | null} */ (document.querySelector(sel));
  function render() {
    const rec = S.recording, err = S.keyErr;
    redraw(box, `<p class="kp-t">Click a key to change it. Keys that work anywhere need ⌘ or Ctrl, or a symbol like / or ?, so typing never sets them off. Your keys are kept in this browser.</p>` +
      K.GROUPS.map((g) => `<section class="kg" aria-labelledby="kg-${g.id}"><h3 id="kg-${g.id}">${esc(g.name)}</h3><div class="kl">` +
        K.ACTIONS.filter((a) => a.scope === g.id).map((a) => {
          const key = a.fixed
            ? `<span class="kr-k is-fixed" title="This one is fixed"><kbd>${esc(a.fixed)}</kbd></span>`
            : `<button type="button" class="kr-k${rec === a.id ? " is-rec" : ""}" data-rebind="${a.id}" aria-label="${esc(a.label)}: ${esc(K.label(a.id))}. ${rec === a.id ? "Press the new key, or Esc to cancel" : "Change it"}">${rec === a.id ? `<span class="kr-rec">Press a key…</span>` : `<kbd>${esc(K.label(a.id))}</kbd>`}</button>`;
          const reset = !a.fixed && K.changed(a.id) ? `<button type="button" class="kr-r" data-kreset="${a.id}" title="Back to ${esc(K.show(a.def))}" aria-label="Reset ${esc(a.label)} to ${esc(K.show(a.def))}">${resetIcon}</button>` : `<span class="kr-r" aria-hidden="true"></span>`;
          return `<div class="kr${K.changed(a.id) ? " is-changed" : ""}${a.fixed ? " is-fixed" : ""}"><span class="kr-l">${esc(a.label)}</span>${key}${reset}</div>` +
            (err && err.id === a.id ? `<p class="kr-err" role="alert">${esc(err.msg)}</p>` : "");
        }).join("") + `</div></section>`).join("") +
      `<div class="kp-f"><button type="button" class="btn" id="keys-reset-all"${K.anyChanged() ? "" : " disabled"}>${resetIcon}Reset all to defaults</button></div>`);
  }
  box.addEventListener("click", (e) => {
    const t = /** @type {Element} */ (e.target);
    const rb = /** @type {HTMLElement | null} */ (t.closest("[data-rebind]"));
    if (rb) { S.keyErr = null; S.recording = S.recording === rb.dataset.rebind ? null : /** @type {string} */ (rb.dataset.rebind); render(); return; }
    // a reset takes its own button away: the keyboard goes to the key it reset, after Reset all to the first key
    const rs = /** @type {HTMLElement | null} */ (t.closest("[data-kreset]"));
    if (rs) { const id = /** @type {string} */ (rs.dataset.kreset); S.keyErr = null; K.reset(id); $(`[data-rebind="${id}"]`)?.focus({ preventScroll: true }); return; }
    if (t.closest("#keys-reset-all")) { S.keyErr = null; S.recording = null; K.resetAll(); $("#set-keys-list [data-rebind]")?.focus({ preventScroll: true }); }
  });
  document.addEventListener("pointerdown", (e) => {
    // a click anywhere but a key chip cancels a recording
    if (S.recording && !/** @type {any} */ (e.target).closest?.("[data-rebind]")) { S.recording = null; S.keyErr = null; render(); }
  }, true);
  addEventListener("keydown", (e) => {
    if (!S.recording) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === "Escape" && !e.metaKey && !e.ctrlKey) { S.recording = null; S.keyErr = null; render(); return; }
    const combo = K.fromEvent(e);
    if (!combo) return;
    const id = S.recording;
    const r = K.set(id, combo);
    S.recording = null;
    S.keyErr = r.error ? { id, msg: r.error } : null;
    render();
    if (r.ok) announce(`${/** @type {{ label: string }} */ (K.ACTIONS.find((a) => a.id === id)).label}: ${K.label(id)}`);
  }, true);
  return { render };
}
