// @ts-check

import { clock, short } from "../../core/platform/time.js";
import { esc } from "../../core/platform/util.js";
import { heldWords } from "../../core/services/world/held.js";
import { stopWords } from "../../core/services/world/conversation.js";
import { isResult } from "../../core/services/world/relay.js";
import { ICON } from "../../core/ui/icons/names.js";
import { stateMark } from "../../core/ui/icons/icon.js";
import { handoffHtml, handBackHtml, setupHtml } from "./handoff.js";

/** @import { Message } from "./message-types.d.ts" */

/** @import { Hop } from "../../core/services/world/hop-types.d.ts" */

/** @import { MessageDetailsDeps, MessageThread } from "./message-details-types.d.ts" */

/** @import { RankedNeed } from "../../core/services/decision-types.d.ts" */

/** "4 min", "2 h 5 min". @param {number} at */
const quietFor = (at, now = Date.now()) => {
  const m = Math.max(1, Math.round((now - at) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
};

/** @param {MessageDetailsDeps} deps */
export function createMessageDetails({
  aliases, world, REC, SHAPE, PROJ, convThread, convProject, isBusy, isHeld, stOf, glyphOf, wordOf, EFFORT,
  askTitle, threadMark, noun, sendWhileRunning, running, workingRuns, agentOf, isStopping,
}) {
  /** @param {string} tid @param {RankedNeed[]} needs */
  function threadCardHtml(tid, needs) {
    const t = world.thread(tid);
    if (!t) return "";
    const c = t.checklist;
    const n = needs.find((x) => x.t.id === t.id && x.admitted);
    const heldN = !n ? needs.find((x) => x.t.id === t.id && x.held) : null;
    const cur = c.items.find((i) => i.state === "doing") || c.items.find((i) => i.state === "todo");
    const segs = c.items.map((i) => `<i class="sg s-${i.state}"></i>`).join("");
    const back = !n && !isBusy(t) && t.activity === "handed_back";
    const stalled = !n && !isBusy(t) && !isHeld(t) && t.activity === "stalled" && (t.messages || []).slice(-1)[0]?.who !== "you";
    const st = n ? `Needs you · ${EFFORT[n.effort].time}` : isBusy(t) ? `Working${c.total ? ` · ${c.done} of ${c.total}` : ""}`
      : back ? `Handed back · ${clock(handedAt(t))}` : stalled ? `Stalled · ${quietFor(t.lastAt)}`
        : t.state === "done" ? `Done${c.total ? ` · ${c.total} of ${c.total}` : ""}` : wordOf(t);
    const now = n ? `${ICON.needs}${askTitle(n)}` : isBusy(t) && cur ? `${ICON.doing}${esc(cur.text)}` : stalled ? "The coordinator was told." : isHeld(t) ? esc(heldWords(t.held)) : t.stop ? esc(stopWords(t.stop)) : t.state === "failed" ? esc(String(t.happened || "").replace(/^Stopped:\s*/i, "")) : t.state === "done" ? esc(t.happened || "Finished.") : "";
    const made = !n && (t.state === "done" || back) && REC.latestOf ? REC.latestOf(t.id, t.project) : null;
    return `<div class="tcard st-${n ? "needs" : back ? "done" : stalled ? "stalled" : stOf(t)}${made ? " has-next" : ""}">` +
      `<button type="button" class="tc-open" data-go="t:${esc(t.id)}" aria-label="Open thread: ${esc(t.title)}, ${esc(st)}">` +
      `<span class="tc-top">${stateMark(n ? "needs_reply" : glyphOf(t))}<b>${esc(t.title)}</b><span class="tc-st">${esc(st)}</span></span>` +
      `<span class="tc-segs${segs ? "" : " is-empty"}" aria-hidden="true">${segs}</span>` +
      (now ? `<span class="tc-now">${now}</span>` : "") +
      `<span class="tc-foot">${threadMark(t, { withName: true })}${t.branch && SHAPE.on("xo:thread/branch") ? `<code>${esc(t.branch)}</code>` : `<span>${noun("thread")}</span>`}${heldN ? `<span class="tc-cw">a small ask can wait</span>` : ""}<span>${short(t.lastAt) === "now" ? "just now" : short(t.lastAt) + " ago"}</span><span class="tc-go">Open ${ICON.arrow}</span></span></button>` +
      (n ? `<button type="button" class="tc-dec" data-decide="${esc(n.key)}">Decide</button>` : "") +
      (made ? `<button type="button" class="tc-next" data-made-file="${esc(made.key)}" title="${esc(made.path)}">${ICON.doc}<span>${back ? "Open its result" : `Open ${esc(made.title || made.name)}`}</span></button>` : "") +
      `</div>`;
  }

  /** @param {string} conv */
  function queuedMeta(conv, answered = false) {
    const t = convThread(conv);
    if (!t) return "";
    if (isStopping(t.sessionId) || world.act.sessionState(t.sessionId) === "stopping") return `<div class="meta"><i class="spin" aria-hidden="true"></i><span>Stopping its turn · it reads this next</span></div>`;
    if (sendWhileRunning(t) === "steered") return answered ? "" : `<div class="meta"><span>Sent into its current turn</span></div>`;
    const run = running(conv);
    const n = workingRuns(t);
    const title = `Stop the agent's current turn${n ? ` and its ${n} sub-agent${n === 1 ? "" : "s"}` : ""} so it reads this now (Undo for 3 s)`;
    return `<div class="meta"><span>Waiting · the agent reads this when its current turn ends</span>` +
      (run && run.kind === "thread" ? `<button type="button" class="meta-btn" data-interrupt title="${esc(title)}">${ICON.bolt}Interrupt</button>` : "") + `</div>`;
  }

  /** @param {string} conv @param {string} who */
  function nameOf(conv, who) {
    if (who === "coord") return [conv === "ws" ? "Coordinator" : `${PROJ(convProject(conv))} coordinator`, ""];
    const t = convThread(conv);
    return [t ? `${PROJ(t.project)} agent` : "Agent", (SHAPE.on("xo:thread/branch") && t?.branch) || SHAPE.word("thread")];
  }

  /** @param {MessageThread} t */
  const unfreezeHtml = (t) => `<button type="button" class="ev-undo" data-unfreeze="${esc(t.id)}"` +
    ` title="Its agent carries on here; the new thread keeps going too">Pick this thread back up</button>`;

  /** @param {MessageThread | null | undefined} t */
  const setupOfThread = (t) => {
    if (!t) return null;
    const s = t.session || (t.sessionId ? world.state.sessions?.[t.sessionId] : null) || {};
    return { agent: agentOf(t), model: s.model || null, effort: s.effort || null };
  };

  /** @param {Message} m @param {MessageThread | null} here */
  function moveBannerHtml(m, here) {
    /** @param {string | undefined} text */
    const reasonOf = (text) => { const i = String(text || "").indexOf(": "); return i > 0 ? (/** @type {string} */ (text)).slice(i + 2).trim() : ""; };
    /** @param {string} ts @param {string} fallback */
    const link = (ts, fallback) => { const o = world.thread(ts); return o ? `<button type="button" class="rt-go" data-go="t:${esc(ts)}" title="Open “${esc(o.title)}”"><b>${esc(o.title)}</b></button>` : `<b>${esc(fallback)}</b>`; };
    if (m.continuedIn) {
      const to = world.thread(m.continuedIn), mv = (here && here.movedTo) || {};
      const after = setupOfThread(to) || { agent: mv.agent || null };
      if (!after.agent) after.agent = mv.agent || null;
      const why = mv.reason || reasonOf(m.text);
      const frozen = !!(here && here.frozen);
      return handoffHtml({ from: setupOfThread(here), to: after, at: m.at,
        words: `Continued in ${link(m.continuedIn, "a new thread")}${why ? `: ${esc(why)}` : ""}`,
        after: frozen ? unfreezeHtml(/** @type {MessageThread} */ (here)) : "" });
    }
    const from = world.thread(/** @type {string} */ (m.continuedFrom));
    const why = reasonOf(m.text);
    return handoffHtml({ from: setupOfThread(from), to: setupOfThread(here) || {}, at: m.at,
      words: `Continued from ${link(/** @type {string} */ (m.continuedFrom), "an earlier thread")}${why ? `: ${esc(why)}` : ""}` });
  }

  /** A coordinator's change_thread_setup line, on the same runtime. @param {Message} m @param {MessageThread | null} here */
  const setupBannerHtml = (m, here) => (m.setup ? setupHtml(m.setup, here ? agentOf(here) : null, m.at) : "");

  /** When a thread last handed its result back: its newest result hop, else its last change. @param {MessageThread} t */
  function handedAt(t) {
    let at = 0;
    for (const h of world.state.hops?.values() || []) {
      if (isResult(h) && h.thread_ts === t.id) at = Math.max(at, Date.parse(h.created_at || h.at || "") || 0);
    }
    return at || t.lastAt;
  }

  /** A result hop as one quiet line: giver's mark, arrow, receiver's mark, the result. @param {Hop} h @param {MessageThread} t */
  function handBackRowHtml(h, t) {
    const sessions = world.state.sessions || {};
    const from = (h.from_session && sessions[h.from_session]?.agent) || agentOf(t);
    const to = (h.to_session && sessions[h.to_session]?.agent) || null;
    const toWho = h.to_role === "workspace-coordinator" ? "the Workspace coordinator" : `the ${PROJ(t.project)} coordinator`;
    const made = REC.latestOf ? REC.latestOf(t.id, t.project) : null;
    const at = Date.parse(h.created_at || h.at || "") || t.lastAt;
    const title = made ? made.title || made.name || null : null;
    return handBackHtml({ from, to, toWho, at, title, file: made?.key || null, path: made?.path || null });
  }

  /** @param {Message} m */
  function passedTo(m) {
    if (!world.state.hops) return null;
    const ids = new Set([m.sid, m.id, m.key].filter(Boolean));
    for (const [sid, lid] of aliases()) if (ids.has(lid)) ids.add(sid);
    if (!ids.size) return null;
    for (const h of world.state.hops.values()) {
      if ((h.kind === "relay" || h.kind === "brief") && h.to_role === "thread" && h.thread_ts && (h.message_ids || []).some((x) => ids.has(x))) return world.thread(h.thread_ts)?.title || "a thread";
    }
    return null;
  }

  return { threadCardHtml, queuedMeta, nameOf, moveBannerHtml, setupBannerHtml, handBackRowHtml, passedTo };
}
