// The composer as liquid glass (css/glass.css). One surface manager for the app; the composer is its one
// surface. The renderer only adds a decorative, aria-hidden child: the form, the field and the buttons stay
// as they are. Chromium refracts what scrolls behind it; other engines get the blur, tint and light.
// Settings › General › Chat bar chooses the look per device (localStorage cv-bar, read before the first paint
// into <html data-bar>): "glass" mounts the surface, "stone" (Stone glass, the look before) unmounts it, which gives back the composer exactly
// as it was (the library restores every attribute and style it set).
import { createSurfaces } from "./surface.js";

const KEY = "cv-bar";
let surfaces = null, handle = null, form = null;
const able = () => typeof CSS !== "undefined" && CSS.supports("backdrop-filter", "blur(1px)");

/** The look in effect: "glass" or "stone". */
export function barLook() { return document.documentElement.dataset.bar === "stone" ? "stone" : "glass"; }

function apply() {
  if (!form) return;
  if (barLook() === "glass" && able()) {
    // shoulder 19 and displacement 12 are the library's composer recipe; tint and blur come from css/glass.css
    // per theme, so the material follows a theme switch without a rebuild
    surfaces ||= createSurfaces({ root: form.parentElement, materials: { composer: { shoulder: 19, displacement: 12 } } });
    handle = surfaces.mount(form, { kind: "composer" });
  } else if (handle) { handle.destroy(); handle = null; }
}

/** Mount the composer once, in the look this device chose; later calls return the same handle. */
export function glassComposer(el = document.getElementById("composer")) {
  form = el;
  apply();
  return handle;
}

/** Choose the look: shown at once; { kept } says whether this browser will remember it. */
export function setBarLook(look) {
  const next = look === "stone" ? "stone" : "glass";
  document.documentElement.dataset.bar = next;
  let kept = true;
  try { localStorage.setItem(KEY, next); } catch { kept = false; }
  apply();
  return { look: next, kept };
}
