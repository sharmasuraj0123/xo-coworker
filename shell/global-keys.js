// @ts-check

import * as K from "../core/platform/keys.js";
import { createScope } from "../core/kernel/scope.js";

/** @param {import("./global-keys-types.d.ts").GlobalKeysOptions} deps */
export function wireGlobalKeys({ view, capturing, SH, jump, IQ, CREATE, keys, GLOBAL, FP, QO, LAYERS, back, go }) {
  const scope = createScope();
  scope.listen(window, "keydown", (event) => {
    if (capturing()) return;
    const e = /** @type {KeyboardEvent} */ (event);
    if (e.isComposing || e.keyCode === 229) return;
    if (SH.owns(e)) { if (K.hasMod("shells") && K.is(e, "shells")) { e.preventDefault(); GLOBAL.shells(); } return; }
    const g = K.globalFor(e), taken = e.defaultPrevented && K.typing(e);
    if (g && K.hasMod(g) && !taken && runGlobal(g)) { e.preventDefault(); return; }
    if (!jump.hidden || IQ.isOpen) { if (e.key === "Escape") { e.preventDefault(); LAYERS.escape(); } return; }
    if (CREATE.isOpen()) return;
    if (e.key === "Escape") {
      if (LAYERS.escape()) return;
      const current = view();
      if (current.startsWith("t:")) back();
      else if (current.startsWith("c:")) go("chats");
      return;
    }
    if (K.typing(e) || e.metaKey || e.ctrlKey || e.altKey) return; // typing, even in Pierre's editor (a shadow root)
    if (!keys.hidden) return;
    const s = K.globalFor(e, { typing: false });
    if (s && !K.hasMod(s) && runGlobal(s)) e.preventDefault();
  });
  /** @param {string} id */
  function runGlobal(id) {
    if (id === "treeFold") return FP.toggleTree();
    if (id === "quickOpen") return QO.isOpen ? (QO.close(), true) : QO.open("files");
    if (id === "findInFiles") return QO.isOpen ? (QO.close(), true) : QO.open("text");
    if (!GLOBAL[id]) return false;
    GLOBAL[id]();
    return true;
  }
  return scope.dispose;
}
