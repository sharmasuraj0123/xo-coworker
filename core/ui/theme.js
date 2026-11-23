// @ts-check

import { $ } from "../platform/dom.js";
import { ICON } from "./icons/names.js";

/** @param {(theme: "light" | "dark") => void} setDiffTheme */
export function createTheme(setDiffTheme) {
  const LIGHT_OS = matchMedia("(prefers-color-scheme: light)");
  const THEME = {
    pref() { try { const t = localStorage.getItem("cv-theme"); return t === "light" || t === "system" ? t : "dark"; } catch { return "dark"; } },
    get() { const p = THEME.pref(); return p === "system" ? (LIGHT_OS.matches ? "light" : "dark") : p; },
    flavour() { try { const f = localStorage.getItem("cv-flavour"); return f && /^[a-z-]+$/.test(f) ? f : "stone"; } catch { return "stone"; } },
  };
  /** @param {"light" | "dark"} t */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    const f = THEME.flavour();
    if (f === "stone") delete document.documentElement.dataset.flavour; else document.documentElement.dataset.flavour = f;
    setDiffTheme(t);
    document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", t);
    const canvas = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim();
    if (canvas) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", canvas);
    const b = /** @type {(HTMLButtonElement & { _ic?: string }) | null} */ ($("#theme"));
    if (b) {
      b.setAttribute("aria-checked", String(t === "light")); b.title = t === "light" ? "Light mode is on. Switch to dark" : "Switch to light mode";
      const ic = `<span class="gear-ic" aria-hidden="true">${t === "light" ? ICON.moon : ICON.sun}</span>`;
      if (b._ic !== ic) { b.innerHTML = ic; b._ic = ic; }
    }
  }
  applyTheme(THEME.get());
  LIGHT_OS.addEventListener("change", () => { if (THEME.pref() === "system") applyTheme(THEME.get()); });
  return { THEME, applyTheme };
}
