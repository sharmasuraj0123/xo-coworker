// @ts-check

import { esc } from "../../platform/index.js";

/** @typedef {ReturnType<typeof import("./items.js").mediaItem>} MediaItem */

/** @type {WeakMap<Element, { raw: string, items: MediaItem[] }>} */
const stacks = new WeakMap();

/** @param {MediaItem[]} pictures */
const stackKey = (pictures) => JSON.stringify(pictures.map((it) => it.key));

/** @param {MediaItem[]} items @param {MediaItem[]} pictures */
export function stackAttrs(items, pictures) {
  return ` data-key="${esc(stackKey(pictures))}" data-mx-items="${esc(JSON.stringify(items))}"`;
}

/** @param {HTMLElement} stack @param {MediaItem[]} items */
export function setStackItems(stack, items) {
  stack.dataset.mxItems = JSON.stringify(items);
  stack.dataset.key = stackKey(items.filter((it) => it.kind === "image"));
}

/** @param {Element | null | undefined} stack @returns {MediaItem[]} */
export function stackItems(stack) {
  const raw = stack?.getAttribute("data-mx-items");
  if (!stack || !raw) return [];
  const cached = stacks.get(stack);
  if (cached?.raw === raw) return cached.items;
  const items = JSON.parse(raw);
  stacks.set(stack, { raw, items });
  return items;
}

/** @param {string} key @param {Element | null | undefined} from */
export const mediaItemOf = (key, from) => stackItems(from?.closest(".mx-stack")).find((it) => it.key === key) || null;
