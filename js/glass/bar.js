// The composer as liquid glass (css/glass.css). One surface manager for the app; the composer is its one
// surface. The renderer only adds a decorative, aria-hidden child: the form, the field and the buttons stay
// as they are. Chromium refracts what scrolls behind the glass; other engines get the blur, tint and light.
import { createSurfaces } from "./surface.js";

let surfaces = null;

/** Mount the composer once; later calls return the same handle. */
export function glassComposer(form = document.getElementById("composer")) {
  if (!form || typeof CSS === "undefined" || !CSS.supports("backdrop-filter", "blur(1px)")) return null;
  // shoulder 19 and displacement 12 are the library's composer recipe; tint and blur come from css/glass.css
  // per theme, so the material follows a theme switch without a rebuild
  surfaces ||= createSurfaces({ root: form.parentElement, materials: { composer: { shoulder: 19, displacement: 12 } } });
  return surfaces.mount(form, { kind: "composer" });
}
