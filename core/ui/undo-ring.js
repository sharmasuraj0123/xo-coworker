// @ts-check
import { xi } from "./icons/icon.js";

const REDUCED = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

/** An Undo's countdown, empty at `until`; fixed times only, so a redraw keeps it. @param {number} until @param {number} [ms] */
export function undoRingHtml(until, ms = 0) {
  const at = `data-ring-until="${Math.round(until)}" data-ring-ms="${Math.round(ms)}"`;
  return xi("undo-countdown", "undo-ring").replace("<svg ", `<svg ${at} `).replace("<path ", `<path pathLength="1" `);
}

/** Runs each ring under root that isn't running yet, from where its fixed times put it now. @param {ParentNode | null | undefined} root */
export function startUndoRings(root, now = Date.now()) {
  if (!root || REDUCED?.matches) return;
  for (const svg of root.querySelectorAll("svg[data-ring-until]")) {
    const path = svg.querySelector("path");
    if (!path || typeof path.animate !== "function" || path.getAnimations().length) continue;
    const until = Number(svg.getAttribute("data-ring-until")), left = Math.max(0, until - now);
    const total = Math.max(left, Number(svg.getAttribute("data-ring-ms")) || left);
    if (!total) continue;
    const frames = [{ strokeDashoffset: 0 }, { strokeDashoffset: 1 }];
    path.animate(frames, { duration: total, delay: left - total, easing: "linear", fill: "forwards" });
  }
}
