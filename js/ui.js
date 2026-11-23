export { reconcile } from "../core/ui/redraw.js";
export { morph, EASE, EXPAND_MS, expand, RM, wait, hold, keepTurning } from "../core/ui/motion.js";

export { xi, stateMark, ARC } from "../core/ui/icons/icon.js";
export { ICON, NEXT_GLYPH, DOTS, stepMark, dial, XO } from "../core/ui/icons/names.js";

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export { clock, dayOf, short, elapsed } from "../core/platform/index.js";
export const plain = (md) => String(md || "").replace(/```[\s\S]*?```/g, "[code]").replace(/[*_`#>]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();

export { sound } from "../core/services/sound.js";

export { esc } from "../core/platform/util.js";

