// @ts-check

import { api } from "../../core/platform/api.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { reportFailure } from "../../core/platform/util.js";
import { createAutomationsFrame } from "./frame.js";
import { createAutomationsPage } from "./page.js";
import { createSide } from "./side.js";
import { createAutomationsStore } from "./store.js";
import { browserZone, keepZone } from "./zone.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

/** After boot's own reads; the zone matters only when a job is next saved. */
const ZONE_AFTER_MS = 5000;

/** @type {ModuleDef} */
export const automationsModule = {
  manifest: {
    id: "xo.automations", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world", "announce", "navigation", "currentView", "stage", "placeContext"],
    contributes: ["page:automations", "panel.frame:automations", "panel.page:automation"],
  },
  activate(ctx) {
    const world = ctx.use("world"), announce = ctx.use("announce");
    const nav = ctx.use("navigation"), view = ctx.use("currentView");
    const store = createAutomationsStore({ api, report: reportFailure, timeout: ctx.timeout });
    ctx.effect(() => store.dispose);
    const syncZone = keepZone({ api, zone: browserZone, report: reportFailure });
    ctx.timeout(() => void syncZone(), ZONE_AFTER_MS);
    ctx.listen(document, "visibilitychange", () => { if (!document.hidden) void syncZone(); });
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
    const stage = ctx.use("stage"), place = ctx.use("placeContext");
    /** @type {(chat: string, ts: string) => void} */
    const toThread = (chat, ts) => void openThread(chat, ts);
    const sideDeps = { store, projectName, projects, failed, announce, openThread: toThread };
    const page = createAutomationsPage({
      store, projectName, projects, failed, announce,
      side: ({ shown }) => createSide({ ...sideDeps, where: "page", shown }),
    });
    const onPanel = () => stage.pageShown?.name === "automation";
    let leaving = false;
    const inPanel = createSide({ ...sideDeps, where: "panel", showAll: () => nav.go("automations"),
      shown(id) { if (id === null && !leaving && onPanel()) stage.back(); else stage.repaint(); } });
    ctx.effect(() => inPanel.dispose);
    ctx.contribute("panel.page", {
      id: "automation",
      title: () => inPanel.editing && !inPanel.id ? "New automation" : "Automation",
      mount: (box) => inPanel.mount(box),
      onShow(key) { if (key.startsWith("new:")) inPanel.create(key.slice(4)); else inPanel.open(key); },
      close() { leaving = true; try { inPanel.close(); } finally { leaving = false; } },
      escape: () => inPanel.escape(),
    });
    ctx.contribute("panel.frame", createAutomationsFrame({
      store, changed: () => stage.repaint(),
      chatOf: (v) => { const id = place.convProject(v); return id ? world.project(id)?.chatId ?? null : null; },
      open: (id) => stage.show("automation", id, { focus: true }),
      create: (chat) => stage.show("automation", `new:${chat}`, { focus: true }),
    }));
    ctx.effect(() => page.dispose);
    ctx.contribute("page", { id: "automations", mount: page.mount, render: page.render });
    const close = () => view() === "automations" && page.escape();
    ctx.pushLayer({ id: "automations", open: () => view() === "automations" && page.busy, back: close, escape: close });
  },
};
