// @ts-check

import { plural } from "../../core/platform/words.js";
import { bindHomeDecisionControls } from "./decision-controls.js";
import { createHandled } from "./handled.js";
import { createNextCard } from "./next-card.js";
import { createOpenNext } from "./open-next.js";
import { createHomeParts } from "./parts.js";
import { createHomeSelection } from "./selection.js";
import { greeting, today } from "./skeleton.js";
import { createHomeView } from "./view.js";

/** @import { HomeControllerOptions } from "./controller-types.d.ts" */

/** @import { HomeViewNeed } from "./view-types.d.ts" */

const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const num = (/** @type {number} */ n) => NUM[n] || String(n);

/** @template {HomeViewNeed} N @param {HomeControllerOptions<N>} options */
export function createHomeController(options) {
  const { host, scope, D, Kit, decideKey, announce, schedule } = options;
  const selection = createHomeSelection();
  const homeParts = createHomeParts(selection, D.needItems, Kit.isBinary);
  const { endRender, toggleHandled } = createHandled({ ...options, homeParts, num });
  const nextCardHtml = createNextCard(options);
  const { homeRender, nextDecide } = createHomeView({
    ...options, selection, homeParts, endRender, nextCardHtml, greeting, today, num, plural,
  }, scope);
  const openNext = createOpenNext({ homeParts, heraldShow: options.heraldShow, decideKey });
  bindHomeDecisionControls(host, { next: () => homeParts().next, isBinary: Kit.isBinary, decide: nextDecide, details: decideKey }, scope);

  scope.listen(host, "click", ({ target }) => {
    if (!(target instanceof Element)) return;
    if (target.closest("[data-open-all]")) { D.open(homeParts().next?.key); return; }
    if (target.closest("[data-glances]")) { D.open(null, { only: "glance" }); return; }
    const later = target.closest("[data-later]")?.getAttribute("data-later");
    if (later) {
      selection.requestFocus();
      D.laterNow(later);
      selection.select(null);
      return;
    }
    if (target.closest("[data-bring]")) {
      selection.requestFocus();
      D.recallAll();
      announce("Brought back. They're in today's list again.");
      schedule();
      return;
    }
    if (target.closest("[data-handled]")) { toggleHandled(); return; }
    const bring = target.closest("[data-bring-in]")?.getAttribute("data-bring-in");
    if (bring) {
      selection.requestFocus();
      D.bringIn(bring);
    }
  });

  return { homeParts, homeRender, openNext, restore: selection.restore };
}
