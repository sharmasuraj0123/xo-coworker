// @ts-check

// One icon from the owner's pack as an inline SVG string, inked currentColor; no DOM, so pure modules and their tests can draw icons.
import { XI } from "./xoicons.js";

const SIZES = new Set(["xs", "sm", "md", "lg"]);

/** The icon, 16 (--ic) unless its slot sizes it, with a class and a size from the scale (xs 12, sm 14, md 16, lg 20). @param {string} name */
export function xi(name, cls = "", size = "") {
  const ic = XI[name];
  if (!ic) throw new Error(`no icon "${name}" in the pack`);
  if (size && !SIZES.has(size)) throw new Error(`icon size "${size}" isn't on the scale`);
  const [, , w, h] = ic[0].split(" ").map(Number);
  const c = ["xi", cls, size && size !== "md" ? `ic-${size}` : ""].filter(Boolean).join(" ");
  return `<svg class="${c}" viewBox="${ic[0]}"${w === h ? ' width="16" height="16"' : ""} aria-hidden="true" data-xi="${name}">${ic[1]}</svg>`;
}

/** Whether the pack has an icon by this name. @param {string} name */
export const hasIcon = (name) => Object.prototype.hasOwnProperty.call(XI, name);

/** @type {Record<string, string>} */
const STATE = { working: "state-working", idle: "state-idle", needs_reply: "state-needs-you", needs_approval: "state-needs-you", done: "state-done", failed: "state-failed", stopped: "state-stopped", resolved: "state-resolved", held: "state-held", paused: "state-paused" };
/** @param {string} state */
export const stateMark = (state) => xi(STATE[state] || "state-idle", `g g-${state}`);
export const ARC = `<i class="arc" aria-hidden="true">${xi("badge-working")}</i>`;
