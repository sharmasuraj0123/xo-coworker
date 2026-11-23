// @ts-check
import { tasksOf } from "../../../../js/model.js";
import { uiMsg } from "../../world/rows.js";
import { stopOf, stormAsks, threadState, askingState } from "../../world/threads.js";
import { isLimitItem, limitItem } from "../../runtimes.js";
import { BUSY } from "../config.js";

/** @typedef {import("../types").Ctx} Ctx @typedef {import("../types").Row} Row */

// a thread's title and label are plain text: one that came escaped ("Settings &amp; Home") reads as it was meant
const ENTITIES = /** @type {Record<string, string>} */ ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" });
/** @param {any} v */
const plainText = (v) => (v == null ? v : String(v).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ENTITIES[e]));

/** The thread view-model: a raw storm row made into what the views render. @param {Ctx} ctx */
export function installThreads(ctx) {
  const { state } = ctx;

  /** @param {string} ts */
  function openItemsFor(ts) {
    const out = [];
    for (const it of state.review.values()) if (it.thread_ts === ts && it.state === "open") out.push(it);
    return out;
  }
  /** Where a thread went (continued in) and where it came from, from every trace of a move we hold. @type {Map<string, Row>} */
  let fromIndex = new Map();
  ctx.indexMoves = () => {
    fromIndex = new Map();
    for (const rows of Object.values(state.timeline)) for (const row of /** @type {Row[]} */ (rows) || []) { const f = row.extra && row.extra.continued_from; if (f) fromIndex.set(row.id, { from: f, text: row.text || "" }); }
  };
  /** @param {Row} r */
  function moveOf(r) {
    // the row says it (continued_in / continued_from); else the frame, or the old thread's note
    let to = state.moves[r.ts] || (r.continued_in ? { to: r.continued_in } : null);
    if (!to) for (const m of state.threadMsgs[r.ts] || []) { const x = m.extra && m.extra.continued_in; if (x) to = { to: x, text: m.text || "" }; }
    const from = r.continued_from ? { from: r.continued_from, ...(fromIndex.get(r.ts) || {}) } : fromIndex.get(r.ts) || null;
    // frozen: paused because its work moved on. Picked back up, the link stays as history.
    return { movedTo: to, movedFrom: from, frozen: r.state === "paused" && !!to };
  }
  ctx.chatPolicyOf = (chat) => (chat && state.chatPolicy[chat] && state.chatPolicy[chat].effective) || (state.policy && state.policy.effective) || null;
  /** The open usage-limit items a thread waits on, ready to show. @param {string} ts */
  const limitsFor = (ts) => [...state.review.values()].filter((it) => it.state === "open" && isLimitItem(it) && (it.detail.threads || []).some((/** @type {Row} */ x) => x.ts === ts)).map((it) => limitItem(it, state.runtimes, ctx.chatPolicyOf));
  /** The runs the stream named, by session (rebuilt once per commit, not per thread). */
  ctx.runsBySession = () => {
    /** @type {Map<string, Row[]>} */
    const by = new Map();
    for (const r of state.runs.values()) if (r && r.session) (by.get(r.session) || by.set(r.session, []).get(r.session) || []).push(r);
    return by;
  };

  /** @param {Row[] | undefined} rows */
  function youWroteLast(rows) {
    /** @type {Row | null} */
    let last = null;
    for (const m of rows || []) if (!last || (m.seq ?? -1) > (last.seq ?? -1)) last = m;
    return !!last && last.author_kind === "owner";
  }
  ctx.uiThread = (r, runsBy = ctx.runsBySession()) => {
    const project = ctx.projectOf(r.chat_id);
    const now = r.session_id ? ctx.sessionNow(r.session_id, r) : null;
    const sstate = (now && now.state) || null;
    const card = r.card || {};
    const busy = ctx.threadBusy(r, now, runsBy);
    const turn = r.session_id && (busy || BUSY.has(sstate)) ? state.turns.running(r.session_id) : null;
    // held back by a gate (the usage limit, …): nothing runs, its message waits; what for and until when
    const held = busy ? null : ctx.heldOfSession(now, runsBy.get(r.session_id) || []);
    /** @type {Row} */
    const t = {
      id: r.ts, project, chatId: r.chat_id,
      title: plainText(r.title) || "Thread", label: plainText(r.label) || null,
      // held is one shown state: a done, stopped or needs-reply thread whose next input waits reads Waiting
      state: threadState(r.state, turn, busy, !!held, r.activity === "stalled" && youWroteLast(state.threadMsgs[r.ts])),
      headline: "", happened: card.happened || "", needsYou: "",
      branch: r.branch || null, worktree: r.worktree_path || null, cwd: r.cwd || null,
      createdAt: Date.parse(r.created_at) || Date.now(), lastAt: Date.parse(r.updated_at) || Date.now(),
      checklist: tasksOf(r.status_md || ""),
      messages: (state.threadMsgs[r.ts] || []).map(uiMsg),
      asks: [], live: true, loaded: !!(state.threadHist[r.ts] && state.threadHist[r.ts].loaded),
      // "Working" means its agent really works, never just the thread's state; waiting on you is never Working
      busy,
      held,
      sessionId: r.session_id || null, sessionState: sstate,
      session: r.session || null, paused: (r.session && r.session.paused) || null,
      resolvedAt: r.resolved_at || null, agentMs: r.agent_ms || 0, pin: r.pin || {}, runs: r.runs || null,
      outputs: r.outputs || [], card,
      // a newer backend: one past-tense sentence of what it did, and its branch's git state (null until read)
      summary: r.summary || null, git: r.git || null,
      // Space can delete it (a newer backend says so per thread): the thread's ⋯ offers Delete only then
      canDelete: r.can_delete === true,
      ...moveOf(r), limits: limitsFor(r.ts),
    };
    const open = openItemsFor(r.ts);
    // an open item on the thread waits on you whatever its row says yet: its list row, header and Now chip say so
    t.state = askingState(t.state, open.length, t.frozen);
    // a stop someone meant reads "failed" in storm, and is no failure; who stopped it and why come from its thread.control rows
    t.activity = r.activity || null; t.waitReason = r.wait_reason || null;
    t.stop = t.state === "failed" ? stopOf(t.activity, t.waitReason, state.controls[r.ts]) : null;
    t.asks = stormAsks(t, open);
    t.needsYou = t.asks.length ? t.asks[0].title : "";
    return t;
  };
}
