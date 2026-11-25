// @ts-check

/** @typedef {HTMLElementTagNameMap} Tags */

/** @param {string} s @param {ParentNode} [el] @returns {Element | null} */
export const $ = (s, el = document) => el.querySelector(s);
/** @param {string} s @param {ParentNode} [el] @returns {Element[]} */
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/** @param {Element | null} element @returns {element is HTMLElement} */
export const isHtml = (element) => element?.namespaceURI === "http://www.w3.org/1999/xhtml";

/** @overload @param {string} selector @param {undefined} [tag] @param {ParentNode} [root] @returns {HTMLElement | null} */

/** @template {keyof Tags} K @overload @param {string} selector @param {K} tag @param {ParentNode} [root] @returns {Tags[K] | null} */

/** @param {string} selector @param {keyof Tags} [tag] @param {ParentNode} [root] */
export function findHtml(selector, tag, root = document) {
  const element = $(selector, root);
  return isHtml(element) && (!tag || element.localName === tag) ? element : null;
}

/** @overload @param {string} selector @param {undefined} [tag] @param {ParentNode} [root] @returns {HTMLElement} */

/** @template {keyof Tags} K @overload @param {string} selector @param {K} tag @param {ParentNode} [root] @returns {Tags[K]} */

/** @param {string} selector @param {keyof Tags} [tag] @param {ParentNode} [root] */
export function requireHtml(selector, tag, root = document) {
  const element = tag ? findHtml(selector, tag, root) : findHtml(selector, undefined, root);
  if (!element) throw new Error(`Expected ${tag || "an HTML element"} matching ${selector}`);
  return element;
}
