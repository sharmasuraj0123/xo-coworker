// @ts-check

/** @type {WeakSet<Element>} */
const skeletons = new WeakSet();

/** @param {Element} el */
export function markSkeleton(el) { skeletons.add(el); }

/** @param {Element} el */
export function consumeSkeleton(el) { return skeletons.delete(el); }
