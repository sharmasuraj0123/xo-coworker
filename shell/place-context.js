// @ts-check
import { nameWith } from "../core/services/comms.js";
import { findHtml } from "../core/platform/dom.js";

/** @type {Record<string, string>} */
export const PAGE_OF = { home: "#home", artifacts: "#arts", launchpad: "#lpp",
  scheduled: "#scheduled", shared: "#shared", connectors: "#connectors", explore: "#explore" };
/** @param {string} view */
export const pageEl = (view) => PAGE_OF[view] ? findHtml(PAGE_OF[view]) : null;
/** @param {string} view */
export const panelPlace = (view) => /^(?:ws$|[pt]:)/.test(view);
/** @param {string} view */
export const sessionOf = (view) => view === "home" ? "ws" : view;
/** @param {string} chat */
export const convOfChat = (chat) => chat === "workspace" ? "ws" : "p:" + chat;

/** @param {import("../core/kernel/types").Services["world"]} world */
export function createPlaceContext(world) {
  /** @param {string | null | undefined} id */
  function PROJ(id) {
    if (!id) return "";
    if (id === "workspace") return "Workspace";
    if (id === "@account") return "Your account";
    if (id === "@chats") return "Chats";
    return world.project(id)?.name || id;
  }
  const projects = () => world.state.projects.filter((p) => p.id !== "workspace");
  const threadsOf = (/** @type {string} */ pid) => world.state.threads.filter((t) => t.project === pid && t.state !== "resolved");

  const convThread = (/** @type {string} */ v) => v.startsWith("t:") ? world.thread(v.slice(2)) ?? null : null;

  const convProject = (/** @type {string} */ v) => {
    if (v === "ws" || v === "home") return "workspace";
    return v.startsWith("p:") ? v.slice(2) : convThread(v)?.project ?? null;
  };
  const doneToday = () => {
    const today = new Date().toDateString();
    return world.state.threads.filter((t) => t.state === "done" && new Date(t.lastAt).toDateString() === today);
  };
  const atOf = (/** @type {string} */ v) => {
    const t = convThread(v);
    return { view: v, project: t?.project ?? (v.startsWith("p:") ? v.slice(2) : undefined), thread: t?.id };
  };
  /** @param {string} view */
  function panelName(view) {
    const project = atOf(view).project;
    if (project && project !== "workspace") return PROJ(project);
    return project === "workspace" || view === "ws" ? "Workspace" : "Your projects";
  }
  /** @param {() => string} activeView */
  function mountNames(activeView) {
    return nameWith({
      thread: (id) => world.thread(id)?.title || null,
      project: (chat) => world.state.projects.find((p) => p.chatId === chat)?.name || null,
      here() { const project = atOf(activeView()).project; return project ? PROJ(project) : null; },
    });
  }
  return { PROJ, projects, threadsOf, convThread, convProject, doneToday, atOf, panelName, mountNames };
}
