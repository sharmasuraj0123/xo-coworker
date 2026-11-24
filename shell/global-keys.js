// @ts-check

import * as K from "../core/platform/keys.js";

/** @param {{ S: {recording: unknown, view: string}, SH: {owns: (event: KeyboardEvent) => boolean}, jump: HTMLElement, IQ: {isOpen: boolean}, CREATE: {isOpen: () => boolean}, keys: HTMLElement, allEl: HTMLElement, GLOBAL: Record<string, () => unknown> & {shells: () => unknown}, FP: {toggleTree: () => boolean}, QO: {isOpen: boolean, close: () => void, open: (mode: "files" | "text") => boolean}, LAYERS: Pick<ReturnType<typeof import("./layers.js").stackLayers>, "escape">, back: () => unknown, go: (view: string) => unknown }} deps */
export function wireGlobalKeys({ S, SH, jump, IQ, CREATE, keys, allEl, GLOBAL, FP, QO, LAYERS, back, go }) {
  addEventListener("keydown", (e) => {
    if (S.recording) return; // Settings › Keyboard is listening for a new key
    if (e.isComposing || e.keyCode === 229) return;
    if (SH.owns(e)) { if (K.hasMod("shells") && K.is(e, "shells")) { e.preventDefault(); GLOBAL.shells(); } return; }
    const g = K.globalFor(e), taken = e.defaultPrevented && K.typing(e);
    if (g && K.hasMod(g) && !taken && runGlobal(g)) { e.preventDefault(); return; }
    if (!jump.hidden || IQ.isOpen) { if (e.key === "Escape") { e.preventDefault(); LAYERS.escape(); } return; }
    if (CREATE.isOpen()) return;
    if (e.key === "Escape") {
      if (LAYERS.escape()) return;
      if (S.view.startsWith("t:")) back();
      else if (S.view.startsWith("c:")) go("chats");
      return;
    }
    if (K.typing(e) || e.metaKey || e.ctrlKey || e.altKey) return; // typing, even in Pierre's editor (a shadow root)
    if (!keys.hidden || !allEl.hidden) return;
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
}
