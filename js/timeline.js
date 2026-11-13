// Pure helpers between storm's rows (UI-reference §3) and the UI's message and ask
// shapes. No DOM, no fetch: tested from Node (tests/logic.test.mjs).

import { attachmentsOf } from "./attach.js";

const COORDINATORS = new Set(["workspace-coordinator", "project-coordinator"]);

/**
 * A storm message row → the UI's message: {id, chatId, seq, at, who: you|coord|agent|system, text, fwd,
 * job, files, passedOn}. author_kind owner|agent|system; an agent's author_id is its role (UI-reference
 * §3 Message). files: extra.attachments, read through this row's own chat (a forwarded copy has its own
 * ids). passedOn: XO's note that this project's work went on to another project through the Workspace.
 * reactions: extra.reactions, the emoji agents put on it ({emoji, by: session id, at}).
 */
export function uiMsg(row) {
  const who = row.author_kind === "owner" ? "you"
    : row.author_kind === "system" ? "system"
      : COORDINATORS.has(row.author_id) ? "coord" : "agent";
  const x = row.extra || {};
  const f = x.forwarded_from;
  const p = x.passed_on;
  return {
    id: row.id,
    chatId: row.chat_id || null,
    seq: row.seq ?? null,
    at: Date.parse(row.created_at) || 0,
    who,
    role: row.author_id || null,
    text: String(row.text ?? ""),
    fwd: f && f.message_id ? { chatId: f.chat_id || null, id: f.message_id, via: f.via || [] } : null,
    job: x.job || null,
    noOne: !!row.reply_to, // XO's "This message reached no one: …" note
    files: attachmentsOf(row),
    passedOn: p && p.project ? { project: String(p.project), to: (p.forwarded_message_ids || [])[0] || null } : null,
    reactions: Array.isArray(x.reactions) ? x.reactions.filter((r) => r && r.emoji) : [],
    // a move to another runtime (mixed runtimes F4): the old thread's note, and the new thread's root
    continuedIn: x.continued_in || null,
    continuedFrom: x.continued_from || null,
  };
}

/**
 * A `reaction` event ({message_id, emoji, by}) onto the storm rows holding its message: a new list
 * with that row's extra.reactions grown by one, or null when the message isn't in `list`.
 */
export function addReaction(list, d, at = null) {
  const i = (list || []).findIndex((r) => r && r.id === d.message_id);
  if (i < 0 || !d.emoji) return null;
  const row = list[i], x = row.extra || {};
  const next = [...list];
  next[i] = { ...row, extra: { ...x, reactions: [...(x.reactions || []), { emoji: d.emoji, by: d.by || null, at }] } };
  return next;
}

/**
 * A `message.updated` event ({id, chat_id, thread_ts, extra}) onto the storm rows holding its message: a
 * new list with that row's extra merged with the event's (files an agent shared after its turn's last
 * reply arrive this way, on that reply), or null when the message isn't in `list`.
 */
export function updateMessage(list, d) {
  const i = d && d.id ? (list || []).findIndex((r) => r && r.id === d.id) : -1;
  if (i < 0 || !d.extra || typeof d.extra !== "object") return null;
  const row = list[i];
  const next = [...list];
  next[i] = { ...row, extra: { ...(row.extra || {}), ...d.extra } };
  return next;
}

/** A message's reactions grouped by emoji, first-seen order: [{emoji, count, by: [session ids]}]. */
export function reactionGroups(reactions) {
  const by = new Map();
  for (const r of reactions || []) {
    const g = by.get(r.emoji) || { emoji: r.emoji, count: 0, by: [] };
    g.count++;
    if (r.by && !g.by.includes(r.by)) g.by.push(r.by);
    by.set(r.emoji, g);
  }
  return [...by.values()];
}

/** Merge storm rows into a list ordered by seq (ids are not ordered). Returns {list, added}. */
export function mergeRows(list, incoming) {
  const byId = new Map(list.map((m) => [m.id, m]));
  const added = [];
  for (const row of incoming || []) {
    if (!row || !row.id) continue;
    const old = byId.get(row.id);
    if (!old) added.push(row);
    byId.set(row.id, old && old.seq != null && row.seq == null ? { ...row, seq: old.seq } : row);
  }
  return { list: [...byId.values()].sort(bySeq), added };
}
const bySeq = (a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0);

