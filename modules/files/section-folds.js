// @ts-check

/** @import { FilesScope } from "./scope.js" */

export function createSectionFolds() {
  const SECS_KEY = "xo-files-secs";
  /** @type {Record<string, Record<string, boolean>>} */
  const secState = (() => { try { return JSON.parse(localStorage.getItem(SECS_KEY) || "{}") || {}; } catch { return {}; } })();
  const folded = (/** @type {FilesScope} */ s, /** @type {string} */ part) => !!(secState[/** @type {string} */ (s.project)] && secState[/** @type {string} */ (s.project)][part]);
  function setFolded(/** @type {FilesScope} */ s, /** @type {string} */ part, /** @type {boolean} */ on) {
    const p = secState[/** @type {string} */ (s.project)] || (secState[/** @type {string} */ (s.project)] = {});
    if (on) p[part] = true; else delete p[part];
    if (!Object.keys(p).length) delete secState[/** @type {string} */ (s.project)];
    try { localStorage.setItem(SECS_KEY, JSON.stringify(secState)); } catch { /* kept for this visit only */ }
  }
  return { folded, setFolded };
}
