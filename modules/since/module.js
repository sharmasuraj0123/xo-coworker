// @ts-check

import { chatActivityApi } from "../../core/platform/api.js";
import { sinceSection } from "./section.js";
import { createSince } from "./view.js";

/** @import { ConversationHeaderPaint } from "../../shell/app-service-types" */

/** @type {import("../../core/kernel/types").ModuleDef} */
export const sinceModule = {
  manifest: {
    id: "xo.since", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world", "announce", "currentView"], contributes: ["home.section:hm-since", "header.detail:since"],
  },
  activate(ctx) {
    const since = createSince({
      world: ctx.use("world"), api: chatActivityApi, announce: ctx.use("announce"),
      schedule: () => ctx.invalidate("workspace"),
    });
    ctx.effect(() => since.dispose);
    since.view = ctx.use("currentView");
    ctx.contribute("home.section", sinceSection(since));
    ctx.contribute("header.detail", {
      id: "since",
      /** @param {HTMLElement} host @param {ConversationHeaderPaint} context */
      render(host, { project, needs }) { since.sinceLine(project, needs, host); },
    });
    ctx.on("app:pagehide", since.markCurrent);
    ctx.on("app:view-leaving", ({ from, to }) => since.leave(from, to));
  },
};
