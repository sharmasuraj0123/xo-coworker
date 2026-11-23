// @ts-check
import { ICON, XO } from "../../core/ui/icons/names.js";
import { stateMark } from "../../core/ui/icons/icon.js";

/** @import { JumpItem, JumpItemsDeps, JumpThread } from "./types.d.ts" */

/** @param {JumpItemsDeps} options */
export function createJumpItems({ D, projects, threadsOf, projectIcon, glyphOf, wordOf }) {
  /** @param {JumpThread} t */
  function threadIc(t) {
    const n = D.needItems().some((x) => x.t.id === t.id && x.admitted);
    return `<span class="j-th">${stateMark(n ? "needs_reply" : glyphOf(t))}</span>`;
  }
  /** @param {string} q */
  return function jumpPlaces(q) {
    /** @type {JumpItem[]} */
    const all = [{ v: "home", name: "Home", sub: "Your next move", icon: ICON.home }, { v: "ws", name: "Workspace", sub: "The coordinator", icon: XO }, { v: "chats", name: "Chats", sub: "Ask anything, no project needed", icon: ICON.thread }, { v: "artifacts", name: "Artifacts", sub: "Everything your threads made", icon: ICON.stack }, { v: "launchpad", name: "Launchpad", sub: "Every project's app on the web", icon: ICON.deploy }];
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
