// @ts-check

// The app's layers on the kernel's one stack, in one order the shell keeps: Back and Esc ask the top-most open one first.

/** A layer: close() returning false passes the key on; back: false leaves it to Back's next layer; escape: true lets Esc close it too. @typedef {{ id: string, open: () => boolean, close: () => boolean | void, back?: boolean, escape?: boolean, overlay?: boolean }} AppLayer */

/** Top-most first: the dialogs and sheets, then what covers the main area, the panel, the dock's sheets, the drawer and the popovers under them. */
export const ORDER = ["create", "jump", "intel", "quickopen", "runs", "keys", "all", "lightbox", "settings", "files-page", "panel-sheet", "shells", "drawer", "decisions", "chat-setup"];

/** Push the layers in the shell's order. @param {import("../core/kernel/types").Layers} layers @param {AppLayer[]} list */
export function stackLayers(layers, list) {
  for (const l of list) if (!ORDER.includes(l.id)) throw new Error(`layer "${l.id}" has no place in the shell's order`);
  const sorted = [...list].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const shut = (/** @type {AppLayer} */ l) => () => l.open() && l.close() !== false;
  const undos = [...sorted].reverse().map((l) => layers.push({ id: l.id, ...(l.back !== false ? { back: shut(l) } : {}), ...(l.escape ? { escape: shut(l) } : {}) }));
  return {
    /** Is any layer open; with overlay, only those that hold the page's gestures. */
    open: ({ overlay = false } = {}) => list.some((l) => (!overlay || l.overlay !== false) && l.open()),
    undo: () => { for (const u of undos.reverse()) u(); },
  };
}
