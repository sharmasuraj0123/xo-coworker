// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { createSide } from "./side.js";
import { createSideRows } from "./rows.js";
import { esc } from "../../core/platform/util.js";
import { reconcile } from "../../core/ui/redraw.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const railModule = {
  manifest: { id: "xo.rail", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["shape", "announce", "currentView", "world", "chats", "decisionPresentation",
      "placeContext", "threadPresentation", "projectIcons"],
    optional: ["jump"], provides: ["rail"] },
  activate(ctx) {
    const jump = requireHtml("#jump");
    const side = createSide({ scope: ctx, shape: ctx.use("shape"), announce: ctx.use("announce"), render: () => ctx.emit("app:render"),
      toggleJump() { const surface = ctx.optional("jump"); if (jump.hidden) surface?.open(); else surface?.close(); } });
    const { D, askShort } = ctx.use("decisionPresentation"), place = ctx.use("placeContext");
    const rows = createSideRows(ctx, {
      view: ctx.use("currentView"), world: ctx.use("world"), CH: ctx.use("chats"), D,
      projects: place.projects, convThread: place.convThread,
      ...ctx.use("threadPresentation"), askShort, projectIcon: ctx.use("projectIcons").projectIcon, folded: () => side.folded,
    });
    const chats = ctx.use("chats"), recent = requireHtml(".side-recents");
    const list = requireHtml(".side-recents nav"), history = requireHtml("[data-chat-history]", "button");
    ctx.listen(history, "click", () => chats.showAll(true));
    ctx.listen(requireHtml("#nv-chats"), "click", () => chats.showAll(false));
    ctx.provide("rail", { side, rows(needs) {
      rows(needs);
      const data = chats.recent();
      recent.hidden = !data.count;
      history.textContent = `See all · ${data.count}`;
      reconcile(list, data.rows.map(({ id, title, state }) => ({
        key: id, html: `<button type="button" class="nrow" data-go="c:${esc(id)}"><span class="nr-name">${esc(title)}</span>`
          + (state ? `<i class="recent-dot ${state}" aria-label="${state === "needs" ? "Needs you" : "Working"}"></i>` : "") + "</button>",
      })));
    } });
  },
};
