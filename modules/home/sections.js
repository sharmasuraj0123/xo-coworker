// @ts-check

import { createSurfaceSlots } from "../../shell/surfaces.js";

/** @import { Places } from "../../core/kernel/types" */

/** @import { SurfaceScope } from "../../shell/surface-types.d.ts" */

/** @template N @typedef {{ needs: N[], patch: (el: HTMLElement, html: string) => boolean }} SectionContext */

/** @template N @param {Pick<Places, "entries" | "watch" | "has">} places @param {SurfaceScope} scope @param {() => void} schedule */
export function createHomeSections(places, scope, schedule) {
  /** @type {ReturnType<typeof createSurfaceSlots<SectionContext<N>>>} */
  const draw = createSurfaceSlots({
    places, place: "home.section", read: () => places.entries("home.section"), scope, schedule,
    fallback: () => document.getElementById("home"),
  });
  /** @param {HTMLElement | null} body @param {SectionContext<N>} context */
  return (body, context) => {
    if (body) draw((id) => body.querySelector(`:scope > #${CSS.escape(id)}`), context);
  };
}
