// @ts-check

import { short } from "../../core/platform/index.js";
import { createSubtitles } from "./subtitles.js";

/** @import { MapAgent, ThreadGroup, ThreadGroupDeps, ThreadInfo, ThreadNeed, ThreadRow } from "./groups-types.d.ts" */

/** @template {ThreadNeed} N @param {ThreadGroupDeps<N>} options */
export function createThreadGroups({ world, D, MAP, convProject, PROJ = (p) => p, askShort, threadMark, isBusy, isHeld }) {
  const STATE_WORDS = { needs: "Needs you", working: "Working", waiting: "Waiting", done: "Done" };
  const { active, subtitle } = createSubtitles({ MAP, askShort, isHeld }, STATE_WORDS);
  /** @param {ThreadInfo} t @param {ThreadNeed[]} needs */
  function threadState(t, needs) {
    if (needs.some((n) => n.t.id === t.id && n.admitted && n.group !== "stopped")) return "needs";
    if (t.frozen || t.state === "done" || t.state === "resolved" || t.state === "failed" || t.state === "stopped") return "done";
    if (isBusy(t)) return "working";
    return "waiting";
  }
  /** The Workspace lists every project's live work, each row naming its project. @param {string} v */
  function panelThreads(v) {
    const pid = convProject(v);
    if (!pid) return [];
    const all = pid === "workspace";
    const needs = D.needItems();
    const doing = active(pid);
    /** @type {Record<ThreadGroup, ThreadRow[]>} */
    const groups = { needs: [], working: [], waiting: [], done: [] };
    const coordinators = all
      ? [...new Set([...needs.filter((n) => n.t.host && n.admitted).map((n) => n.t.project), ...[...doing.keys()].filter((go) => !go.startsWith("t:")).map((go) => go === "ws" ? "workspace" : go.slice(2))])].filter((p) => typeof p === "string")
      : [pid];
    for (const p of coordinators) {
      const coordAsks = needs.filter((n) => n.t.host && n.t.project === p && n.admitted);
      const coordGo = p === "workspace" ? "ws" : "p:" + p, coordAg = doing.get(coordGo);
      if (!coordAsks.length && !coordAg) continue;
      const st = coordAsks.length ? "needs" : "working";
      const title = p === "workspace" ? "Workspace coordinator" : all ? `${PROJ(p)} coordinator` : "Coordinator";
      groups[st].push({ go: coordGo, coord: true, title, state: st, word: STATE_WORDS[st],
        sub: coordAsks.length ? askShort(coordAsks[0]) : (/** @type {MapAgent} */ (coordAg)).doing, since: st === "working" ? (/** @type {MapAgent} */ (coordAg)).since : null, color: coordAg?.color, on: v === coordGo });
    }
    const ts = world.state.threads.filter((t) => all || t.project === pid).sort((a, b) => b.lastAt - a.lastAt);
    for (const t of ts) {
      const st = threadState(t, needs), ag = doing.get("t:" + t.id);
      if (all && st !== "needs" && st !== "working") continue;
      const sub = subtitle(t, st, needs, ag);
      groups[st].push({ go: "t:" + t.id, title: t.title, state: st, word: STATE_WORDS[st], mark: threadMark(t), summary: t.summary || "", branch: t.branch || "",
        sub: all ? `${PROJ(t.project)} · ${sub}` : sub,
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

  return { STATE_WORDS, threadState, panelThreads, threadCounts };
}
