// @ts-check

import { stopWords } from "../../core/services/world/conversation.js";
import { heldWords } from "../../core/services/world/held.js";

/** @import { MapAgent, ThreadGroup, ThreadGroupDeps, ThreadInfo, ThreadNeed, GroupLabels } from "./groups-types.d.ts" */

/** @template {ThreadNeed} N @param {Pick<ThreadGroupDeps<N>, "MAP" | "askShort" | "isHeld">} options @param {GroupLabels} words */
export function createSubtitles({ MAP, askShort, isHeld }, words) {
  /** @param {string} pid */
  const active = (pid) => new Map(MAP.agents(pid === "workspace" ? "ws" : "p:" + pid).map((a) => [a.go, a]));

  /** @param {ThreadInfo} t @param {ThreadGroup} state @param {N[]} needs @param {MapAgent} [agent] */
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

  return { active, subtitle };
}
