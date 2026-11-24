// @ts-check

import { $ } from "../../core/platform/dom.js";

/** @import { Composer, ComposerDeps } from "./composer-types.d.ts" */

/** @param {ComposerDeps} options */
export function createComposer({
  MK, say, trayRender, chipRender, lrefRender, chatTargetRender, syncPlaceholder, sendRender,
  targetLineRender, connDest, schedule, atRender, atClose, saveDraft, atKeys, send, stopRun, wireAt, aimAt,
}) {
  /** @param {Composer} K */
  function wireComposer(K) {
    K.say.addEventListener("input", () => { K.at._sel = 0; updateComposer(K); saveDraft(K); });
    K.say.addEventListener("click", () => updateComposer(K));
    K.say.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; }
      if (atKeys(e, K)) return;
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(K); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); K.say.blur(); }
    });
    K.form.addEventListener("submit", (e) => { e.preventDefault(); if (K.send.dataset.mode === "stop") stopRun(K.view); else send(K); });
    wireAt(K);
    K.target.addEventListener("click", () => aimAt(K));
  }

  /** @param {Composer} [K] */
  function growSay(K = MK) {
    K.say.style.height = "auto";
    const h = K.say.scrollHeight;
    K.say.style.height = Math.min(h, 200) + "px";
    K.say.classList.toggle("is-capped", h > 200);
  }

  /** @param {Composer} [K] */
  function updateComposer(K = MK) {
    if (!K.main) {
      trayRender(K); chipRender(false, K);
      targetLineRender(K); syncPlaceholder(K);
      K.form.classList.toggle("has-text", !!K.say.value);
      sendRender(K); growSay(K);
      if (document.activeElement === K.say) atRender(K); else atClose(K);
      return;
    }
    trayRender();
    lrefRender();
    if (chatTargetRender()) {
      syncPlaceholder();
      $("#composer").classList.toggle("has-text", !!say.value);
      sendRender(); growSay(); atClose();
      return;
    }
    targetLineRender();
    { const dk = JSON.stringify(connDest()); if (dk !== (/** @type {{dk?: string}} */ (updateComposer)).dk) { (/** @type {{dk?: string}} */ (updateComposer)).dk = dk; schedule(); } }
    syncPlaceholder();
    $("#composer").classList.toggle("has-text", !!say.value);
    sendRender();
    growSay();
    atRender(MK);
  }

  return { wireComposer, growSay, updateComposer };
}
