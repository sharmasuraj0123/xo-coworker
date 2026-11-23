
import { uiMsg } from "../core/services/world/rows.js";
import { currentPools, mainRuntime } from "../core/services/world/sessions.js";
export { uiMsg, addReaction, updateMessage, mergeRows, pageAfter, canPageOlder, framesShort } from "../core/services/world/rows.js";
export { BUSY_STATES, HELD_STATE, runWorks, readSub, sessionRead, statusLater, queuedButWorking, sessionBusy, HELD_FOR, heldOf, currentPools, mainRuntime } from "../core/services/world/sessions.js";
export { threadState, askingState, plainText, askText, stormAsks, stopOf } from "../core/services/world/threads.js";
import { clockWords } from "../core/services/runtimes.js";

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

// ── a conversation read in pages, newest first (R5) ──────────────────────────
// h, a conversation's history so far: {loaded, all, before, loading, older, olderError}. `before` is the
// cursor storm gave with the last page (next_before_seq): the seq to read below. No cursor: all is read.

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

const NB = "\u00a0"; // a time is one phrase: it never breaks across lines ("1:31" / "AM")
const nb = (t) => String(t).replace(/[ \u202f]/g, NB);
/**
 * When a held message starts, in the owner's clock, as {day, hm}: day "" today, "tomorrow", a weekday this
 * week ("Thu"), else a date ("5 Nov"); hm "6:50 AM" (the app's clock format, runtimes.js clockWords). null
 * when it isn't a time.
 */
function whenParts(iso, now) {
  const ms = Date.parse(iso || "");
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms), t = new Date(now), next = new Date(now);
  next.setDate(next.getDate() + 1);
  const hm = clockWords(iso, ms); // the time alone (same day as itself)
  if (d.toDateString() === t.toDateString()) return { day: "", hm };
  if (d.toDateString() === next.toDateString()) return { day: "tomorrow", hm };
  if (ms > now && ms - now < 6 * 86400000) return { day: d.toLocaleDateString(undefined, { weekday: "short" }), hm };
  return { day: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }), date: true, hm };
}
/** The short form, for a list, the sidebar and the header's chip: "6:50 AM", "tomorrow 6:50 AM", "Thu 6:50 AM", "5 Nov 6:50 AM". */
export function heldClock(iso, now = Date.now()) {
  const w = whenParts(iso, now);
  return w ? nb(w.day ? `${w.day} ${w.hm}` : w.hm) : "";
}
/** The same in a sentence, after "starts": "at 6:50 AM", "tomorrow at 6:50 AM", "Thu at 6:50 AM", "on 5 Nov at 6:50 AM". */
function whenWords(iso, now) {
  const w = whenParts(iso, now);
  return w ? nb(`${w.date ? `on ${w.day} ` : w.day ? `${w.day} ` : ""}at ${w.hm}`) : "";
}
const ahead = (h, now) => !!(h && h.until && Date.parse(h.until) > now);

/**
 * A held session in words, one line, as the person reads it where the agent's activity shows:
 * "Waiting for the usage limit · starts at 6:50 AM". One verb for the moment it runs, "starts", wherever
 * it's said (heldShort, the header's chip). The time only while it's ahead: a reset that has passed while
 * it still waits says it's due, not a time gone by. A reason this UI doesn't name is said in the backend's
 * own words. Nothing is claimed that wasn't read (the paid gate's setting: only that it's in Settings).
 * "" when it isn't held.
 */
export function heldWords(h, now = Date.now()) {
  if (!h) return "";
  const at = ahead(h, now) ? whenWords(h.until, now) : "";
  switch (h.for) {
    // "starts" goes with its time: the line breaks before it, never inside it
    case "limit": return at ? `Waiting for the usage limit · starts${NB}${at}` : "Waiting for the usage limit to reset";
    case "paid": return h.asked ? "Waiting for your choice on paid usage · it's in Needs you" : "Waiting before paid usage · see Settings › Runtimes";
    case "near_limit": return "Waiting · near the usage limit, more urgent work goes first";
    case "memory": return "Waiting for memory to free up";
    case "founder": return at ? `Paused by you · until ${at.replace(/^at\u00a0/, "")}` : "Paused by you";
    default: return h.why ? `Waiting · ${h.why}` : "Waiting to start";
  }
}

