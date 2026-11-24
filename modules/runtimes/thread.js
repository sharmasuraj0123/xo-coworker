// @ts-check
import { esc } from "../../core/platform/util.js";
import { rtName, rtMark, manyRuntimes, findRt, healthOf, canMove, untilWords } from "../../core/services/runtimes.js";
import { heldClock } from "../../core/services/world/held.js";

/** @import { AgentThread, RuntimeThread, ThreadRuntimeDeps } from "./thread-types.d.ts" */

/** @param {ThreadRuntimeDeps} options */
export function createThreadRuntime({ world, SHAPE, isHeld }) {
  /** @param {AgentThread | null | undefined} t */
  const agentOf = (t) => (t && ((t.session && t.session.agent) || (t.sessionId && world.state.sessions[t.sessionId]?.agent))) || null;
  /** @param {AgentThread} t @param {Parameters<typeof rtMark>[1]} [opts] */
  const threadMark = (t, opts) => { const a = agentOf(t); return a && manyRuntimes(world.state.runtimes) ? rtMark(a, opts) || "" : ""; };
  /** @type {Record<string, string>} */
  const RT_EFFORT = { low: "Quick", medium: "Balanced", high: "Deep", xhigh: "Deeper", max: "Deepest" };
  /** @param {RuntimeThread} t */
  function waitingOn(t) {
    if (!isHeld(t) || (t.held.for && t.held.for !== "limit")) return null;
    const lim = (t.limits || [])[0];
    const at = t.held.until || (lim && lim.limit && lim.limit.resetsAt) || null;
    return at && Date.parse(at) > Date.now() ? at : null;
  }
  /** @param {RuntimeThread} t @param {string} [cls] */
  function rtTag(t, cls) {
    const rts = world.state.runtimes;
    const agent = agentOf(t);
    if (!agent) return "";
    const many = manyRuntimes(rts);
    const wait = cls !== "ar" && waitingOn(t);
    if (wait) {
      const who = many ? rtName(agent) : "";
      const tip = `${who || "Your agent"} reached its usage limit. This thread starts on its own ${heldClock(wait)}${untilWords(wait) ? `, ${untilWords(wait)}` : ""}.`;
      return `<button type="button" class="tw-rt is-warn" data-set-open="runtimes" title="${esc(tip)}" aria-label="${esc(`${tip} Open Runtimes in Settings.`)}">${who ? `${esc(who)} limit` : "Usage limit"} · starts ${esc(heldClock(wait))}</button>`;
    }
    if (!many) return "";
    const rt = findRt(rts, agent), h = healthOf(rt), se = t.session || {};
    const ver = rt && rt.health && rt.health.cli_version;
    const tip = [`Runs on ${rtName(agent)}${ver ? ` ${ver}` : ""}`, se.model || "its default model", se.effort ? RT_EFFORT[se.effort] || se.effort : ""].filter(Boolean).join(" · ") +
      `. ${h.key === "usable" ? `${rtName(agent)} is usable.` : `${h.word}.${h.why ? ` ${h.why}` : ""}`}`;
    const warn = h.tone === "bad" || h.tone === "warn" ? " is-warn" : "";
    if (cls === "ar" && !warn) return "";
    if (!warn && !SHAPE.on("xo:thread/runtime")) return "";
    return cls === "ar" ? `<span class="ar-r${warn}" title="${esc(tip)}">${rtMark(agent) || esc(rtName(agent))}<span aria-hidden="true"> · </span></span>`
      : `<button type="button" class="tw-rt${warn}" data-set-open="runtimes" title="${esc(tip)}" aria-label="${esc(tip)} Open Runtimes in Settings.">${rtMark(agent, { withName: true }) || esc(rtName(agent))}</button>`;
  }
  /** @param {AgentThread | null | undefined} t */
  const sendWhileRunning = (t) => {
    const rt = findRt(world.state.runtimes, agentOf(t)); const f = rt && rt.features && rt.features.features && rt.features.features.send_while_running;
    return (f && f.behaviour) || null;
  };
  /** @param {RuntimeThread | null | undefined} t */
  const movable = (t) => !!(world.act.storm && world.act.policyFor && t && !t.movedTo && agentOf(t) && world.act.policyFor(t.project) && canMove(agentOf(t), world.act.policyFor(t.project), world.state.runtimes));
  return { agentOf, threadMark, rtTag, sendWhileRunning, movable };
}
