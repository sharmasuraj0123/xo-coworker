// @ts-check
import { ICON } from "./icons/names.js";
import { canvasColor } from "./flavours.js";
import { redraw } from "./redraw.js";
import { createThemePreference } from "./theme-preference.js";

/** @param {ReturnType<typeof import("../kernel/scope.js").createScope>} scope @param {(theme: "light" | "dark") => void} setDiffTheme */
export function createTheme(scope, setDiffTheme) {
  const LIGHT_OS = matchMedia("(prefers-color-scheme: light)");
  const preference = createThemePreference(LIGHT_OS);
  /** @type {Set<() => void>} */
  const listeners = new Set();
  const onChange = (/** @type {() => void} */ fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

  const THEME = { ...preference, onChange, set: (/** @type {Parameters<typeof preference.save>} */ ...args) => {
    const result = preference.save(...args);
    applyTheme(preference.get());
    for (const notify of listeners) notify();
    return result;
  } };
  /** @param {"light" | "dark"} t @param {boolean} [persist] */
  function applyTheme(t, persist = false) {
    if (persist) return THEME.set("cv-theme", t);
    document.documentElement.dataset.theme = t;
    const f = THEME.flavour();
    if (f === "stone") delete document.documentElement.dataset.flavour; else document.documentElement.dataset.flavour = f;
    setDiffTheme(t);
    document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", t);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", canvasColor(t, f));
    const b = document.getElementById("theme");
    if (b) {
      b.setAttribute("aria-checked", String(t === "light")); b.title = t === "light" ? "Light mode is on. Switch to dark" : "Switch to light mode";
      const ic = `<span class="gear-ic" aria-hidden="true">${t === "light" ? ICON.moon : ICON.sun}</span>`;
      redraw(b, ic);
    }
  }
  applyTheme(THEME.get());
  scope.listen(LIGHT_OS, "change", () => { if (THEME.pref() === "system") applyTheme(THEME.get()); });
  return { THEME, applyTheme };
}

/** @param {ReturnType<typeof import("../kernel/scope.js").createScope>} scope @param {ReturnType<typeof createTheme>["applyTheme"]} applyTheme @param {(message: string) => void} announce */
export function wireThemeToggle(scope, applyTheme, announce) {
  const button = document.getElementById("theme");
  if (button) scope.listen(button, "click", () => {
    const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(t, true);
    announce(t === "light" ? "Light mode" : "Dark mode");
  });
}
