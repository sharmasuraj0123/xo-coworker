// @ts-check

export function createHomeSelection() {
  /** @type {string | null} */
  let next = null;
  let undo = false;
  let focus = false;

  return {
    current: () => next,
    /** @param {string | null} key */
    select(key) { next = key; },
    /** @param {string} key */
    restore(key) { next = key; undo = true; },
    takeUndoAnimation() {
      const animate = undo;
      undo = false;
      return animate;
    },
    requestFocus() { focus = true; },
    takeFocus() {
      const requested = focus;
      focus = false;
      return requested;
    },
  };
}
