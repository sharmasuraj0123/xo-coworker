// @ts-check

import { api, NEWEST } from "../../core/platform/api.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { reportFailure } from "../../core/platform/util.js";
import { createAgentsFrame } from "./agent-frame.js";
import { createAgentList } from "./agent-list.js";
import { createAgentSide } from "./agent-side.js";
import { refKeyOf, scopeOf } from "./agent-file.js";
import { createAutomationsFrame } from "./frame.js";
import { projectsOf } from "./model.js";
import { createAutomationsPage } from "./page.js";
import { createPersonasStore } from "./personas.js";
import { createSide } from "./side.js";
import { createAutomationsStore } from "./store.js";
import { browserZone, keepZone } from "./zone.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

/** @import { AgentSideDeps } from "./types" */

/** After boot's own reads; the zone matters only when a job is next saved. */
const ZONE_AFTER_MS = 5000;
const REPORT_READ = 20;

/** @type {ModuleDef} */
export const automationsModule = {
  manifest: {
    id: "xo.automations", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world", "announce", "navigation", "currentView", "stage", "placeContext"],
    optional: ["files"],
    contributes: ["page:automations", "panel.frame:automations", "panel.page:automation", "panel.frame:personas", "panel.page:agent"],
  },
  activate(ctx) {
    const world = ctx.use("world"), announce = ctx.use("announce");
    const nav = ctx.use("navigation"), view = ctx.use("currentView");
    const store = createAutomationsStore({ api, report: reportFailure, timeout: ctx.timeout });
    ctx.effect(() => store.dispose);
    const syncZone = keepZone({ api, zone: browserZone, report: reportFailure });
    ctx.timeout(() => void syncZone(), ZONE_AFTER_MS);
    ctx.listen(document, "visibilitychange", () => { if (!document.hidden) void syncZone(); });
    const projects = () => projectsOf(world.state.projects);
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
    const personas = createPersonasStore({ api, report: reportFailure });
    /** @param {string} chat */
    const agentsFor = (chat) => {
      const id = projects().find((p) => p.chat === chat)?.id;
      return id ? personas.seen(id)?.agents ?? null : null;
    };
    /** @param {string} chat */
    const idOf = (chat) => projects().find((p) => p.chat === chat)?.id ?? "";
    /** @param {string} chat */
    const openProject = (chat) => { const id = idOf(chat); if (id) nav.go("p:" + id); };
    /** @type {(chat: string, ts: string, signal: AbortSignal) => Promise<string>} */
    const readReport = async (chat, ts, signal) => {
      const { messages } = await api.messages(chat, { thread: ts, before_seq: NEWEST, limit: REPORT_READ }, { signal });
      const said = messages.filter((m) => m.author_kind === "agent" && m.text?.trim()).sort((x, y) => (y.seq ?? 0) - (x.seq ?? 0));
      return said[0]?.text ?? "";
    };
    const sideDeps = { store, projectName, projects, failed, announce, openThread: toThread, agentsFor, watchAgents: personas.watch,
      openProject, readReport };
    /** @type {string[]} */
    let runtimes = [];
    api.runtimes().then((got) => { runtimes = got.runtimes.map((r) => r.name); }, reportFailure);
    /** @param {string} id */
    const nameOfId = (id) => projects().find((p) => p.id === id)?.name ?? "A removed project";
    /** @type {Omit<AgentSideDeps, "where" | "project" | "shown" | "openJob">} */
    const agentDeps = { personas, find: personas.find, projects, projectName: nameOfId, runtimes: () => runtimes,
      openThread: toThread, failed, announce,
      openFile: (owner, path, from) => ctx.optional("files")?.viewer.open({ path, name: path.split("/").pop() ?? path,
        project: owner, rel: path }, from) };
    const page = createAutomationsPage({
      store, projectName, projects, failed, announce,
      side: (hooks) => createSide({ ...sideDeps, ...hooks, where: "page" }),
      agentSide: (hooks) => createAgentSide({ ...agentDeps, ...hooks, where: "page", project: () => "" }),
      agentList: (hooks) => createAgentList({ personas, projects, projectName: nameOfId, failed, announce, ...hooks }),
    });
    const onPanel = () => stage.pageShown?.name === "automation";
    let leaving = false;
    const inPanel = createSide({ ...sideDeps, where: "panel", showAll: () => nav.go("automations"),
      openAgent: (persona, chat) => stage.show("agent", refKeyOf(persona, idOf(chat)), { focus: true }),
      made: (id) => stage.show("automation", id, { focus: true }),
      shown(id) { if (id === null && !leaving && onPanel()) stage.back(); else stage.repaint(); } });
    ctx.effect(() => inPanel.dispose);
    ctx.contribute("panel.page", {
      id: "automation",
      title: () => "Automations",
      mount: (box) => inPanel.mount(box),
      onShow: (key) => inPanel.open(key),
      close() { leaving = true; try { inPanel.close(); } finally { leaving = false; } },
      escape: () => inPanel.escape(),
    });
    ctx.contribute("panel.frame", createAutomationsFrame({
      store, changed: () => stage.repaint(),
      chatOf: (v) => { const id = place.convProject(v); return id ? world.project(id)?.chatId ?? null : null; },
      open: (id) => stage.show("automation", id, { focus: true }),
      create: (chat) => inPanel.create(chat),
    }));
    const panelProject = () => scopeOf(place.convProject(view()) ?? "");
    const onAgent = () => stage.pageShown?.name === "agent";
    let agentLeaving = false;
    const agentPanel = createAgentSide({ ...agentDeps, where: "panel", project: panelProject,
      openJob: (id) => stage.show("automation", id, { focus: true }),
      shown(key) { if (key === null && !agentLeaving && onAgent()) stage.back(); else stage.repaint(); } });
    ctx.effect(() => agentPanel.dispose);
    ctx.contribute("panel.page", {
      id: "agent",
      title: () => agentPanel.editing && !agentPanel.key ? "New agent" : "Agent",
      mount: (box) => agentPanel.mount(box),
      onShow(key) { if (key === "new") agentPanel.create(); else agentPanel.open(key); },
      close() { agentLeaving = true; try { agentPanel.close(); } finally { agentLeaving = false; } },
      escape: () => agentPanel.escape(),
    });
    ctx.contribute("panel.frame", createAgentsFrame({
      personas, changed: () => stage.repaint(), projectOf: (v) => scopeOf(place.convProject(v) ?? "") || null,
      open: (key) => stage.show("agent", key, { focus: true }),
      create: () => stage.show("agent", "new", { focus: true }),
    }));
    ctx.effect(() => page.dispose);
    ctx.contribute("page", { id: "automations", mount: page.mount, render: page.render });
    const close = () => view() === "automations" && page.escape();
    ctx.pushLayer({ id: "automations", open: () => view() === "automations" && page.busy, back: close, escape: close });
  },
};
