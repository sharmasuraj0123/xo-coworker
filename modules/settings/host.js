// @ts-check

// What Settings' pages share: their state, where focus lands after an action, and one request at a time per control.

import { esc } from "../../js/world.js";
import { once, isPending } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";

/** @param {string} iso */
const when = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
/** @param {string} attr @param {string} v */
const sel = (attr, v) => `[${attr}="${CSS.escape(v)}"]`;
/** @param {string | null | undefined} text */
const errHtml = (text) => (text ? `<p class="set-err" role="alert">${esc(text)}</p>` : "");
/** A question's other button while its answer is on its way: it waits with it. @param {string} key */
const waits = (key) => (isPending(key) ? ' aria-disabled="true"' : "");

export function createSettingsHost() {
  /** @type {import("./types").SettingsState} */
  const R = { router: null, models: [], rules: null, defaults: [], trees: null, reported: [], err: {}, form: null, confirm: null };

  /** @param {string} id @returns {any} */
  const box = (id) => document.querySelector(`[data-page="${id}"] .set-live`);
  /** @param {string} id @param {string} html */
  const paint = (id, html) => { const el = box(id); if (el) redraw(el, html); };
  /** The control an action leads to, else the page's own tab in the rail. @param {string} id @param {string | null | undefined} to @returns {any} */
  function target(id, to) {
    const el = to && box(id)?.querySelector(to);
    return el && !el.disabled ? el : document.querySelector(`#settings [data-set="${id}"]`);
  }
  /** @param {any} el */
  const focusOn = (el) => { if (!el) return; el.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest" }); };
  /** @param {string} id @param {string | null | undefined} to */
  const focusTo = (id, to) => focusOn(target(id, to));
  /** The same once a request settles, unless the person has moved on to something still there. @param {string} id @param {string | null | undefined} to @param {Element | null | undefined} from */
  function land(id, to, from) {
    const a = document.activeElement;
    if (a && a !== document.body && a !== from && a.isConnected) return;
    focusTo(id, to);
  }
  /** Drawn as waiting while it's out, drawn again as it settles with focus where the outcome leads. @param {string} key @param {string} page @param {() => void} render @param {() => Promise<any>} work @param {Element | null} [from] */
  async function pend(key, page, render, work, from) {
    const p = once(key, work);
    render();
    /** @type {any} */
    let r;
    try { r = await p; return r; }
    finally { render(); if (r && "to" in r) land(page, r.to, from); }
  }
  /** Where focus goes when this row leaves: the nearest row after it with that control, else before it. @param {Element | null} from @param {string} row @param {string} attr */
  function neighbour(from, row, attr) {
    const r = /** @type {any} */ (from && from.closest(row));
    if (!r) return null;
    for (const dir of ["nextElementSibling", "previousElementSibling"]) {
      for (let x = r[dir]; x; x = x[dir]) { const b = x.querySelector(`[${attr}]:not(:disabled)`); if (b) return b.getAttribute(attr); }
    }
    return null;
  }
  return { R, box, paint, focusTo, land, pend, neighbour, sel, errHtml, waits, when };
}
