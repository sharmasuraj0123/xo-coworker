// @ts-check

/** @import { FilesScope } from "./scope.js" */

/** @typedef {FilesScope & {project: string}} ProjectScope */

export function createSectionFolds() {
  const SECS_KEY = "xo-files-secs";
  /** @type {Record<string, Record<string, boolean>>} */
  const secState = (() => { try { return JSON.parse(localStorage.getItem(SECS_KEY) || "{}") || {}; } catch { return {}; } })();
  const folded = (/** @type {ProjectScope} */ s, /** @type {string} */ part) => !!(secState[s.project] && secState[s.project][part]);
  function setFolded(/** @type {ProjectScope} */ s, /** @type {string} */ part, /** @type {boolean} */ on) {
    const p = secState[s.project] || (secState[s.project] = {});
    if (on) p[part] = true; else delete p[part];
    if (!Object.keys(p).length) delete secState[s.project];
    try { localStorage.setItem(SECS_KEY, JSON.stringify(secState)); } catch { /* kept for this visit only */ }
  }
  return { folded, setFolded };
}
