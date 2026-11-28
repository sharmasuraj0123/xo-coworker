// @ts-check

// Settings pages share focus and pending-control behavior.

import { esc } from "../../core/platform/util.js";
import { once, isPending } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";
import { createSettingsFocus } from "./control-focus.js";

/** @import {SettingsHost} from "./host-types" */

/** @param {string} iso */
const when = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
/** @param {string} attr @param {string} v */
const sel = (attr, v) => `[${attr}="${CSS.escape(v)}"]`;
/** @param {string | null | undefined} text */
const errHtml = (text) => (text ? `<p class="set-err" role="alert">${esc(text)}</p>` : "");
/** A question's other button while its answer is on its way: it waits with it. @param {string} key */
const waits = (key) => (isPending(key) ? ' aria-disabled="true"' : "");

/** @returns {SettingsHost} */
export function createSettingsHost() {
  const root = () => document.getElementById("settings");
  /** @param {string} id */
  function box(id) {
    const live = root()?.querySelector(`[data-page="${CSS.escape(id)}"] .set-live`);
    return live instanceof HTMLElement ? live : null;
  }
  /** @param {string} id @param {string} html */
  const paint = (id, html) => { const el = box(id); if (el) redraw(el, html); };
  const { focusTo, land, neighbour } = createSettingsFocus(root, box);
  /** @template T @param {string} key @param {string} page @param {() => void} render @param {() => Promise<T>} work @param {Element | null} [from] */
  async function pend(key, page, render, work, from) {
    const p = once(key, work);
    render();
    /** @type {T | undefined} */
    let result;
    try {
      result = await p;
      return result;
    } finally {
      render();
      if (result && typeof result === "object" && "to" in result) {
        const route = typeof result.to === "string" ? result.to : null;
        land(page, route, from);
      }
    }
  }
  return { box, paint, focusTo, land, pend, neighbour, sel, errHtml, waits, when };
}
