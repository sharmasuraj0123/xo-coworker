// @ts-check

const CLICK_GRACE_MS = 600;
/** @type {WeakMap<Document, () => Element | null>} */
const trackers = new WeakMap();

/** @param {Document} doc @param {import("../kernel/types").Lifetime} scope */
export function trackPress(doc, scope) {
  let pressed = /** @type {Element | null} */ (null);
  let cancel = () => {};
  const clear = () => { cancel(); pressed = null; };
  scope.listen(doc, "pointerdown", (event) => {
    clear();
    const target = /** @type {Element | null} */ (event.target);
    if (target?.nodeType === 1) pressed = target;
  }, true);
  scope.listen(doc, "pointerup", () => { cancel(); cancel = scope.timeout(clear, CLICK_GRACE_MS); }, true);
  scope.listen(doc, "pointercancel", clear, true);
  scope.listen(doc, "click", clear, true);
  const read = () => pressed?.isConnected ? pressed : null;
  trackers.set(doc, read);
  scope.effect(() => () => { if (trackers.get(doc) === read) trackers.delete(doc); });
}

/** @param {Document | undefined} doc */
export function pressedNode(doc = globalThis.document) {
  return doc ? trackers.get(doc)?.() ?? null : null;
}
