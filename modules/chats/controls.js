// @ts-check

import { radioKeys } from "../../core/ui/a11y/keynav.js";

/** @import { ChatControls } from "./controls-types.d.ts" */

/** @param {ChatControls} controls */
export function bindChatControls({ scope, setup, chats, updateComposer, openWorkspace }) {
  scope.effect(() => radioKeys(setup));
  scope.listen(setup, "click", ({ target }) => {
    if (!(target instanceof Element)) return;
    if (target.closest("[data-cs-ws]")) { chats.closeSetup(); openWorkspace(); return; }
    const mode = target.closest("[data-csmode]")?.getAttribute("data-csmode");
    if (mode != null) {
      chats.setPref("mode", mode);
      chats.closeSetup();
    } else {
      const agent = target.closest("[data-cs-agent]");
      const name = agent?.getAttribute("data-cs-agent");
      if (name != null) {
        if (agent?.getAttribute("aria-checked") === "true") return;
        chats.setPref("agent", name);
        chats.renderSetup();
      } else if (!changeSetup(target)) return;
    }
    updateComposer();
  });

  /** @param {Element} target */
  function changeSetup(target) {
    if (target.closest("[data-cs-chat]")) {
      chats.closeSetup();
      return true;
    }
    for (const key of /** @type {const} */ (["model", "effort"])) {
      const attribute = "data-cs-" + key;
      const value = target.closest(`[${attribute}]`)?.getAttribute(attribute);
      if (value == null) continue;
      chats.setPref(key, value);
      chats.renderSetup();
      return true;
    }
    if (!target.closest("[data-cs-done]")) return false;
    chats.closeSetup();
    return true;
  }

  scope.listen(setup, "keydown", (event) => {
    if (!("key" in event) || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    chats.closeSetup();
  });
  scope.listen(setup.ownerDocument, "pointerdown", ({ target }) => {
    if (chats.setupOpen && target instanceof Element && !setup.contains(target) && !target.closest("#target, #iq, #cs-perm")) {
      chats.closeSetup();
    }
  });
}
