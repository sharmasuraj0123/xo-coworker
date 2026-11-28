// @ts-check

import { createKeysBinding } from "./keys-binding.js";
import { esc } from "../../core/platform/util.js";
import { redraw } from "../../core/ui/redraw.js";
import * as K from "../../core/platform/keys.js";
import { keyHtml } from "../../core/ui/a11y/keycap.js";

/** @param {import("./types").KeysPageDeps} deps */
export function createKeysPage({ box, announce, resetIcon }) {
  const binding = createKeysBinding(box, announce, render);
  function render() {
    const { recording: rec, error: err } = binding.read();
    redraw(box, `<p class="kp-t">Click a key to change it. Keys that work anywhere need ⌘ or Ctrl, or a symbol like / or ?, so typing never sets them off. Your keys are kept in this browser.</p>` +
      K.GROUPS.map((g) => `<section class="kg" aria-labelledby="kg-${g.id}"><h3 id="kg-${g.id}">${esc(g.name)}</h3><div class="kl">` +
        K.ACTIONS.filter((a) => a.scope === g.id).map((a) => {
          const key = a.fixed
            ? `<span class="kr-k is-fixed" title="This one is fixed"><kbd>${keyHtml(a.fixed)}</kbd></span>`
            : `<button type="button" class="kr-k${rec === a.id ? " is-rec" : ""}" data-rebind="${a.id}" aria-label="${esc(a.label)}: ${esc(K.label(a.id))}. ${rec === a.id ? "Press the new key, or Esc to cancel" : "Change it"}">${rec === a.id ? `<span class="kr-rec">Press a key…</span>` : `<kbd>${keyHtml(K.label(a.id))}</kbd>`}</button>`;
          const reset = !a.fixed && K.changed(a.id) ? `<button type="button" class="kr-r" data-kreset="${a.id}" title="Back to ${esc(K.show(a.def))}" aria-label="Reset ${esc(a.label)} to ${esc(K.show(a.def))}">${resetIcon}</button>` : `<span class="kr-r" aria-hidden="true"></span>`;
          return `<div class="kr${K.changed(a.id) ? " is-changed" : ""}${a.fixed ? " is-fixed" : ""}"><span class="kr-l">${esc(a.label)}</span>${key}${reset}</div>` +
            (err && err.id === a.id ? `<p class="kr-err" role="alert">${esc(err.msg)}</p>` : "");
        }).join("") + `</div></section>`).join("") +
      `<div class="kp-f"><button type="button" class="btn" id="keys-reset-all"${K.anyChanged() ? "" : " disabled"}>${resetIcon}Reset all to defaults</button></div>`);
  }
  const { cancel, capturing, dispose } = binding;
  return { render, cancel, capturing, dispose };
}
