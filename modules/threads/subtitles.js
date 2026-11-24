// @ts-check

import { stopWords } from "../../core/services/world/conversation.js";
import { heldWords } from "../../core/services/world/held.js";

/** @import { MapAgent, ThreadGroup, ThreadGroupDeps, ThreadInfo, ThreadNeed } from "./groups-types.d.ts" */

/** @param {Pick<ThreadGroupDeps, "MAP" | "askShort" | "isHeld">} options @param {Record<ThreadGroup, string>} words */
export function createSubtitles({ MAP, askShort, isHeld }, words) {
  /** @param {string} pid */
  const active = (pid) => new Map(MAP.agents(pid === "workspace" ? "ws" : "p:" + pid).map((a) => [a.go, a]));

  /** @param {ThreadInfo} t @param {ThreadGroup} state @param {ThreadNeed[]} needs @param {MapAgent} [agent] */
  function subtitle(t, state, needs, agent) {
    const ask = state === "needs" && needs.find((n) => n.t.id === t.id);
    if (state === "working" && agent) return agent.doing;
    if (ask) return askShort(ask);
    if (t.stop) return stopWords(t.stop);
    if (t.summary) return t.summary;
    if (t.state === "failed") return "Stopped";
    if (t.state === "resolved") return "Resolved";
    return isHeld(t) ? heldWords(t.held) : words[state];
  }

  /** @param {string} pid @param {ThreadNeed[]} needs @param {(thread: ThreadInfo) => ThreadGroup} stateOf */
  function forProject(pid, needs, stateOf) {
    const doing = active(pid);
    return (/** @type {ThreadInfo} */ t) => subtitle(t, stateOf(t), needs, doing.get("t:" + t.id));
  }

  return { active, subtitle, forProject };
}