// ── a conversation read in pages, newest first (R5) ──────────────────────────
// h, a conversation's history so far: {loaded, all, before, loading, older, olderError}. `before` is the
// cursor storm gave with the last page (next_before_seq): the seq to read below. No cursor: all is read.

/**
 * The history after one page's answer ({messages, next_before_seq}): its cursor, whether that was all, and
 * whether it ever had more than one page (then its beginning is worth saying when you reach it).
 */
export function pageAfter(h, d) {
  const before = d && d.next_before_seq != null ? d.next_before_seq : null;
  return { ...h, loaded: true, before, all: before == null, paged: !!(h && h.paged) || before != null };
}

/** Whether to read the next older page now: loaded, more to read, nothing on its way, no failure to retry by hand. */
export function canPageOlder(h) {
  return !!(h && h.loaded && !h.all && !h.loading && !h.older && !h.olderError && h.before != null);
}

/**
 * The oldest seq a paged conversation holds (its messages, oldest first or not), or null once all is read.
 * What is older than this (a thread's root request, a coordinator's note, a turn that ended before it) waits
 * for its page, so nothing shows cut off from the messages around it.
 */
export function pageFloor(h, rows) {
  if (!h || !h.loaded || h.all) return null;
  let floor = null;
  for (const r of rows || []) if (r && r.seq != null && (floor == null || r.seq < floor)) floor = r.seq;
  return floor;
}

/**
 * Whether a conversation item is inside the pages read: seq ≥ floor (a turn counts from where it ended).
 * One with no seq (a move's banner, a note of ours) by its time, against floorAt (the oldest message's).
 */
export function inPage(item, floor, floorAt = null) {
  if (floor == null || !item || item.who === "hist") return true;
  if (item.seq == null) return floorAt == null || !(item.at < floorAt);
  const s = item.who === "turn" && item.turn ? (item.turn.lastSeq ?? item.seq) : item.seq;
  return s >= floor;
}

/** Whether a session's stored frames still stop short of a page's oldest message (read one more page of them). */
export const framesShort = (framesBefore, floor) => framesBefore != null && floor != null && framesBefore > floor;

/**
 * Your message in a thread that waits for its agent's running turn to end: stored after the turn
 * started and not one of its wakes (`msg:<id>`). A thread message never joins a running turn, so it
 * waits until the turn ends, or until a Stop ends it and the message runs next.
 */
export function waitsForTurn(m, turn) {
  return !!(turn && turn.status === "running" && m && m.who === "you" && m.id && m.seq != null && turn.seq != null &&
    m.seq > turn.seq && !(turn.wakes || []).includes(`msg:${m.id}`));
}

/**
 * Optimistic rows whose server copy is already in `rows` (the stream can beat
 * the POST). Returns Map(localId → serverId). A server row is used once, and
 * only if no other local row claimed it (`taken`).
 */
export function echoes(locals, rows, taken = new Set()) {
  const out = new Map();
  const free = rows.filter((r) => r.who === "you" && !taken.has(r.id));
  for (const m of locals) {
    if (m.merged || m.status === "failed" || m.who !== "you") continue;
    const i = free.findIndex((r) => r.text === m.text && (r.files || []).length === (m.files || []).length && r.at >= m.at - 60000);
    if (i < 0) continue;
    out.set(m.id, free[i].id);
    free.splice(i, 1);
  }
  return out;
}

