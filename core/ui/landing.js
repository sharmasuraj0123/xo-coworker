// @ts-check

import { arrive } from "./motion.js";
import { consumeSkeleton } from "./skeleton-mark.js";

/** @param {Element | null} el @param {(Element | null)[]} [parts] */
export function landed(el, parts = el ? [...el.children] : []) {
  if (!el || !consumeSkeleton(el)) return;
  parts.forEach((c, i) => c && arrive(c, { delay: i * 40 }));
}
