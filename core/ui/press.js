// @ts-check

import { createScope } from "../kernel/scope.js";

const CLICK_GRACE_MS = 600;
/** @type {WeakMap<Document, () => Element | null>} */
const trackers = new WeakMap();

/** @param {Document} doc */
function track(doc) {
  const scope = createScope();
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
  return read;
}

if (typeof document !== "undefined") track(document);

/** @param {Document | undefined} doc */
export function pressedNode(doc = globalThis.document) {
  return doc ? (trackers.get(doc) || track(doc))() : null;
}
