// @ts-check

import { read, write } from "../platform/storage.js";

/** @param {string} value @returns {"light" | "system" | "dark"} */
const modeOf = (value) => value === "light" || value === "system" ? value : "dark";

/** @param {MediaQueryList} os */
export function createThemePreference(os) {
  let mode = read("cv-theme", modeOf, "dark");
  return {
    pref: () => mode,
    get: () => mode === "system" ? (os.matches ? "light" : "dark") : mode,
    flavour: () => read("cv-flavour", (f) => /^[a-z-]+$/.test(f) ? f : "stone", "stone"),
    /** @param {"cv-theme" | "cv-flavour"} key @param {string} value */
    save(key, value) {
      if (key === "cv-theme") mode = modeOf(value);
      return write(key, value);
    },
  };
}
