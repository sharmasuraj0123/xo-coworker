// @ts-check

// The app's layers on the kernel's one stack: Back asks the top-most open one first, and the page asks whether any is open.

/** @typedef {{ id: string, open: () => boolean, back: () => boolean | void, overlay?: boolean }} AppLayer */

/** Push the layers, top-most first in the list; back() returning false lets the next one answer. @param {import("../core/kernel/types").Layers} layers @param {AppLayer[]} list */
export function stackLayers(layers, list) {
  const undos = [...list].reverse().map((l) => layers.push({ id: l.id, back: () => l.open() && l.back() !== false }));
  return {
    /** Is any layer open; with overlay, only those that hold the page's gestures. */
    open: ({ overlay = false } = {}) => list.some((l) => (!overlay || l.overlay !== false) && l.open()),
    undo: () => { for (const u of undos.reverse()) u(); },
  };
}
