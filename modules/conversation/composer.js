// @ts-check

import { requireHtml } from "../../core/platform/dom.js";

/** @import { Composer, ComposerDeps, ComposerScope } from "./composer-types.d.ts" */

/** @param {ComposerDeps} options */
export function createComposer({
  MK, say, trayRender, chipRender, lrefRender, chatTargetRender, syncPlaceholder, sendRender,
  targetLineRender, connDest, schedule, mentions, saveDraft, send, stopRun,
}) {
  /** @param {Composer} K @param {ComposerScope} scope */
  function wireComposer(K, scope) {
    scope.listen(K.say, "input", () => { mentions.reset(K); updateComposer(K); saveDraft(K); });
    scope.listen(K.say, "click", () => updateComposer(K));
    scope.listen(K.say, "keydown", (event) => {
      const e = /** @type {KeyboardEvent} */ (event);
      if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; }
      if (mentions.keys(e, K)) return;
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(K); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); K.say.blur(); }
    });
    scope.listen(K.form, "submit", (e) => { e.preventDefault(); if (K.send.dataset.mode === "stop") stopRun(K.view); else send(K); });
    mentions.wire(K, scope);
    if (!K.main) scope.listen(K.target, "click", () => mentions.aim(K));
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
      if (document.activeElement === K.say) mentions.render(K); else mentions.close(K);
      return;
    }
    trayRender();
    lrefRender();
    if (chatTargetRender()) {
      syncPlaceholder();
      requireHtml("#composer", "form").classList.toggle("has-text", !!say.value);
      sendRender(); growSay(); mentions.close();
      return;
    }
    targetLineRender();
    { const dk = JSON.stringify(connDest()); if (dk !== (/** @type {{dk?: string}} */ (updateComposer)).dk) { (/** @type {{dk?: string}} */ (updateComposer)).dk = dk; schedule(); } }
    syncPlaceholder();
    requireHtml("#composer", "form").classList.toggle("has-text", !!say.value);
    sendRender();
    growSay();
    mentions.render(MK);
  }

  return { wireComposer, growSay, updateComposer };
}
