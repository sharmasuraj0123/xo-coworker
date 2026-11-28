// @ts-check
import { elapsed } from "../core/platform/index.js";
import { $$ } from "../core/platform/dom.js";

export function tickElapsed() { for (const el of $$(".elapsed[data-since]")) { const t = elapsed(Math.max(0, Math.floor((Date.now() - Number(el.getAttribute("data-since"))) / 1000))); if (el.textContent !== t) el.textContent = t; } }