/** The badge's word: "Waiting", or "Paused" for the founder's own pause. */
export const heldBadge = (h) => (h && h.for === "founder" ? "Paused" : "Waiting");

/**
 * The same in a few words, for a list's state column, a card and the sidebar, where the whole time must fit:
 * "Starts 6:50 AM", "Starts tomorrow 1:47 AM" (the verb the line uses), else "Waiting"; "Paused" for the founder's.
 */
export function heldShort(h, now = Date.now()) {
  if (!h) return "";
  if (h.for === "founder") return "Paused";
  return h.for === "limit" && ahead(h, now) ? `Starts ${heldClock(h.until, now)}` : "Waiting";
}

/** Of several held sessions, the one that starts soonest (a time ahead first, then the rest as given). */
export function soonestHeld(list, now = Date.now()) {
  const hs = (list || []).filter(Boolean);
  const timed = hs.filter((h) => ahead(h, now)).sort((a, b) => Date.parse(a.until) - Date.parse(b.until));
  return timed[0] || hs[0] || null;
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
 * The composer's @target: the first @word that names a known project (or the Workspace). Every other @
 * is plain text and never stops a send: an email, a handle, "@ 5pm", a decorator, a name that isn't a
 * project. Words inside `code` or ``` fences are skipped; a sentence's trailing "." or "-" isn't part
 * of the name. Returns {pid, token}.
 */
export function parseTarget(text, projects) {
  const prose = String(text || "").replace(/```[\s\S]*?(?:```|$)/g, " ").replace(/`[^`\n]*`/g, " ");
  const re = /(^|\s)@([\w.-]+)/g;
  for (let m; (m = re.exec(prose)); ) {
    const word = m[2].replace(/[.-]+$/, "");
    const q = word.toLowerCase();
    const p = q && (projects || []).find((x) => x.id.toLowerCase() === q || String(x.name || "").toLowerCase() === q);
    if (p) return { pid: p.id, token: word };
  }
  return { pid: null, token: null };
}

/** Remove the @token that matched (and only that one). */
export function stripTarget(text, token) {
  if (!token) return String(text || "").trim();
  const re = new RegExp(`(^|\\s)@${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![.-]*\\w)\\s?`);
  return String(text || "").replace(re, "$1").trim();
}

const STORM_DOWN = new Set(["engine_not_running", "engine_elsewhere", "engine_failed", "store_refused", "store_failed", "stream_not_running"]);
const CLI_NAME = { claude_code: "Claude", codex: "Codex", antigravity: "Antigravity" };
/** A runtime's name as people say it (display only). */
export const cliName = (name) => CLI_NAME[name] || String(name || "The agent");

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
  // the app's one clock (heldClock: "1:47 AM", "tomorrow 1:47 AM"), as the held line under the conversation says it
  if (closed) return { kind: "wait", text: `Paused until ${heldClock(closed.resets_at)}`, sub: "usage limit · running work finishes, new work waits" };
  const paid = pools.find((p) => p.state === "paid");
  // state "paid" is HELD, not spending: under Ask me the question is in Needs you; under Never nothing is asked and work waits
  if (paid) return paid.reason === "paid_asked" || paid.reason == null
    ? { kind: "wait", text: "Paused for your choice", sub: "before paid usage · it's in Needs you" }
    : { kind: "wait", text: "Paused before paid usage", sub: "paid usage is set to Never · change it in Settings › Runtimes" };
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
// a thread writing its coordinator: a relay until 11 Nov, an ask since (a status is a report, which wakes no one)
const UP_KINDS = new Set(["relay", "ask"]);

/**
 * What a thread and its coordinators said to each other. Storm keeps those words as hops, the text
 * in `note` (ch 11 §16), never as chat messages: a coordinator's brief, follow-up or answer to the
 * thread, and the thread's own message to it (a relay, or an ask). Returns [{id, seq, at, dir: "down"|"up", from,
 * kind, text}]: `down` is a coordinator writing to the thread (`from` "project" or "workspace", `kind`
 * brief | follow-up | answer), `up` the thread writing to its coordinator; `cause` the hop it answers. A hop whose note hasn't
 * been read yet (the stream's hop frame carries none) isn't here until it is.
 */
export function hopNotes(thread, hops) {
  const out = [];
  for (const hp of hops || []) {
    if (!hp || hp.thread_ts !== thread.id || !String(hp.note || "").trim()) continue;
    const at = Date.parse(hp.created_at || hp.at) || 0;
    const base = { id: hp.id, seq: hp.seq ?? null, at, text: String(hp.note).trim(), cause: hp.cause || null };
    if (hp.to_role === "thread" && COORD_WORD[hp.from_role] && DOWN_KINDS[hp.kind]) out.push({ ...base, dir: "down", from: COORD_WORD[hp.from_role], kind: DOWN_KINDS[hp.kind] });
    else if (hp.from_role === "thread" && COORD_WORD[hp.to_role] && UP_KINDS.has(hp.kind)) out.push({ ...base, dir: "up", from: "thread", kind: hp.kind });
  }
  return out;
}

/**
 * Where a forwarded copy of your message began. A copy's `forwarded_from` names only the copy before it
 * (xo-space's chat holds a copy of the one you wrote; a forward back into the first chat copies that copy), so
 * the chain is followed through `find(id, chatId)`, which returns a stored row or null, up to `max` copies.
 * Starts from `fwd.root` when XO named it. Returns {chatId, id, known, row?}: `known` when the row at the end of the chain was read (it forwards from
 * nothing: this is where you wrote it); otherwise the last copy's source, not yet read.
 */
export function forwardOrigin(fwd, find, max = 6) {
  // XO names the root on a copy (`root`): no walk. Older copies name only the copy before them: follow those.
  const at = (r) => ({ chatId: r.chatId || null, id: r.id });
  const rooted = (r) => { const row = find(r.id, r.chatId); return { ...at(r), known: true, ...(row ? { row } : {}) }; };
  if (fwd.root) return rooted(fwd.root);
  let cur = at(fwd);
  for (let i = 0; i < max; i++) {
    const row = find(cur.id, cur.chatId);
    if (!row) return { ...cur, known: false };
    const f = row.extra && row.extra.forwarded_from;
    if (f && f.root && f.root.message_id) return rooted({ chatId: f.root.chat_id, id: f.root.message_id });
    if (!f || !f.message_id) return { chatId: row.chat_id || cur.chatId, id: cur.id, known: true, row };
    cur = { chatId: f.chat_id || null, id: f.message_id };
  }
  return { ...cur, known: false };
}

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
      // `hop`: when and where in the thread it was passed on, which is where it belongs there (the hop's
      // seq and time, as hopNotes does), not where you wrote it (m.seq / m.at stay the original)
      shown.push({ ...uiMsg(row), hop: { id: hp.id, seq: hp.seq ?? null, at: Date.parse(hp.created_at || hp.at) || 0 } });
    }
    if (lost.length) missing.push({ ids: lost, seq: hp.seq ?? null });
  }
  return { shown, missing };
}

