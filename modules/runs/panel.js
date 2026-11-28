// @ts-check
import { $ } from "../../core/platform/dom.js";
import { redraw } from "../../core/ui/redraw.js";
import { startUndoRings } from "../../core/ui/undo-ring.js";
import { usable } from "../../core/ui/a11y/focus.js";
import { runsListHtml, runViewHtml } from "./view.js";

/** @import { Run } from "./types.d.ts" */

/** @param {import("./panel-types.d.ts").RunsPanelDeps} options */
export function createRunsPanel({ RS, transcriptOpen, world, STAGE, runsCard, pendingStops, stopsOut, placeRegion, threadScroller }) {
  let previousHtml = "";
  const canStopRuns = () => !!(RS.session && world.act.feature && world.act.feature(RS.session, "runs.stop"));
  // this page's own stops still in their Undo, where you acted
  const sheetStops = () => pendingStops.pending().filter((j) => j.session === RS.session)
    .map((j) => ({ key: j.key, what: j.what, until: j.until, ms: j.ms }));
  /** Find a control by its first data attribute. @param {Element | null} e */
  const runsHook = (e) => { if (!e || !runsCard.contains(e) || e === runsCard || !e.attributes) return ""; const a = [...e.attributes].find((x) => x.name.startsWith("data-")); return a ? (a.value ? `[${a.name}="${CSS.escape(a.value)}"]` : `[${a.name}]`) : ""; };

  function runsRender() {
    if (!RS.open) return;
    const html = RS.view === "list"
      ? runsListHtml(RS.tree, RS.counts, { canStop: canStopRuns(), stops: sheetStops(), state: RS.listState, error: RS.listErr, saidFor: RS.said, session: /** @type {string} */ (RS.session), out: [...stopsOut], cmdsOpen: RS.cmdsOpen, cmdsAll: RS.cmdsAll })
      : runViewHtml(/** @type {Run} */ (RS.run || { id: RS.runId, title: "Sub-agent", state: "running" }), { anc: RS.anc, items: RS.items, children: RS.children, canStop: canStopRuns(), gone: RS.gone, error: RS.error, loading: RS.loading, stops: sheetStops(), saidFor: RS.said, out: [...stopsOut], open: transcriptOpen(), cmdsOpen: RS.runCmds, cmdsAll: RS.cmdsAll });
    if (previousHtml !== html) {
      const had = runsCard.contains(document.activeElement);
      const body = runsCard.querySelector(".rn-body");
      const keep = body ? body.scrollTop : 0;
      // the control with focus, found again by its hook if the redraw replaced it
      const hook = runsHook(document.activeElement);
      // in place: the control with focus (a Stop that gains its Undo line, a row) stays the same node
      redraw(runsCard, html);
      startUndoRings(runsCard);
      previousHtml = html;
      const nb = runsCard.querySelector(".rn-body");
      if (nb && RS.keepScroll) nb.scrollTop = keep;
      if (had && !runsCard.contains(document.activeElement)) { const same = hook && runsCard.querySelector(/** @type {string} */ (hook)); (/** @type {HTMLElement} */ (same && usable(same) ? same : runsCard)).focus({ preventScroll: true }); }
    }
  }

  /** @param {...string} first */
  function runsLand(...first) {
    const order = [...first, RS.listState === "error" ? "[data-runs-retry]" : null, ".rn-open", ".rn-cmd-b", "[data-runs-retry]"];
    return /** @type {HTMLElement} */ (order.filter(Boolean).map((sel) => runsCard.querySelector(/** @type {string} */ (sel))).find(usable) || runsCard);
  }

  function closeRuns() {
    if (!RS.open) return;
    if (!RS.panelWas && STAGE.pageShown?.name === "runs") STAGE.close({ restore: false }); else STAGE.closePage("runs");
    // a phone's panel covers the chat: what opened it takes focus once the panel is gone
    const a = document.activeElement;
    if (!a || a === document.body) RS.refocus?.();
    RS.refocus = null;
  }

  function runsGone() {
    if (!RS.open) return;
    const here = runsCard.contains(document.activeElement) || STAGE.owns(document.activeElement);
    RS.gen++; RS.open = false; runsCard.replaceChildren(); previousHtml = "";
    const was = RS.returnTo;
    /** @param {Element | null} el */
    const like = (el) => { if (!el || !el.getAttribute) return null; for (const a of ["data-run-call", "data-run"]) if (el.hasAttribute(a)) return document.querySelector(`[${a}="${CSS.escape(/** @type {string} */ (el.getAttribute(a)))}"]`); return el.hasAttribute("data-runs") ? RS.head?.querySelector("[data-runs]") : null; };
    RS.returnTo = null;
    const head = RS.head, to = () => (/** @type {HTMLElement | undefined} */ ([was, like(was), head?.querySelector("[data-runs]"), head === $("#tpthead") ? threadScroller() : placeRegion()].find(usable)))?.focus({ preventScroll: true });
    RS.refocus = here ? to : null;
    if (here) to();
  }

  return { runsRender, runsLand, closeRuns, runsGone };
}
