// @ts-check

import { arrive } from "./motion.js";

/** @param {(Element & { _sk?: boolean }) | null} el @param {(Element | null)[]} [parts] */
export function landed(el, parts = el ? [...el.children] : []) {
  if (!el || !el._sk) return;
  el._sk = false;
  parts.forEach((c, i) => c && arrive(c, { delay: i * 40 }));
}
