// @ts-check
import { $, requireHtml } from "../core/platform/dom.js";
import { esc } from "../core/platform/util.js";
import { XO } from "../core/ui/icons/names.js";
import { usable } from "../core/ui/a11y/focus.js";
import { redraw } from "../core/ui/redraw.js";
import { PAGE_OF } from "./place-context.js";
import { faviconRender } from "./favicon.js";
import { createSurfaceSlots } from "./surfaces.js";

/** @type {import("../core/kernel/types").ModuleDef} */
export const workspaceRendererModule = {
  manifest: { id: "xo.workspace", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "currentView", "placeContext", "decisionPresentation", "threadPresentation", "rail", "conversationSession",
      "conversationContent", "redrawFocus"] },
  activate(ctx) {
    const places = ctx.places;
    const world = ctx.use("world"), view = ctx.use("currentView"), place = ctx.use("placeContext");
    const decisions = ctx.use("decisionPresentation"), { isBusy } = ctx.use("threadPresentation"), rail = ctx.use("rail");
    const session = ctx.use("conversationSession"), content = ctx.use("conversationContent"), focus = ctx.use("redrawFocus");
    const drawPages = createSurfaceSlots({
      places, place: "page", read: () => places.entries("page"), scope: ctx, schedule: () => ctx.invalidate("workspace"), hideOnRetire: true,
      fallback: () => [requireHtml("#nv-home", "button"), requireHtml("#pb-menu", "button")].find(usable) ?? null,
    });
    ctx.on("app:render", () => {
      if (!world.state.loaded) return;
      const needs = decisions.D.needItems();
      decisions.pings(needs);
      const v = view(), page = PAGE_OF[v], app = requireHtml("#app");
      const kind = page ? v : v === "ws" ? "ws" : v.startsWith("t:") || v.startsWith("c:") ? "thread" : "project";
      if (app.dataset.view !== kind) app.dataset.view = kind;
      if (app.dataset.conv !== v) app.dataset.conv = v;
      ctx.emit("workspace:layout", v);
      const gone = v.startsWith("t:") && !place.convThread(v);
      if (app.hasAttribute("data-gone") !== gone) app.toggleAttribute("data-gone", gone);
      for (const [id, selector] of Object.entries(PAGE_OF)) requireHtml(selector).hidden = id !== v;
      requireHtml("#conv").hidden = !!page;
      const title = v === "home" ? "Home" : v === "artifacts" ? "Artifacts" : v === "launchpad" ? "Launchpad" : "";
      redraw($("#pb-t"), title ? esc(title) : XO);
      rail.rows(needs);
      if (page) {
        const host = requireHtml(page);
        host.hidden = !places.get("page", v);
        if (!host.hidden) drawPages(() => host, needs, v);
        session.main.rendered = v;
      } else content.draw(needs, gone);
      for (const entry of places.entries("workspace.paint")) entry.paint(needs);
      const count = needs.filter((n) => n.admitted && !n.later).length;
      document.title = decisions.Kit.titleFor(count, "XO Space");
      faviconRender(world.state.threads.filter(isBusy).sort((a, b) => b.lastAt - a.lastAt)[0] || null, count > 0);
      focus.restore();
      ctx.emit("workspace:painted");
    });
  },
};
