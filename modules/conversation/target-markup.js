// @ts-check

/** @type {WeakMap<HTMLElement, string>} */
const markup = new WeakMap();

/** @param {HTMLElement} element @param {string} html */
const replaceMarkup = (element, html) => { element.innerHTML = html; };

/** @param {HTMLElement} target @param {string} html @param {(element: HTMLElement, markup: string) => unknown} paint */
export function paintComposerTarget(target, html, paint = replaceMarkup) {
  if (markup.get(target) === html) return;
  paint(target, html);
  markup.set(target, html);
}
