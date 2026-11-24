// @ts-check

/** @param {string} s @param {ParentNode} [el] @returns {any} Legacy callers assume mounted elements and use their own DOM extensions. */
export const $ = (s, el = document) => el.querySelector(s);
/** @param {string} s @param {ParentNode} [el] @returns {any[]} Legacy callers assume mounted elements and use their own DOM extensions. */
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
