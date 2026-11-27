// @ts-check

import { api } from "../../core/platform/api.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { reportFailure } from "../../core/platform/util.js";
import { createAutomationsPage } from "./page.js";
import { createSide } from "./side.js";
import { createAutomationsStore } from "./store.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

/** @type {ModuleDef} */
export const automationsModule = {
  manifest: {
    id: "xo.automations", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world", "announce", "navigation", "currentView"],
    contributes: ["page:automations"],
  },
  activate(ctx) {
    const world = ctx.use("world"), announce = ctx.use("announce");
    const nav = ctx.use("navigation"), view = ctx.use("currentView");
    const store = createAutomationsStore({ api, report: reportFailure, timeout: ctx.timeout });
    ctx.effect(() => store.dispose);
    const projects = () => world.state.projects.filter((p) => p.chatId && p.hasChat !== false)
      .map((p) => ({ chat: p.chatId, name: p.name }));
    /** @param {string} chat */
    const projectName = (chat) => projects().find((p) => p.chat === chat)?.name ?? "A removed project";
    /** @param {unknown} error @param {string} words */
    const failed = (error, words) => { requestFailureMessage(error, words); if (words) announce(words); };
    /** @param {string} chat @param {string} ts */
    async function openThread(chat, ts) {
      const thread = world.thread(ts) ?? await world.act.fetchThread(chat, ts);
      if (thread) nav.go("t:" + ts);
      else announce("That run's thread is gone.");
    }
    const page = createAutomationsPage({
      store, projectName, projects, failed, announce,
      side: ({ shown }) => createSide({ store, where: "page", projectName, projects, shown, failed, announce,
        openThread: (chat, ts) => void openThread(chat, ts) }),
    });
    ctx.effect(() => page.dispose);
    ctx.contribute("page", { id: "automations", mount: page.mount, render: page.render });
    const close = () => view() === "automations" && page.escape();
    ctx.pushLayer({ id: "automations", open: () => view() === "automations" && page.busy, back: close, escape: close });
  },
};
