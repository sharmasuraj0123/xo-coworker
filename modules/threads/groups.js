// @ts-check

import { short } from "../../core/platform/index.js";
import { createSubtitles } from "./subtitles.js";

/** @import { MapAgent, ThreadGroup, ThreadGroupDeps, ThreadInfo, ThreadNeed, ThreadRow } from "./groups-types.d.ts" */

/** @param {ThreadGroupDeps} options */
export function createThreadGroups({ world, D, MAP, convProject, askShort, threadMark, isBusy, isHeld }) {
  const STATE_WORDS = { needs: "Needs you", working: "Working", waiting: "Waiting", done: "Done" };
  const { active, subtitle, forProject } = createSubtitles({ MAP, askShort, isHeld }, STATE_WORDS);
  /** @param {ThreadInfo} t @param {ThreadNeed[]} needs */
  function threadState(t, needs) {
    if (needs.some((n) => n.t.id === t.id && n.admitted && n.group !== "stopped")) return "needs";
    if (t.frozen || t.state === "done" || t.state === "resolved" || t.state === "failed" || t.state === "stopped") return "done";
    if (isBusy(t)) return "working";
    return "waiting";
  }
  /** @param {string} v */
  function panelThreads(v) {
    const pid = convProject(v);
    if (!pid) return [];
    const needs = D.needItems();
    const doing = active(pid);
    /** @type {Record<ThreadGroup, ThreadRow[]>} */
    const groups = { needs: [], working: [], waiting: [], done: [] };
    const coordAsks = needs.filter((n) => n.t.host && n.t.project === pid && n.admitted);
    const coordGo = pid === "workspace" ? "ws" : "p:" + pid, coordAg = doing.get(coordGo);
    if (coordAsks.length || coordAg) {
      const st = coordAsks.length ? "needs" : "working";
      groups[st].push({ go: coordGo, coord: true, title: pid === "workspace" ? "Workspace coordinator" : "Coordinator", state: st, word: STATE_WORDS[st],
        sub: coordAsks.length ? askShort(coordAsks[0]) : (/** @type {MapAgent} */ (coordAg)).doing, since: st === "working" ? (/** @type {MapAgent} */ (coordAg)).since : null, color: coordAg?.color, on: v === coordGo });
    }
    const ts = world.state.threads.filter((t) => t.project === pid).sort((a, b) => b.lastAt - a.lastAt);
    for (const t of ts) {
      const st = threadState(t, needs), ag = doing.get("t:" + t.id);
      groups[st].push({ go: "t:" + t.id, title: t.title, state: st, word: STATE_WORDS[st], mark: threadMark(t), summary: t.summary || "", branch: t.branch || "",
        sub: subtitle(t, st, needs, ag),
        since: st === "working" && ag ? ag.since : null, at: st === "working" ? "" : short(t.lastAt), color: ag?.color, on: v === "t:" + t.id });
    }
    return (/** @type {ThreadGroup[]} */ (["needs", "working", "waiting", "done"])).filter((k) => groups[k].length).map((k) => ({ k, word: STATE_WORDS[k], rows: groups[k] }));
  }

  /** @param {string} pid @param {ThreadNeed[]} needs */
  function threadCounts(pid, needs) {
    const c = { all: 0, needs: 0, working: 0, waiting: 0, done: 0 };
    for (const t of world.state.threads) if (t.project === pid) { c.all++; c[threadState(t, needs)]++; }
    return c;
  }

  return { STATE_WORDS, threadState, panelThreads, threadCounts,
    threadSubtitles: (/** @type {string} */ pid, /** @type {ThreadNeed[]} */ needs) => forProject(pid, needs, (t) => threadState(t, needs)) };
}
