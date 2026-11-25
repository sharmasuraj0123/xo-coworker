// @ts-check

import { esc } from "../../core/platform/util.js";
import { activityOf } from "../../core/services/agent-activity.js";
import { commsLine, commsText } from "../../core/services/comms.js";
import { folderOf } from "../../core/services/places.js";
import { heldWords } from "../../core/services/world/held.js";
import { colorOf } from "./layout.js";

/** @import { Folder, Turn, Turns } from "../../core/services/types.d.ts" */

/** @import { MapAgent, MapAgentDeps, MapStep, MapThread } from "./agents-types.d.ts" */

const COORD_COLOR = "#7ED957";

/** @param {MapAgentDeps} options */
export function createMapAgents({ world, isBusy, stepLineHtml }) {
  const turns = () => world.state.turns || null;

  /** @param {MapThread} t @returns {MapAgent} */
  function agentOf(t) {
    const fold = folderOf(t);
    const a = activityOf(turns(), t.sessionId, fold && fold.root);
    const now = a.now && a.now.row;
    const liveFile = [...a.files.values()].filter((f) => f.live).sort((x, y) => y.seq - x.seq)[0] || null;
    const lastFile = [...a.files.values()].sort((x, y) => y.seq - x.seq)[0] || null;
    const busy = isBusy(t);
    const held = !busy && t.held && t.state === "working" ? t.held : null;
    return { held, id: t.id, title: t.title, go: "t:" + t.id, project: t.project, fold, act: a, now, liveFile, path: (liveFile || (!busy && lastFile) || null)?.path || null, spots: a.nowSpots, prev: a.lastFile, busy, waiting: !!(now && now.waiting), since: a.running ? Date.parse((/** @type {Turn & { at: string }} */ (a.running)).at) : null, color: colorOf(t.id) };
  }
  /** @param {string} pid @returns {MapAgent | null} */
  function coordinatorOf(pid) {
    const sid = world.act.coordinatorBusy && world.act.coordinatorBusy(pid);
    if (!sid) return null;
    const anyT = world.state.threads.find((x) => x.project === pid && folderOf(x));
    const root = anyT ? (/** @type {Folder} */ (folderOf(anyT))).projectRoot : null;
    const a = activityOf(turns(), sid, root);
    const now = a.now && a.now.row;
    const liveFile = [...a.files.values()].filter((f) => f.live).sort((x, y) => y.seq - x.seq)[0] || null;
    return { id: "coord:" + pid, title: "Coordinator", go: pid === "workspace" ? "ws" : "p:" + pid, project: pid, fold: root ? { root, base: "", project: pid } : null, act: a, now, liveFile, path: liveFile ? liveFile.path : null, spots: a.nowSpots, prev: a.lastFile, busy: true, waiting: !!(now && now.waiting), since: a.running ? Date.parse((/** @type {Turn & { at: string }} */ (a.running)).at) : null, coord: true, color: COORD_COLOR };
  }
  /** @param {string | null} pid */
  function agentsIn(pid) {
    const out = world.state.threads.filter((t) => (!pid || t.project === pid) && isBusy(t)).map(agentOf);
    const pids = pid ? [pid] : [...new Set(world.state.projects.map((p) => p.id))];
    for (const p of pids) { const c = coordinatorOf(p); if (c) out.unshift(c); }
    return out;
  }

  /** @param {MapAgent} ag */
  function doingLine(ag) {
    if (ag.now) { const said = commsLine(ag.now, { project: ag.project }); return said ? esc(said) : stepLineHtml(commsText(ag.now.line) || ag.now.tool || "Working", ag.now.kind); }
    if (ag.act.running) {
      const bl = (/** @type {Turns} */ (turns())).blocksOf(ag.act.running);
      const last = bl[bl.length - 1];
      return esc(last ? (last.type === "thinking" ? "Thinking" : last.type === "text" || last.type === "answer" ? "Writing its reply" : String(commsText((/** @type {{ header?: unknown }} */ (last)).header) || "Working").replace(/`/g, "")) : "Starting");
    }
    return ag.busy ? "Working" : ag.held ? esc(heldWords(ag.held)) : "Not working right now";
  }
  /** @param {MapAgent} ag */
  function verbOf(ag) {
    if (ag.waiting) return "waiting for you";
    if (!ag.busy) return ag.held ? "waiting" : "idle";
    if (ag.liveFile) return (ag.liveFile.verb || "working").toLowerCase();
    const k = ag.now && ag.now.kind;
    const said = ag.now && commsLine(ag.now, { project: ag.project });
    if (said) return said.replace(/…$/, "").replace(/^\w/, (c) => c.toLowerCase());
    return k === "command" ? "running a command" : k === "search" || k === "list" ? "looking around" : k === "web_search" || k === "web_fetch" ? "on the web" : k === "subagent" ? "with a sub-agent" : ingOf(ag.now) || (ag.act.running ? "thinking" : "working");
  }
  /** @param {MapStep | null} row */
  const ingOf = (row) => { const w = String((row && row.line) || "").replace(/[`*_]/g, "").trim().split(/[\s…·.]+/)[0] || ""; return /^[A-Za-z]{3,}ing$/.test(w) ? w.toLowerCase() : ""; };

  /** @param {string} view */
  function agents(view) {
    const thread = view.startsWith("t:") ? world.thread(view.slice(2)) : null;
    const list = thread ? [agentOf(thread)] : agentsIn(view.startsWith("p:") ? view.slice(2) : null);
    return list.map((agent) => ({
      id: agent.id, title: agent.title, go: agent.go, busy: agent.busy, waiting: agent.waiting, color: agent.color, since: agent.since,
      doing: agent.waiting ? "waiting for you" : verbOf(agent) + (agent.liveFile ? " " + agent.liveFile.path.split("/").pop() : ""),
    }));
  }

  return { agentOf, agentsIn, agents, doingLine, verbOf };
}
