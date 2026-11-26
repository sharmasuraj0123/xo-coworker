// @ts-check
import { ICON } from "../../core/ui/icons/names.js";
import { stateMark, xi } from "../../core/ui/icons/icon.js";
import { contributedSearch } from "../../shell/places.js";
import { createJump } from "./jump.js";

/** @import { JumpItem } from "./types.d.ts" */

/** @import { JumpActionDeps, JumpItemsDeps, JumpThread, WorkspaceJumpDeps } from "./jump-items-types.d.ts" */

/** @param {JumpItemsDeps} options */
function createJumpItems({ D, projects, threadsOf, projectIcon, glyphOf, wordOf }) {
  /** @param {JumpThread} t */
  function threadIc(t) {
    const n = D.needItems().some((x) => x.t.id === t.id && x.admitted);
    return `<span class="j-th">${stateMark(n ? "needs_reply" : glyphOf(t))}</span>`;
  }
  /** @param {string} q */
  return function jumpPlaces(q) {
    /** @type {JumpItem[]} */
    const all = [{ v: "home", name: "Home", sub: "Your next move", icon: ICON.home }, { v: "ws", name: "Workspace", sub: "The coordinator", icon: xi("layers") }, { v: "chats", name: "Chats", sub: "Ask anything, no project needed", icon: ICON.thread }, { v: "artifacts", name: "Artifacts", sub: "Everything your threads made", icon: ICON.stack }, { v: "launchpad", name: "Launchpad", sub: "Every project's app on the web", icon: ICON.deploy }];
    const needN = new Map();
    for (const x of D.needItems()) if (x.admitted && !x.later) needN.set(x.t.project, (needN.get(x.t.project) || 0) + 1);
    const shown = q ? projects().sort((a, b) => Number(needN.has(b.id)) - Number(needN.has(a.id))) : projects();
    for (const p of shown) {
      const n = needN.get(p.id) || 0;
      all.push({ v: "p:" + p.id, name: p.name, sub: n ? `Project · ${n} need${n === 1 ? "s" : ""} you` : "Project", icon: projectIcon(p.id) });
      for (const t of threadsOf(p.id)) all.push({ v: "t:" + t.id, name: t.title, sub: `${p.name} · ${wordOf(t).toLowerCase()}`, icon: threadIc(t), t: true });
    }
    return all;
  };
}

/** @param {JumpActionDeps} actions */
function createJumpActions(actions) {
  return function jumpActions() {
    const light = document.documentElement.dataset.theme === "light";
    return [
      { name: "New project…", sub: "Action", icon: ICON.plus, run: actions.create },
      { name: "Settings", sub: "Action", icon: ICON.sliders, run: actions.settings },
      { name: "Keyboard shortcuts", sub: "Action", icon: ICON.sliders, run: actions.keys },
      { name: light ? "Dark mode" : "Light mode", sub: "Action", icon: light ? ICON.moon : ICON.sun, run: actions.theme },
      ...(actions.intelligence()
        ? [{ name: "Intelligence: model and thinking", sub: "Action", icon: ICON.sliders, run: actions.openIntelligence }] : []),
      ...(actions.stage() ? [{ name: "Threads, Changes and Map", sub: "Action", icon: ICON.sliders, run: actions.toggleStage }] : []),
    ];
  };
}

/** @param {WorkspaceJumpDeps} options @param {import("../../core/kernel/types").Lifetime} scope */
export function createWorkspaceJump({ sources, items, actions, ...options }, scope) {
  const field = options.host.querySelector("input");
  const list = options.host.querySelector("ul");
  if (!field || !list) throw new Error("Jump controls are missing");
  const jump = createJump({
    ...options, field, list, places: createJumpItems(items), actions: createJumpActions(actions),
    more: (query) => contributedSearch(sources, query),
  }, scope);
  scope.effect(() => sources.watch("search.provider", jump.refresh));
  return jump;
}