/** The quiet line a stopped thread says: "Stopped by the coordinator · Owner asked for Opus", "Stopped by you". */
export function stopWords(stop) {
  if (!stop) return "";
  const who = stop.by === "you" ? "Stopped by you" : stop.by === "workspace" ? "Stopped by the workspace coordinator" : stop.by === "coordinator" ? "Stopped by the coordinator" : "Stopped";
  return stop.reason ? `${who} · ${stop.reason}` : who;
}

const DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** The list's day groups: Today, Yesterday, This week, then each month by name (with its year when not this one). */
export function dayGroup(iso, now = new Date()) {
  const t = new Date(Date.parse(iso)), ms = t.getTime(), day = startOfDay(now);
  if (!Number.isFinite(ms)) return "Earlier";
  if (ms >= day) return "Today";
  if (ms >= day - DAY) return "Yesterday";
  if (ms >= day - 6 * DAY) return "This week";
  return t.toLocaleDateString(undefined, t.getFullYear() === now.getFullYear() ? { month: "long" } : { month: "long", year: "numeric" });
}
/** A row's time: the clock within the last two days (its group names the day), the weekday this week, else the date. */
export function rowTime(iso, now = new Date()) {
  const t = new Date(Date.parse(iso)), ms = t.getTime(), day = startOfDay(now);
  if (!Number.isFinite(ms)) return "";
  if (ms >= day - DAY) return t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (ms >= day - 6 * DAY) return t.toLocaleDateString(undefined, { weekday: "short" });
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
