// One icon, from the owner's pack (assets/icons/xo, 19 Nov; cleaned into js/xoicons.js by tools/xoicons/build.mjs).
// No DOM here, so the pure modules (markdown, file and project icons) and their tests can draw icons too.
//
//   xi("chevron-down")                      the icon, 16 (--ic) unless its slot's CSS sizes it
//   xi("lock", "my-class")                  with a class of its own
//   xi("check", "", "sm")                   at a size from the scale: xs 12 · sm 14 · (md) 16 · lg 20 (css/base.css)
//
// The ink is currentColor, so an icon takes the colour of where it sits; the pen (1.75 on the 24 grid, round ends
// and joins) is on each path, so base.css's rule for hand-drawn line icons leaves it as drawn.
import { XI } from "./xoicons.js";

const SIZES = new Set(["xs", "sm", "md", "lg"]);

export function xi(name, cls = "", size = "") {
  const ic = XI[name];
  if (!ic) throw new Error(`no icon "${name}" in the pack`);
  if (size && !SIZES.has(size)) throw new Error(`icon size "${size}" isn't on the scale`);
  const [, , w, h] = ic[0].split(" ").map(Number);
  const c = ["xi", cls, size && size !== "md" ? `ic-${size}` : ""].filter(Boolean).join(" ");
  return `<svg class="${c}" viewBox="${ic[0]}"${w === h ? ' width="16" height="16"' : ""} aria-hidden="true" data-xi="${name}">${ic[1]}</svg>`;
}

/** Whether the pack has an icon by this name. */
export const hasIcon = (name) => Object.prototype.hasOwnProperty.call(XI, name);

const STATE = { working: "state-working", idle: "state-idle", needs_reply: "state-needs-you", needs_approval: "state-needs-you", done: "state-done", failed: "state-failed", stopped: "state-stopped", resolved: "state-resolved", held: "state-held", paused: "state-paused" };
/** A thread's or a run's state mark, from the pack's state marks; its colour is its state's (css .g-*). */
export const stateMark = (st) => xi(STATE[st] || "state-idle", `g g-${st}`);
