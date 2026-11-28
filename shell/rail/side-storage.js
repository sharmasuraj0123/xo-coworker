// @ts-check

import { erase, read, reportStorageFailure, write } from "../../core/platform/storage.js";

export const FOLD = "xo-side-folded", BAR = "xo-side-bar", PINS = "xo-side-pins";
export const readFold = () => read(FOLD, (value) => value === "1", false, "local", reportStorageFailure);

/** @param {boolean} on */
export const writeFold = (on) => write(FOLD, on ? "1" : "0", "local", reportStorageFailure);

/** @param {unknown} error */
function reportLegacyValue(error) {
  if (!(error instanceof SyntaxError)) reportStorageFailure(error);
}

/** @param {string} key @returns {unknown} */
export const readLegacy = (key) => read(key, JSON.parse, null, "local", reportLegacyValue);

/** @param {unknown} value @returns {string[]} */
export const placeIds = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

/** @param {unknown} value */
export function barValue(value) {
  if (!value || typeof value !== "object" || !("order" in value) || !("shown" in value)) return null;
  if (!Array.isArray(value.order) || !Array.isArray(value.shown)) return null;
  return { order: placeIds(value.order), shown: placeIds(value.shown) };
}

/** @param {string} key */
const present = (key) => read(key, () => true, false, "local", reportStorageFailure);

export const hasLegacy = () => present(BAR) || present(PINS);
export function clearLegacy() {
  if (erase(BAR).kept) erase(PINS);
}