/** Plain text for a title: no markdown marks, links keep their words. */
export function plainText(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a message into a short title (its first sentence, ≤ max) and the rest. */
export function askText(md, max = 140) {
  const s = plainText(md);
  if (!s) return { title: "", rest: "" };
  const m = /^(.{12,}?[.?!:])(\s|$)/.exec(s);
  let title;
  if (m && m[1].length <= max) title = m[1].replace(/:$/, ".");
  else if (s.length <= max) title = s;
  else title = s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  const used = m && m[1].length <= max ? m[1].length : title.replace(/…$/, "").length;
  return { title, rest: s.slice(used).trim() };
}

/**
 * The thread's state as shown, given its session's running turn (or null) and whether its agent works
 * now (busy, below). A stopped turn leaves the thread at needs_reply (ch 11 §7.3) until its next input
 * ends; after an Interrupt that input is already your message, running, so the thread isn't waiting on you.
 * Storm's state is how the last turn ended: a message into a done or stopped thread starts a turn and
 * leaves it done or failed until that turn ends (only resolved and paused flip to working). While its
 * agent works, it shows Working, everywhere a thread's state is read; the turn's end sets it again.
 */
export function threadState(state, turn, busy = false) {
  if (state === "needs_reply" && turn && turn.status === "running" && turn.origin === "person") return "working";
  if (busy && (state === "done" || state === "failed")) return "working";
  return state || "working";
}

// ── busy: is an agent at work right now ("Working")? ─────────────────────────
// Storm says it on every session and thread view (xo-space 8c6bc03): `busy` is true while the session is
// on a turn (queued, starting, running, stopping) or while a sub-agent works on after its turn ended.
// Live session frames still carry only the status, so between reads the same rule is applied here: the
// status, then the sub-agents the stream names (run.* until run.finished, and the `runs` frame's counts).
// An older backend sends no `busy`: then the status and the stream's runs are all there is, and that's
// the same rule with less to go on.

/** Session states in which its agent is on a turn (storm's engine BUSY_STATES). */
export const BUSY_STATES = new Set(["queued", "starting", "running", "stopping"]);
const RUN_ENDED = new Set(["finished", "failed", "stopped", "lost"]);
/** A sub-agent run the stream said started and hasn't said ended. An internal (hidden) one isn't the person's to see. */
export const runWorks = (r) => !!r && !r.ended_at && !RUN_ENDED.has(r.state) && !r.hidden;

/**
 * What a read of a session (a session view, or a thread view's `session`) says beyond its status: true
 * when it was busy with no turn running, i.e. a sub-agent working on after the turn. undefined when the
 * view has no `busy` (an older backend), so nothing is assumed either way.
 */
export function readSub(view) {
  if (!view || typeof view.busy !== "boolean") return undefined;
  return view.busy && !BUSY_STATES.has(view.state);
}

/** A session read's word on busy, to spread onto its record: {sub, readAt} when the view has `busy`, else {}. */
export function sessionRead(view, now = Date.now()) {
  const sub = readSub(view);
  return sub === undefined ? {} : { sub, readAt: now };
}

/**
 * Is a session's agent at work? s: {id, state, sub, readAt}: its newest status (frame or read), what
 * the last read said beyond it (readSub) and when that read came (ms). runs: its runs as the stream named
 * them ({state, ended_at, hidden, seen}, `seen` when the stream last spoke of each); agg: its newest
 * `runs` frame ({running, waiting, at}). Each says what it knows, the newest word winning:
 *   · waiting on the person is never Working, whatever else is true: it's you who's awaited (Needs you);
 *   · on a turn (BUSY_STATES) is Working;
 *   · after the turn, a sub-agent still at work keeps it Working: a run the stream named since the last
 *     word on the counts, else the `runs` frame's counts when they're newer than the read, else the read.
 */
export function sessionBusy(s, { runs = [], agg = null } = {}) {
  if (!s) return false;
  if (s.state === "waiting_on_person") return false;
  if (BUSY_STATES.has(s.state)) return true;
  const readAt = s.readAt || 0;
  const counted = agg && (agg.at || 0) >= readAt ? agg : null;
  const since = Math.max(readAt, counted ? counted.at || 0 : 0);
  for (const r of runs) if ((r.session == null || r.session === s.id) && runWorks(r) && (r.seen || 0) >= since) return true;
  if (counted) return (counted.running || 0) + (counted.waiting || 0) > 0;
  return s.sub === true;
}

/**
 * The state a thread shows while it has open items: an open item on the thread (its own ask or one of
 * its sub-agents') waits on the person whatever the row says yet. The row's needs_approval can trail
 * the item's frame, and a resolved thread's sub-agent can still ask; a thread continued elsewhere
 * (frozen) or already waiting keeps its state.
 */
export function askingState(state, openItems, frozen = false) {
  if (!openItems || frozen || state === "needs_reply" || state === "needs_approval" || state === "paused") return state;
  return "needs_approval";
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

/**
 * What a storm thread asks of the person (UI-reference §3 Thread, §2.4 Item).
 * - Open review items on the thread are its asks, one each, in the queue's order (the server's
 *   risk, title, why and options travel with them; the UI decides nothing).
 * - needs_reply: the card's needs_you (the agent's last reply), answered in words.
 * - paused: the loop breaker stopped it; a reply in the thread resumes it.
 * The id carries the card's update time, so a new ask on the same thread is a new key.
 */
export function stormAsks(t, items = []) {
  const asks = [];
  for (const it of items) {
    asks.push({
      id: it.id, kind: it.kind, title: it.title || "It needs your decision", detail: it.why || "",
      risk: it.risk || "notable", riskReasons: it.risk_reasons || [], options: null,
      blocking: !!it.blocking, item: it, live: true, storm: true,
    });
  }
  if (asks.length) return asks;
  if (t.state === "needs_reply") {
    const full = String((t.card && t.card.needs_you) || t.happened || "").trim();
    const { title, rest } = askText(full);
    asks.push({ id: `${t.id}:${(t.card && t.card.updated_at) || t.lastAt}`, kind: "question", title: title || "It's waiting for your reply", detail: clip(rest, 220), full, risk: "notable", options: null, replyOnly: true, live: true });
  } else if (t.state === "paused" && !t.frozen) {
    // a thread continued elsewhere is frozen, not waiting on you (mixed runtimes F4)
    const why = String(t.paused || "it was stuck on a denied step");
    asks.push({ id: `${t.id}:paused:${t.lastAt}`, kind: "question", title: "It paused and waits for you", detail: `Why: ${why}. A reply in the thread resumes it.`, full: why, risk: "notable", options: null, replyOnly: true, live: true, paused: true });
  } else if (t.state === "needs_approval") {
    // the item hasn't reached this tab yet (or was decided elsewhere a moment ago)
    asks.push({ id: `${t.id}:approval:${t.lastAt}`, kind: "approval", title: String((t.card && t.card.needs_you) || "It needs your decision"), detail: "Open the thread to see what it needs.", risk: "notable", options: null, replyOnly: true, live: true, pending: true });
  }
  return asks;
}

/**
 * Where each thread's card sits in a timeline. A thread is rooted on a
 * timeline row (thread ts = row id). Its card goes under the coordinator's
 * first reply after that root (within the next few rows, before another
 * root); otherwise it stands alone right after the root.
 * Returns Map(rowId → [threadId…]) and the set of roots placed standalone.
 */
export function threadAnchors(msgs, threadIds) {
  const ids = new Set(threadIds);
  const on = new Map();
  const alone = new Set();
  msgs.forEach((m, i) => {
    if (!ids.has(m.id)) return;
    let at = null;
    for (let j = i + 1; j < Math.min(msgs.length, i + 4); j++) {
      const n = msgs[j];
      if (ids.has(n.id)) break;
      if (n.who === "coord") { at = n.id; break; }
    }
    if (at) on.set(at, [...(on.get(at) || []), m.id]);
    else alone.add(m.id);
  });
  return { on, alone };
}

/**
 * The composer's @target. Only a token that names a known project (or the
 * Workspace) is a target; anything else is left in the text and reported.
 * Returns {pid, token, unknown}.
 */
export function parseTarget(text, projects) {
  const m = /(^|\s)@([\w.-]+)/.exec(String(text || ""));
  if (!m) return { pid: null, token: null, unknown: null };
  const q = m[2].toLowerCase();
  const p = (projects || []).find((x) => x.id.toLowerCase() === q || String(x.name || "").toLowerCase() === q);
  return p ? { pid: p.id, token: m[2], unknown: null } : { pid: null, token: null, unknown: m[2] };
}

/** Remove the @token that matched (and only that one). */
export function stripTarget(text, token) {
  if (!token) return String(text || "").trim();
  const re = new RegExp(`(^|\\s)@${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.-])\\s?`);
  return String(text || "").replace(re, "$1").trim();
}

const STORM_DOWN = new Set(["engine_not_running", "engine_elsewhere", "engine_failed", "store_refused", "store_failed", "stream_not_running"]);
const CLI_NAME = { claude_code: "Claude", codex: "Codex", antigravity: "Antigravity" };
/** A runtime's name as people say it (display only). */
export const cliName = (name) => CLI_NAME[name] || String(name || "The agent");
/**
 * The runtime this server is for: the one /api/chat/runtimes marks `default` (the server's AGENT_NAME),
 * else the first one connected, else the first listed. Null when there are none.
 */
export const mainRuntime = (rts) => (rts || []).find((r) => r.default) || (rts || []).find((r) => r.cli && r.cli.logged_in && !r.error) || (rts || [])[0] || null;

/** A plain title for a failed send (the storm error codes, UI-reference §2.2). */
export function sendErrorTitle(err) {
  if (!err) return "Message not sent";
  if (err.code === "router_off") return "The router is off";
  if (err.code === "chat_retired") return "This project was removed";
  if (err.code === "auth_required") return "The agent isn't connected";
  if (err.code === "no_runtime") return "No agent can run this";
  if (err.code === "coordinator_busy") return "The coordinator is busy";
  if (err.code === "thread_not_found" || err.code === "session_retired") return "This thread is gone";
  if (STORM_DOWN.has(err.code)) return "XO's chat engine isn't running";
  if (err.code === "timeout") return "No answer from XO";
  if (err.status === 501) return "Not supported by this agent";
  if (err.status === 403) return "Refused by the proxy";
  if (err.status === 0 || err.status === 502) return "Can't reach XO";
  return "Message not sent";
}

const hhmm = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };

/**
 * The pools that can hold work back now (if1 #1). A pool id is "<runtime>:<account>" (storm's
 * pool_id); after a re-login the old account's pool stays listed, closed until its reset, but
 * nothing runs on it. So a pool counts only when its account is the runtime's account now. A
 * runtime whose account isn't known yet, and an id that isn't runtime:account, count as before.
 */
export function currentPools(pools, runtimes) {
  const now = new Map();
  for (const r of runtimes || []) if (r && r.name && r.cli && r.cli.account) now.set(r.name, r.cli.account);
  return Object.entries(pools || {}).filter(([key, p]) => {
    const id = String((p && p.pool) || key);
    const i = id.indexOf(":");
    if (i < 0) return true;
    const acct = now.get(id.slice(0, i));
    return !acct || acct === id.slice(i + 1);
  }).map(([, p]) => p);
}

/**
 * The one honest line about the connection and what can run, or null when all is well.
 * w: {error, conn, statusError, statusCode, runtimes, router, pools, loaded}
 */
/** What routes a chat: its own routing when it has one, else the Space's (xo-space's chats/router.py effective()).
 *  pid: the chat's project id ("workspace" for the Workspace); without one, the Space's. */
export function routingOf(w, pid = null) {
  const own = pid && (w && w.projects || []).find((p) => p.id === pid)?.routing;
  return own && own.mode ? own : (w && w.router) || null;
}
/** Off, in words true to the server: only a new message to a chat whose routing is off is refused (delivery.py checks
 *  the chat's effective routing on the timeline, never in a thread). Astra C111 on dd15034. */
function offLine(w, pid) {
  const r = routingOf(w, pid), own = pid && (w.projects || []).find((p) => p.id === pid)?.routing;
  if (!r || r.mode !== "off") return null;
  return own && own.mode ? { kind: "off", text: "Routing is off for this chat", sub: "new messages here are refused · replies in threads still work" }
    : { kind: "off", text: "The router is off", sub: "chats using it refuse new messages · replies in threads still work" };
}

/** The line above the composer: thread (a reply in a thread, never routed) shows no routing-Off line, as the send
 *  gate lets it go; pid: the chat a new message goes to (Launchpad grader on 83929bb: one rule with the gate) */
export function connLine(w, { pid = null, thread = false } = {}) {
  if (!w) return null;
  // the engine down is said as such: the UI server answered, so it isn't the network
  if (STORM_DOWN.has(w.statusCode) || STORM_DOWN.has(w.errorCode)) return { kind: "down", text: "XO's chat engine isn't running", sub: "retrying · nothing you write is lost" };
  if (w.error || w.statusError || w.conn === "down") return { kind: "down", text: "Can't reach XO", sub: "retrying · what you see may be out of date" };
  const rts = w.runtimes || [];
  if (rts.length && rts.every((r) => !r.cli || r.cli.logged_in === false || r.error)) {
    const r = mainRuntime(rts);
    return { kind: "off", text: `${cliName(r.name)} isn't connected`, sub: "connect it in XO · sending waits until then" };
  }
  const off = thread ? null : offLine(w, pid);
  if (off) return off;
  const pools = currentPools(w.pools, rts);
  const closed = pools.find((p) => p.state === "closed");
  if (closed) return { kind: "wait", text: `Paused until ${hhmm(closed.resets_at)}`, sub: "usage limit · running work finishes, new work waits" };
  const paid = pools.find((p) => p.state === "paid");
  if (paid) return { kind: "wait", text: "Paused for your choice", sub: "your subscription moved onto paid usage · it's in Needs you" };
  return null;
}

/** Why sending is paused right now ("" when it isn't), for the composer. timeline: posting to a chat's timeline. */
export function sendBlock(w, { timeline = true, pid = null } = {}) {
  if (!w) return "";
  if (STORM_DOWN.has(w.statusCode) || STORM_DOWN.has(w.errorCode)) return "XO's chat engine isn't running";
  if (w.error && !(w.projects && w.projects.length)) return "Can't reach XO right now";
  if (!w.loaded) return "Connecting to XO…";
  const rts = w.runtimes || [];
  if (rts.length && rts.every((r) => !r.cli || r.cli.logged_in === false || r.error)) return `${cliName(mainRuntime(rts).name)} isn't connected`;
  // a new message to a chat whose routing is off (its own, or the Space's when it has none); a thread's reply never
  if (timeline) { const off = offLine(w, pid); if (off) return off.text; }
  return "";
}

/**
 * A plain chat in order: your prompts (from the CLI's own history, each at the time the CLI wrote it)
 * and storm's turns (each at its start, whole seconds), as [{kind: "you", m} | {kind: "turn", t}].
 * The CLI writes a prompt some time after its turn starts (claude at once, codex after its own context,
 * seconds on a cold start), so times alone can put a reply above its prompt. A turn is paired with the
 * prompts that woke it instead: as many as its `msg:prompt:` wakes (one for a turn you started), taken
 * between the start of the turn before it and the start of the next: those written once it began,
 * else the last one sent just before it (from this tab, not in the history yet). The first goes just
 * above the turn; any more (added while it ran) just below. A prompt no turn took (typed in the CLI
 * itself, say) keeps its time.
 * prompts: [{at: ms, …}]; turns: [{at: ISO, origin, wakes}] in the order they ran.
 */
export function chatOrder(prompts, turns) {
  const mine = prompts.map((m, i) => ({ m, i })).sort((a, b) => a.m.at - b.m.at || a.i - b.i);
  const taken = new Set();
  const start = (t) => Date.parse(t && t.at) || 0;
  const groups = turns.map((t, k) => {
    const n = (t.wakes || []).filter((w) => String(w).startsWith("msg:prompt:")).length || (t.origin === "person" ? 1 : 0);
    const lo = k ? start(turns[k - 1]) : -Infinity;
    const hi = k + 1 < turns.length ? start(turns[k + 1]) : Infinity;
    const at = start(t);
    const free = mine.filter((x) => !taken.has(x) && x.m.at >= lo && x.m.at < hi);
    // written once the turn began (the CLI's history), else the last one sent just before (this tab's
    // own, not in the history yet); one typed in the CLI between turns is left to its time
    const after = free.filter((x) => x.m.at >= at);
    const before = free.filter((x) => x.m.at < at);
    const pick = n ? (after.length ? after.slice(0, n) : before.slice(-1).concat(after.slice(0, n - 1))) : [];
    for (const x of pick) taken.add(x);
    return { at, k, t, got: pick.map((x) => x.m) };
  });
  const loose = mine.filter((x) => !taken.has(x)).map((x) => ({ at: x.m.at, m: x.m }));
  // a loose prompt at the same moment as a turn goes first: it may have woken it
  const all = [...loose, ...groups].sort((a, b) => a.at - b.at || (a.t ? 1 : 0) - (b.t ? 1 : 0) || (a.k ?? 0) - (b.k ?? 0));
  const out = [];
  for (const x of all) {
    if (!x.t) { out.push({ kind: "you", m: x.m }); continue; }
    if (x.got[0]) out.push({ kind: "you", m: x.got[0] });
    out.push({ kind: "turn", t: x.t });
    for (const m of x.got.slice(1)) out.push({ kind: "you", m });
  }
  return out;
}

/** Run `fn` over `items`, at most `cap` at a time. */
export async function mapLimit(items, cap, fn) {
  const list = [...items];
  const run = async () => { while (list.length) await fn(list.shift()); };
  await Promise.all(Array.from({ length: Math.min(cap, list.length) }, run));
}

/**
 * A hop as one quiet line in a thread or on a timeline (ch 11 §16), said from who sent it to whom, from
 * the hop's own roles: forward, relay, brief, ask, status, answer. project: the conversation's project
 * name; onward: the name of the project a forward went on to (work handed from one project to another
 * through the Workspace has via ["project", "workspace"]).
 */
export function hopLine(h, project, onward = null) {
  const who = (role) => ({ thread: "this thread", "project-coordinator": `the ${project} coordinator`, "workspace-coordinator": "the Workspace", xo: "XO", owner: "you", person: "you" })[role] || "someone";
  const from = who(h.from_role), to = who(h.to_role);
  const state = h.state === "sent" ? " · not taken up yet" : h.state === "answered" ? " · answered" : "";
  const up = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const via = h.via || [];
  // a coordinator or XO acting for this thread says so
  const forThread = via.includes("thread") && h.from_role !== "thread" && h.to_role !== "thread" ? " on behalf of this thread" : "";
  switch (h.kind) {
    case "forward": return via.includes("project") && onward && onward !== project ? `Passed to ${onward} through the Workspace${state}` : `Forwarded by the Workspace${state}`;
    case "brief": return `${via.includes("workspace") ? "Forwarded by the Workspace, via the project" : `From ${from}`}${state}`;
    case "relay": return h.from_role === "project-coordinator" && h.to_role === "thread" && (h.message_ids || []).length ? `The ${project} coordinator passed on your message${state}` : `${up(from)} wrote to ${to}${forThread}${state}`;
    case "ask": return `${up(from)} asked ${to}${forThread}${state}`;
    case "status": return `${up(from)} reported back to ${to}${state}`;
    case "answer": return `${up(from)} answered ${to}`;
    default: return "";
  }
}

/**
 * Where a thread's shared file can be read (if1 #2): {project, rel} for the project-scoped
 * `/api/xo-projects/<project>/file` route, or {why} when there's no route. A shared file's path is
 * relative to the thread's folder: the project folder itself (a project without git), or its
 * worktree `<project>/.xo/worktrees/thread-<ts>/`. Anything else has no route: it's said, never guessed.
 */
export function sharedFileRoute(thread, path) {
  const none = { why: "This file is in a folder XO doesn't serve to the UI yet." };
  if (!thread || !thread.project) return none;
  let p = String(path || "").replace(/\\/g, "/");
  const root = String(thread.worktree || thread.cwd || "").replace(/\/+$/, "");
  // an absolute path inside the thread's own folder is the same file
  if (p.startsWith("/")) { if (root && p.startsWith(root + "/")) p = p.slice(root.length + 1); else return none; }
  p = p.replace(/^\.\//, "");
  if (!p || p.split("/").some((seg) => seg === ".." || seg === "")) return none;
  if (thread.worktree) {
    const i = String(thread.worktree).indexOf("/.xo/worktrees/");
    if (i < 0) return none;
    const sub = String(thread.worktree).slice(i + 1).replace(/\/+$/, "");
    if (!/^\.xo\/worktrees\/[^/]+$/.test(sub)) return none;
    return { project: thread.project, rel: `${sub}/${p}` };
  }
  const cwd = String(thread.cwd || "").replace(/\/+$/, "");
  if (cwd && cwd.split("/").pop() === thread.project) return { project: thread.project, rel: p };
  return none;
}

const COORD_WORD = { "project-coordinator": "project", "workspace-coordinator": "workspace" };
const DOWN_KINDS = { brief: "brief", relay: "follow-up", answer: "answer" };

/**
 * What a thread and its coordinators said to each other. Storm keeps those words as hops, the text
 * in `note` (ch 11 §16), never as chat messages: a coordinator's brief, follow-up or answer to the
 * thread, and the thread's own message_coordinator. Returns [{id, seq, at, dir: "down"|"up", from,
 * kind, text}]: `down` is a coordinator writing to the thread (`from` "project" or "workspace", `kind`
 * brief | follow-up | answer), `up` the thread writing to its coordinator. A hop whose note hasn't
 * been read yet (the stream's hop frame carries none) isn't here until it is.
 */
export function hopNotes(thread, hops) {
  const out = [];
  for (const hp of hops || []) {
    if (!hp || hp.thread_ts !== thread.id || !String(hp.note || "").trim()) continue;
    const at = Date.parse(hp.created_at || hp.at) || 0;
    const base = { id: hp.id, seq: hp.seq ?? null, at, text: String(hp.note).trim() };
    if (hp.to_role === "thread" && COORD_WORD[hp.from_role] && DOWN_KINDS[hp.kind]) out.push({ ...base, dir: "down", from: COORD_WORD[hp.from_role], kind: DOWN_KINDS[hp.kind] });
    else if (hp.from_role === "thread" && COORD_WORD[hp.to_role] && hp.kind === "relay") out.push({ ...base, dir: "up", from: "thread", kind: "relay" });
  }
  return out;
}

/**
 * Your messages relayed into a thread (if1 #7). Storm doesn't copy a relayed message into the thread:
 * the hop into it (a relay, a brief, an answer: any hop to the thread) names the message, which stays on the project's timeline. Returns
 * {shown: [ui message, each with `hop` {id, seq, at}: when it was passed on], missing: [{ids, seq}]}: the owner's own messages found on the loaded
 * timeline (each once, never one the thread already has), and per hop the ids not loaded yet,
 * with the hop's seq as the upper bound to page back from. Someone else's words are never shown as yours.
 */
export function relayedInto(thread, hops, timeline, have = new Set(), found = null) {
  const shown = [], missing = [], seen = new Set(have);
  for (const hp of hops || []) {
    if (!hp || hp.thread_ts !== thread.id || hp.to_role !== "thread" || !(hp.message_ids || []).length) continue;
    const lost = [];
    for (const id of hp.message_ids) {
      if (seen.has(id)) continue;
      const row = timeline.find((r) => r.id === id) || (found && found.get(id));
      if (!row) { lost.push(id); continue; }
      seen.add(id);
      const m = uiMsg(row);
      // `hop`: when and where in the thread it was passed on, which is where it belongs there (the hop's
      // seq and time, as hopNotes does), not where you wrote it (m.seq / m.at stay the original)
      if (m.who === "you") shown.push({ ...m, hop: { id: hp.id, seq: hp.seq ?? null, at: Date.parse(hp.created_at || hp.at) || 0 } });
    }
    if (lost.length) missing.push({ ids: lost, seq: hp.seq ?? null });
  }
  return { shown, missing };
}

