// @ts-check

// The app's one kernel, with the shell's places defined before anything contributes to them.

import { createKernel } from "../core/kernel/index.js";
import { definePlaces } from "./places.js";

export const kernel = createKernel();
definePlaces(kernel);

/** A module joins the app: its sheets are linked once, then the kernel has it. @param {import("../core/kernel/types").ModuleDef} def */
export function addModule(def, doc = document) {
  for (const p of def.manifest.styles || []) {
    if ([...doc.querySelectorAll("link[data-module-style]")].some((l) => /** @type {HTMLElement} */ (l).dataset.moduleStyle === p)) continue;
    const l = doc.createElement("link");
    l.rel = "stylesheet"; l.href = `./${p}`; l.dataset.moduleStyle = p;
    doc.head.append(l);
  }
  kernel.register(def);
}
