// @ts-check
import { read, write, reportStorageFailure } from "../../core/platform/storage.js";

/** @import { FilesScope } from "./scope.js" */

export function createSectionFolds() {
  const SECS_KEY = "xo-files-secs";
  /** @type {Record<string, Record<string, boolean>>} */
  const secState = read(SECS_KEY, (raw) => JSON.parse(raw || "{}") || {}, {}, "local", (error) => {
    if (!(error instanceof SyntaxError)) reportStorageFailure(error);
  });
  const folded = (/** @type {FilesScope} */ s, /** @type {string} */ part) => !!(secState[/** @type {string} */ (s.project)] && secState[/** @type {string} */ (s.project)][part]);
  function setFolded(/** @type {FilesScope} */ s, /** @type {string} */ part, /** @type {boolean} */ on) {
    const p = secState[/** @type {string} */ (s.project)] || (secState[/** @type {string} */ (s.project)] = {});
    if (on) p[part] = true; else delete p[part];
    if (!Object.keys(p).length) delete secState[/** @type {string} */ (s.project)];
    write(SECS_KEY, JSON.stringify(secState), "local", reportStorageFailure);
  }
  return { folded, setFolded };
}
