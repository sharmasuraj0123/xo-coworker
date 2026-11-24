// @ts-check

import { $ } from "../core/platform/dom.js";
import { diff, jump } from "../modules/changes/diffview.js";
import { isImageChange, drawImageChange } from "../modules/changes/imagechange.js";
import { createFileViewer } from "../modules/files/viewer.js";

export { RUNS } from "../modules/files/scope.js";
export { whenWords } from "../modules/files/version-time.js";

/** @import { ViewerOptions } from "../modules/files/viewer-types.d.ts" */

/** @param {ViewerOptions} options */
export function createViewer(options) {
  return createFileViewer(options, { $, diff, jump, isImageChange, drawImageChange });
}
