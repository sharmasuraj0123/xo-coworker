// @ts-check
import { $, requireHtml } from "../core/platform/dom.js";
import { esc } from "../core/platform/util.js";
import { XO } from "../core/ui/icons/names.js";
import { usable } from "../core/ui/a11y/focus.js";
import { redraw } from "../core/ui/redraw.js";
import { faviconRender } from "./favicon.js";
import { createSurfaceSlots } from "./surfaces.js";

/** @import { SurfaceScope } from "./surface-types.d.ts" */

/** @template {import("./render-types.d.ts").RenderNeed} Need @template {import("./render-types.d.ts").RenderThread} Thread @template {import("./render-types.d.ts").RenderConversation} Conversation @param {import("./render-types.d.ts").RenderDeps<Need, Thread, Conversation>} options */
export function createShellRenderer({
  world, D, view, restoreFocus, PAGE_OF, MAIN, pings, dockAtTop, convThread, sideRender, homeRender, places, LPP,
  topRender, wsHeadRender, drawConv, say, msgsEl, placeRegion, loadAhead, TP, STAGE, drawThreadPage,
  dockRender, heraldRender, chatTargetRender, targetLineRender, syncPlaceholder, sendRender, chipRender,
  VW, LW, FP, titleFor, isBusy,
}, /** @type {SurfaceScope} */ scope, /** @type {() => void} */ schedule) {
  const drawPages = createSurfaceSlots({
    places, place: "page", scope, schedule, hideOnRetire: true,
    fallback: () => [requireHtml("#nv-home", "button"), requireHtml("#pb-menu", "button")].find(usable) ?? null,
  });
  return function render() {
    if (!world.state.loaded) return;
    const needs = D.needItems();
    pings(needs);
    const v = view();
    const isHome = v === "home";
    const isArts = v === "artifacts", isLp = v === "launchpad", isPage = !!PAGE_OF[v];
    // Only write changed view and conversation attributes, since other layers observe them.
    const appEl = requireHtml("#app");
    const kind = isPage ? v : v === "ws" ? "ws" : v.startsWith("t:") || v.startsWith("c:") ? "thread" : "project";
    if (appEl.dataset.view !== kind) appEl.dataset.view = kind;
    if (appEl.dataset.conv !== v) appEl.dataset.conv = v;
    dockAtTop(v === "chats");
    // A missing thread has no composer.
    const gone = v.startsWith("t:") && !convThread(v);
    if (appEl.hasAttribute("data-gone") !== gone) appEl.toggleAttribute("data-gone", gone);
    for (const [k, sel] of Object.entries(PAGE_OF)) requireHtml(sel).hidden = k !== v;
    requireHtml("#conv").hidden = isPage;
    const pbt = isHome ? "Home" : isArts ? "Artifacts" : isLp ? "Launchpad" : "";
    redraw($("#pb-t"), pbt ? esc(pbt) : XO);
    sideRender(needs);
    if (isHome) { homeRender(needs); MAIN.rendered = "home"; }
    else if (isArts) {
      const host = requireHtml(PAGE_OF[v]);
      host.hidden = !places.get("page", v);
      if (!host.hidden) drawPages((id) => id === v ? host : null, undefined);
      MAIN.rendered = v;
    }
    else if (isLp) { LPP.render(); MAIN.rendered = "launchpad"; }
    else {
      topRender(needs);
      wsHeadRender(needs);
      drawConv(MAIN, needs);
      // focus in the composer as it goes with its thread: to Go to Home, else the conversation, never the page
      if (gone && document.activeElement === say) ([.../** @type {NodeListOf<HTMLElement>} */ (msgsEl.querySelectorAll('.calm-act [data-go="home"]'))].find(usable) || placeRegion()).focus({ preventScroll: true });
    }
    if (!isPage) scope.frame(() => loadAhead(MAIN));
    if (TP.C && TP.tid && !TP.wait && STAGE.pageShown?.name === "thread") drawThreadPage(needs);
    dockRender(needs);
    heraldRender(needs);
    // The line above the composer follows the world's current state on every view.
    if (!chatTargetRender()) targetLineRender();
    syncPlaceholder();
    sendRender();
    chipRender();
    D.sync();
    VW.notice();
    STAGE.sync();
    LW.sync();
    FP.sync();
    const nd = needs.filter((n) => n.admitted && !n.later).length;
    document.title = titleFor(nd, "XO Space");
    faviconRender(world.state.threads.filter(isBusy).sort((a, b) => b.lastAt - a.lastAt)[0] || null, nd > 0);
    restoreFocus();
  };
}
