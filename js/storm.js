// The world on storm: the real XO Space, through `/api/chat/*` and ONE global stream
// (/home/coder/sedc/handoffs/UI-reference.md §4.0). Normalises storm's chats, threads, messages,
// sessions, turns and review items into the world the views render (js/world.js), and turns
// the person's actions into requests. It owns no decision logic: risk, scopes, rule sentences,
// routing and permission answers come from the server.
//
// Boot (§4.0): open the stream from "now" and hold its frames; load everything with GETs; then
// apply the held frames in order, so nothing that changed during the load is lost or reverted.
// After that the stream is the only source of change: it resumes with Last-Event-ID after a drop
// (the server replays what was missed), and a `reset` for retention or a replaced store reloads.

import { api, clientId as newClientId, NEWEST, coderHeaders, STORM_DOWN } from "./api.js";
import { SSEStream } from "./sse.js";
import { createTurns } from "./blocks.js";
import { tasksOf } from "./model.js";
import { uiMsg, mergeRows, addReaction, updateMessage, stormAsks, mapLimit, currentPools, threadState, askingState, mainRuntime, BUSY_STATES, readSub, sessionRead, sessionBusy, pageAfter, canPageOlder, framesShort } from "./timeline.js";
import { hostOf, askedBy } from "./review.js";
import { isLimitItem, limitItem } from "./runtimes.js";

const STATUS_MS = 30000;          // the engine's status (pools, review counts); frames carry the rest
const STATUS_RETRY_MS = 8000;
const RUNTIMES_MS = 5 * 60000;    // a CLI login can change outside XO
const CHATS_MIN_MS = 30000;       // re-list chats at most this often on our own
const PAGE = 40;                  // the first page of a conversation; older pages grow from here
const PAGE_MAX = 200;
const RUNS_KEEP = 300;            // finished sub-agents kept in memory, beyond those of the open thread
const LOAD_CAP = 6;               // parallel GETs at boot
const AWAIT_CAP_MS = 10 * 60000;  // "replying" never outlives this without a signal

const BUSY = BUSY_STATES; // a session on a turn (timeline.js; storm's engine BUSY_STATES)
const COORD = new Set(["workspace-coordinator", "project-coordinator"]);
export const WAITING_STATES = new Set(["needs_reply", "needs_approval", "paused"]);

export function stormSource(state, emit, event) {
  Object.assign(state, {
    status: null, statusError: null, runtimes: null, router: null, pools: {},
    policy: null,    // {space, effective}: the Space's runtime policy (mixed runtimes §2.2)
    chatPolicy: {},  // chat_… → {space, project, effective}: a project's own runtime policy
    controls: {},    // thread ts → [{action, by, by_session, reason, at, seq}]: thread.control (F6)
    moves: {},       // old thread ts → {to, from, agent, from_agent, reason, by, wip}: thread.continued (F4)
    conn: "connecting", connInfo: null,
    timeline: {},    // project id → storm message rows on its timeline, by seq
    hist: {},        // project id → {all, loading, error, before}
    found: {},       // project id → Map(message id → row): rows looked up by id (a relayed message, a thread's
                     // root), kept off the visible timeline so a lookup never grows the project's conversation
    threadMsgs: {},  // thread ts → storm message rows, by seq
    threadHist: {},  // thread ts → {loading, loaded, error, all, before, paged, older, olderError}: read in pages, newest first
    sessions: {},    // cse id → {id, role, chat_id, thread_ts, state, agent, model, effort, paused, retired_at, seq}
    awaiting: {},    // project id → {id, at}: we wrote to its timeline, no answer yet
    failed: {},      // project id → {at, error}: the coordinator's turn for our message failed
    routed: {},      // workspace message id → [{chat: project id}]
    review: new Map(), // open review items by id
    runs: new Map(),   // sub-agent runs seen on the stream (run_… → summary), live list and log (ch 14 §11)
    hops: new Map(),   // hop id → hop (11 §16): how a message travelled; shown only by choice
    liveRuns: {},      // session → {running, waiting, tokens, at} from the live `runs` frames
    turns: createTurns(),
    lastSeq: 0,
  });
  const chatProject = new Map(); // chat_… → project id ("workspace" or the folder)
  const rawThreads = new Map();  // ts → the storm thread row, kept merged
  let held = [];                 // frames received while the first load runs
  let holding = true;
  let stream = null;
  let statusT = null, runtimesT = null, recoverT = null;
  let chatsAt = 0, chatsBusy = null;
  const watched = { projects: new Set(), thread: null, session: null }; // what's on screen, to reload after a reset
  const trimmed = new Set(); // sessions whose older turns were pruned (read again when shown)
  const framesBefore = new Map(); // session → the cursor below its stored frames read so far (null: all read)
  let firstFrame = null;
  const sawFrame = new Promise((r) => { firstFrame = r; });

  const projectOf = (chatId) => (chatId ? chatProject.get(chatId) || null : null);
  const chatIdOf = (project) => state.projects.find((p) => p.id === project)?.chatId || null;

  // ── normalising ───────────────────────────────────────────────────────────
  function openItemsFor(ts) {
    const out = [];
    for (const it of state.review.values()) if (it.thread_ts === ts && it.state === "open") out.push(it);
    return out;
  }
  function sessionStateOf(r) {
    const live = r.session_id ? state.sessions[r.session_id] : null;
    return (live && live.state) || (r.session && r.session.state) || null;
  }
  /** F4: where a thread went (continued in) and where it came from, from every trace of a move we hold. */
  let fromIndex = new Map();
  function indexMoves() {
    fromIndex = new Map();
    for (const rows of Object.values(state.timeline)) for (const row of rows || []) { const f = row.extra && row.extra.continued_from; if (f) fromIndex.set(row.id, { from: f, text: row.text || "" }); }
  }
  function moveOf(r) {
    // the row says it (continued_in / continued_from, next backend); until then the frame, or the old thread's note
    let to = state.moves[r.ts] || (r.continued_in ? { to: r.continued_in } : null);
    if (!to) for (const m of state.threadMsgs[r.ts] || []) { const x = m.extra && m.extra.continued_in; if (x) to = { to: x, text: m.text || "" }; }
    const from = r.continued_from ? { from: r.continued_from, ...(fromIndex.get(r.ts) || {}) } : fromIndex.get(r.ts) || null;
    // frozen: paused because its work moved on. Picked back up, the link stays as history.
    return { movedTo: to, movedFrom: from, frozen: r.state === "paused" && !!to };
  }
  const chatPolicyOf = (chat) => (chat && state.chatPolicy[chat] && state.chatPolicy[chat].effective) || (state.policy && state.policy.effective) || null;
  /** The open usage-limit items a thread waits on (F5), ready to show. */
  const limitsFor = (ts) => [...state.review.values()].filter((it) => it.state === "open" && isLimitItem(it) && (it.detail.threads || []).some((x) => x.ts === ts)).map((it) => limitItem(it, state.runtimes, chatPolicyOf));
  /** The runs the stream named, by session (rebuilt once per commit, not per thread). */
  function runsBySession() {
    const by = new Map();
    for (const r of state.runs.values()) if (r && r.session) (by.get(r.session) || by.set(r.session, []).get(r.session)).push(r);
    return by;
  }
  /**
   * Is a thread's agent at work (timeline.js sessionBusy)? Its session's newest status, and what the
   * newest read said beyond it: the session list's or this thread view's own `busy`, whichever came later.
   */
  function threadBusy(r, sstate, runsBy) {
    const sid = r.session_id;
    if (!sid) return false;
    const live = state.sessions[sid];
    const view = r.session ? { sub: readSub({ state: r.session.state, busy: typeof r.session.busy === "boolean" ? r.session.busy : r.busy }), readAt: r._readAt || 0 } : null;
    const ok = (x) => x && x.sub !== undefined;
    const read = ok(live) && (!ok(view) || (live.readAt || 0) >= view.readAt) ? live : ok(view) ? view : null;
    return sessionBusy({ id: sid, state: sstate, sub: read ? read.sub : undefined, readAt: read ? read.readAt || 0 : 0 }, { runs: runsBy.get(sid) || [], agg: state.liveRuns[sid] || null });
  }
  function uiThread(r, runsBy = runsBySession()) {
    const project = projectOf(r.chat_id);
    const sstate = sessionStateOf(r);
    const card = r.card || {};
    const turn = r.session_id && sstate && BUSY.has(sstate) ? state.turns.running(r.session_id) : null;
    const t = {
      id: r.ts, project, chatId: r.chat_id,
      title: r.title || "Thread", label: r.label || null,
      state: threadState(r.state, turn),
      headline: "", happened: card.happened || "", needsYou: "",
      branch: r.branch || null, worktree: r.worktree_path || null, cwd: r.cwd || null,
      createdAt: Date.parse(r.created_at) || Date.now(), lastAt: Date.parse(r.updated_at) || Date.now(),
      checklist: tasksOf(r.status_md || ""),
      messages: (state.threadMsgs[r.ts] || []).map(uiMsg),
      asks: [], live: true, loaded: !!(state.threadHist[r.ts] && state.threadHist[r.ts].loaded),
      // "Working" means its agent really works (11 §6.3), never just the thread's state: on a turn, or a
      // sub-agent working on after it; waiting on you is never Working (timeline.js sessionBusy)
      busy: threadBusy(r, sstate, runsBy),
      sessionId: r.session_id || null, sessionState: sstate,
      session: r.session || null, paused: (r.session && r.session.paused) || null,
      resolvedAt: r.resolved_at || null, agentMs: r.agent_ms || 0, pin: r.pin || {}, runs: r.runs || null,
      outputs: r.outputs || [], card,
      // a newer backend: one past-tense sentence of what it did, and its branch's git state (null until read)
      summary: r.summary || null, git: r.git || null,
      ...moveOf(r), limits: limitsFor(r.ts),
    };
    const open = openItemsFor(r.ts);
    // an open item on the thread waits on you whatever its row says yet: its list row, header and Now chip say so
    t.state = askingState(t.state, open.length, t.frozen);
    t.asks = stormAsks(t, open);
    t.needsYou = t.asks.length ? t.asks[0].title : "";
    return t;
  }

  /** Rebuild the thread list and announce the changes worth a line. */
  function commit() {
    indexMoves();
    const prev = new Map(state.threads.map((t) => [t.id, t]));
    const known = new Set(state.projects.map((p) => p.id));
    const next = [];
    const runsBy = runsBySession();
    for (const r of rawThreads.values()) {
      const t = uiThread(r, runsBy);
      if (!t.project || !known.has(t.project)) continue;
      const old = prev.get(t.id);
      if (state.loaded && !holding) {
        if (old && old.state !== t.state) event({ kind: t.state === "done" ? "done" : WAITING_STATES.has(t.state) && !t.frozen ? "ask" : "state", thread: t.id, project: t.project, text: `${t.title}: ${t.state.replace("_", " ")}` });
        if (!old) event({ kind: "spawn", thread: t.id, project: t.project, text: `New thread: ${t.title}` });
        if (old && WAITING_STATES.has(old.state) && !WAITING_STATES.has(t.state)) event({ kind: "resumed", thread: t.id, project: t.project });
      }
      next.push(t);
    }
    state.threads = next.sort((a, b) => b.lastAt - a.lastAt);
    // items with no thread (paid usage, a project the workspace proposes, a plain chat's report)
    // still reach Needs you: each is hosted by its chat or by the person's account
    const hosts = new Map();
    for (const it of state.review.values()) {
      if (it.state !== "open") continue;
      const h = hostOf(it);
      if (!h) continue;
      // an item of your account (usage) or of a plain chat belongs to no project row in the sidebar
      const project = h.chat ? projectOf(h.chat) || "workspace" : h.session ? "@chats" : "@account";
      // in a project or the Workspace, who asked: its coordinator (or a sub-agent of it), not a thread
      const asker = h.chat ? askerOf(it) : null;
      const host = hosts.get(h.id) || { id: h.id, host: true, project, chatId: h.chat, plainSession: h.session || null, asker, title: h.title || (asker ? "Coordinator" : project === "workspace" ? "Workspace" : project),
        state: "needs_approval", checklist: { items: [], total: 0, done: 0, doing: 0 }, messages: [], asks: [], live: true, loaded: true, busy: false,
        createdAt: Date.parse(it.created_at) || Date.now(), lastAt: Date.parse(it.created_at) || Date.now(), card: {} };
      // a usage limit (F5): its words in the owner's terms, and no move a project's policy forbids
      const shown = isLimitItem(it) ? limitItem(it, state.runtimes, chatPolicyOf) : it;
      if (shown !== it) host.title = "Usage limit";
      host.asks.push(...stormAsks(host, [shown]));
      hosts.set(h.id, host);
    }
    state.hosts = [...hosts.values()];
  }
  const askerOf = (it) => askedBy(it, it.session_id ? state.sessions[it.session_id] : null);
  let soonT = null, emitT = null;
  const soon = () => { clearTimeout(soonT); soonT = setTimeout(() => { commit(); emit(); }, 30); };
  const emitSoon = () => { if (!emitT) emitT = setTimeout(() => { emitT = null; emit(); }, 40); };

  // ── loading ───────────────────────────────────────────────────────────────
  function setProjects(chats) {
    const prev = new Map(state.projects.map((p) => [p.id, p]));
    chatProject.clear();
    state.projects = chats.filter((c) => !c.retired_at).map((c) => {
      const id = c.kind === "workspace" ? "workspace" : c.project;
      chatProject.set(c.id, id);
      return { ...(prev.get(id) || {}), id, name: c.kind === "workspace" ? "Workspace" : c.project, kind: c.kind, chatId: c.id, pid: c.project_pid || null, routing: c.routing || null, pin: c.pin || null, hasChat: true };
    });
    for (const c of chats) if (c.retired_at) chatProject.set(c.id, c.project || null);
  }
  async function loadChats() {
    if (chatsBusy) return chatsBusy;
    chatsBusy = (async () => {
      try {
        const { chats } = await api.chats();
        const before = new Set(state.projects.map((p) => p.chatId));
        setProjects(chats || []);
        chatsAt = Date.now();
        state.error = null; state.errorCode = null;
        // a project chat we haven't seen: its threads (there may be none yet)
        const fresh = state.projects.filter((p) => p.kind === "project" && !before.has(p.chatId));
        if (state.loaded) await mapLimit(fresh, LOAD_CAP, loadThreads);
      } catch (err) {
        state.error = err.message;
        state.errorCode = err.code;
        scheduleRecover();
      }
      soon();
    })();
    try { return await chatsBusy; } finally { chatsBusy = null; }
  }
  /** The first load failed (storm restarting, the server down): try again until it works. */
  function scheduleRecover(ms = 8000) {
    if (recoverT) return;
    recoverT = setTimeout(async () => { recoverT = null; await recover(); }, ms);
  }
  let recovering = null;
  async function recover() {
    if (recovering) return recovering;
    if (!state.error && state.projects.length) return;
    recovering = (async () => {
      holding = true;
      // live updates wait at most 15 s for the reload; a hung GET doesn't freeze the page
      try { await Promise.race([loadAll(), new Promise((r) => setTimeout(r, 15000))]); } finally {
        commit();
        holding = false;
        for (const f of held.splice(0)) apply(f);
        commit(); emit();
      }
    })();
    try { await recovering; } finally { recovering = null; }
  }
  const maybeChats = () => { if (Date.now() - chatsAt > CHATS_MIN_MS) loadChats(); };
  async function loadThreads(p) {
    const asked = Date.now();
    try {
      const { threads } = await api.threads(p.chatId);
      const seen = new Set();
      for (const r of threads || []) { seen.add(r.ts); rawThreads.set(r.ts, { ...(rawThreads.get(r.ts) || {}), ...r, _at: Date.now(), _readAt: Date.now() }); }
      // gone from the listing, unless a frame made it after the listing was read
      for (const [ts, r] of rawThreads) if (r.chat_id === p.chatId && !seen.has(ts) && (r._at || 0) < asked) rawThreads.delete(ts);
    } catch { /* keep the last good threads for this project */ }
  }
  async function loadSessions() {
    // the coordinators (for "is replying") and the thread sessions' live state
    try {
      let after = 0;
      for (let i = 0; i < 10; i++) {
        const d = await api.sessions({ after_seq: after, limit: 500 });
        for (const s of d.sessions || []) noteSession(s);
        if (!d.next_after_seq) break;
        after = d.next_after_seq;
      }
    } catch { /* the stream's session frames fill in */ }
  }
  function noteSession(s) {
    const old = state.sessions[s.id];
    if (old && old.seq != null && s.seq != null && old.seq > s.seq) return;
    // the whole Session (a plain chat needs its native_id, cwd and permission_mode), and what its `busy`
    // says beyond the status (a sub-agent working on after the turn), with when it was read
    state.sessions[s.id] = { ...(old || {}), ...s, paused: s.paused || null, retired_at: s.retired_at || null, seq: s.seq ?? null, ...sessionRead(s) };
  }
  async function loadReview() {
    try {
      let after = null;
      const seen = new Set();
      for (let i = 0; i < 10; i++) {
        const d = await api.review({ state: "open", limit: 500, ...(after ? { after_seq: after } : {}) });
        for (const it of d.items || []) { seen.add(it.id); state.review.set(it.id, it); }
        if (!d.next_after_seq) break;
        after = d.next_after_seq;
      }
      for (const id of [...state.review.keys()]) if (!seen.has(id)) state.review.delete(id);
    } catch { /* U2's queue reads it again */ }
  }
  /**
   * "Routed to billing-api" receipts under the person's workspace messages (11 §16). A forward's
   * hop names the project's copy of the message, and the copy names the original in
   * `extra.forwarded_from`; so the receipts come from the copies. At boot: the projects the
   * workspace forwarded to (from its hops) have their newest page loaded; after that, every copy
   * arrives on the stream.
   */
  async function loadRouted() {
    const ws = chatIdOf("workspace");
    if (!ws) return;
    try {
      const { hops } = await api.hops(ws, { before_seq: NEWEST, limit: 500 });
      const targets = [...new Set((hops || []).filter((h) => h.kind === "forward").map((h) => projectOf(h.chat_id)).filter((p) => p && p !== "workspace"))];
      await mapLimit(targets, LOAD_CAP, (p) => loadTimeline(p));
    } catch { /* receipts come back with new copies */ }
  }
  function noteCopies(project, rows) {
    const ws = chatIdOf("workspace");
    if (!ws || project === "workspace") return;
    for (const r of rows) {
      const f = r.extra && r.extra.forwarded_from;
      if (!f || f.chat_id !== ws || !f.message_id) continue;
      const list = state.routed[f.message_id] || (state.routed[f.message_id] = []);
      if (!list.some((x) => x.chat === project)) list.push({ chat: project, messageId: r.id });
    }
  }
  async function loadStatus() {
    clearTimeout(statusT);
    try {
      state.status = await api.status();
      state.statusError = null; state.statusCode = null;
      const fresh = (state.status.pools || []).some((p) => !(p.id in state.pools));
      for (const p of state.status.pools || []) state.pools[p.id] = { ...(state.pools[p.id] || {}), pool: p.id, state: p.state, resets_at: p.resets_at, paid_continue_until: p.paid_continue_until };
      // A pool not seen before is a new account (a re-login), and while something holds work back
      // the account may have changed under it: either way, read which account each runtime is on
      // now rather than up to 5 min later, so an old account's pool stops pausing (if1 #1).
      if (poolsSeen && (fresh || poolHeld())) refreshRuntimes();
      poolsSeen = true;
    } catch (err) {
      state.statusError = err.message; state.statusCode = err.code;
    }
    emit();
    statusT = setTimeout(loadStatus, state.statusError ? STATUS_RETRY_MS : STATUS_MS);
  }
  let poolsSeen = false, runtimesBusy = null;
  const poolHeld = () => currentPools(state.pools, state.runtimes).some((p) => p.state === "closed" || p.state === "paid");
  function refreshRuntimes() {
    if (!runtimesBusy) runtimesBusy = loadRuntimes().finally(() => { runtimesBusy = null; });
  }
  async function loadRuntimes() {
    clearTimeout(runtimesT);
    try { state.runtimes = (await api.runtimes()).runtimes || []; } catch { /* keep what we had */ }
    try { state.router = await api.router(); } catch { /* keep what we had */ }
    emit();
    runtimesT = setTimeout(loadRuntimes, RUNTIMES_MS);
  }

  /** The runtime policy: the Space's, and each project's (a backend without them leaves both empty). */
  async function loadPolicies() {
    try { state.policy = await api.runtimePolicy(); } catch { return; }
    await mapLimit(state.projects.filter((p) => p.kind === "project" && p.chatId), LOAD_CAP, async (p) => {
      try { state.chatPolicy[p.chatId] = await api.chatRuntimePolicy(p.chatId); } catch { /* the Space's applies */ }
    });
    emit();
  }

  /** Everything, from the server. Returns once the world can render. */
  async function loadAll() {
    await loadChats();
    if (!state.projects.length) return;
    await Promise.all([
      mapLimit(state.projects.filter((p) => p.kind === "project"), LOAD_CAP, loadThreads),
      loadSessions(), loadReview(), loadRouted(), loadRuntimes(), loadPolicies(),
    ]);
  }

  // ── messages and history (R5: paged backwards by seq) ─────────────────────
  function addRows(project, rows) {
    const { list, added } = mergeRows(state.timeline[project] || [], rows);
    state.timeline[project] = list;
    if (added.length) noteCopies(project, added);
    return added;
  }
  async function loadTimeline(project) {
    const chat = chatIdOf(project);
    if (!chat) return;
    const h = state.hist[project];
    if (h && (h.loading || h.loaded)) return;
    state.hist[project] = { loading: true, loaded: false, all: false, error: null, before: null };
    emit();
    try {
      const d = await api.messages(chat, { before_seq: NEWEST, limit: PAGE });
      addRows(project, d.messages || []);
      state.hist[project] = { loading: false, loaded: true, all: !d.next_before_seq, error: null, before: d.next_before_seq || null };
    } catch (err) {
      state.hist[project] = { loading: false, loaded: false, all: false, error: err.message, before: null };
    }
    emit();
  }
  /** The page just before the oldest we have: each page is fetched exactly once. */
  async function loadOlder(project) {
    const chat = chatIdOf(project);
    const h = state.hist[project];
    if (!chat || !h || h.all || h.loading || !h.before) return;
    h.loading = true;
    emit();
    try {
      const d = await api.messages(chat, { before_seq: h.before, limit: Math.min(PAGE_MAX, PAGE * 2) });
      addRows(project, d.messages || []);
      h.before = d.next_before_seq || null;
      h.all = !h.before;
      h.olderError = null;
    } catch (err) { h.olderError = err.message; }
    h.loading = false;
    emit();
  }
  /**
   * An open thread: its newest page of messages and its session's recent turns (their blocks), once.
   * Older pages come as you scroll up (loadOlderThread), as a project's chat does.
   */
  async function loadThread(ts) {
    const r = rawThreads.get(ts);
    if (!r) return;
    const th = state.threadHist[ts] || (state.threadHist[ts] = { loading: false, loaded: false, error: null });
    // its turns were pruned while it was off screen: read them again, as far back as its pages go
    if (th.loaded && r.session_id && trimmed.has(r.session_id)) {
      trimmed.delete(r.session_id);
      const oldest = (state.threadMsgs[ts] || [])[0];
      loadTurns(r.session_id).then(() => loadOlderTurns(r.session_id, oldest ? oldest.seq : null)).then(soon);
      return;
    }
    if (th.loading || th.loaded) return;
    th.loading = true;
    soon();
    try {
      const [m] = await Promise.all([
        api.messages(r.chat_id, { thread: ts, before_seq: NEWEST, limit: PAGE }),
        r.session_id ? loadTurns(r.session_id) : null,
      ]);
      const { list } = mergeRows(state.threadMsgs[ts] || [], m.messages || []);
      state.threadMsgs[ts] = list;
      Object.assign(th, pageAfter(th, m), { error: null });
    } catch (err) { th.error = err.message; }
    th.loading = false;
    soon();
  }
  /**
   * The thread's page just before the oldest we hold, and its turns' frames with it, so the page lands
   * once, whole: its messages and the work between them. Each page is fetched exactly once.
   */
  async function loadOlderThread(ts) {
    const r = rawThreads.get(ts);
    const th = state.threadHist[ts];
    if (!r || !canPageOlder(th)) return;
    th.older = true;
    soon();
    try {
      const m = await api.messages(r.chat_id, { thread: ts, before_seq: th.before, limit: Math.min(PAGE_MAX, PAGE * 2) });
      const { list } = mergeRows(state.threadMsgs[ts] || [], m.messages || []);
      if (r.session_id) await loadOlderTurns(r.session_id, list.length ? list[0].seq : null);
      state.threadMsgs[ts] = list;
      Object.assign(th, pageAfter(th, m), { olderError: null });
    } catch (err) { th.olderError = err.message; }
    th.older = false;
    soon();
  }
  /** A session's older stored frames, a page at a time, until they reach `floor` (at most three pages). */
  async function loadOlderTurns(session, floor) {
    for (let i = 0; i < 3 && framesShort(framesBefore.get(session), floor); i++) {
      try {
        const d = await api.events({ session, before_seq: framesBefore.get(session), limit: 500 });
        for (const f of d.events || []) if (f.type !== "thread.control" && f.type !== "thread.continued") state.turns.apply({ type: f.type, envelope: f });
        framesBefore.set(session, d.next_before_seq ?? null);
      } catch { return; /* the messages still land; their work shows when it can be read */ }
    }
  }
  /** A session's stored frames, newest page, so its finished turns show their blocks (UI-reference §1.4). */
  /** A coordinator's control of a thread (F6), once per stored event, in order. */
  function noteControl(env, d) {
    const ts = env.thread_ts || d.thread_ts;
    if (!ts || !d.action) return false;
    const list = state.controls[ts] || (state.controls[ts] = []);
    if (env.seq != null && list.some((c) => c.seq === env.seq)) return false;
    list.push({ ...d, at: env.ts, seq: env.seq ?? null });
    list.sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity));
    return true;
  }
  async function loadTurns(session) {
    try {
      const d = await api.events({ session, before_seq: NEWEST, limit: 500 });
      for (const f of d.events || []) if (f.type !== "thread.control" && f.type !== "thread.continued") state.turns.apply({ type: f.type, envelope: f });
      framesBefore.set(session, d.next_before_seq ?? null);
    } catch { /* live frames still arrive */ }
    // F4, F6: the thread's own control rows and its move, however far back (both stored on its session)
    try {
      const d = await api.events({ session, kinds: "thread.control,thread.continued", before_seq: NEWEST, limit: 500 });
      for (const f of d.events || []) {
        const x = f.data || {};
        if (f.type === "thread.control") noteControl(f, x);
        else if (f.type === "thread.continued" && (x.from || f.thread_ts) && !state.moves[x.from || f.thread_ts]) state.moves[x.from || f.thread_ts] = { ...x, at: f.ts };
      }
    } catch { /* live frames still arrive */ }
  }

  // ── the stream ────────────────────────────────────────────────────────────
  function onFrame(f) {
    firstFrame();
    if (holding) { held.push(f); return; }
    apply(f);
  }
  function apply(f) {
    const env = f.envelope || {};
    const type = f.type;
    const d = env.data || {};
    if (env.seq != null && env.seq > state.lastSeq) state.lastSeq = env.seq;
    const tid = state.turns.apply(f);
    if (type !== "chat" && env.chat_id && !chatProject.has(env.chat_id)) maybeChats(); // a chat we don't know yet (a creation says so itself)
    switch (type) {
      case "message": {
        const row = { ...d, seq: env.seq ?? d.seq ?? null };
        const project = projectOf(row.chat_id || env.chat_id);
        if (row.thread_ts) {
          const { list, added } = mergeRows(state.threadMsgs[row.thread_ts] || [], [row]);
          state.threadMsgs[row.thread_ts] = list;
          if (added.length) soon();
          break;
        }
        if (!project) break;
        const added = addRows(project, [row]);
        if (!added.length) break;
        const aw = state.awaiting[project];
        const reply = row.author_kind !== "owner";
        const answered = !!(aw && reply && COORD.has(row.author_id));
        if (answered) delete state.awaiting[project];
        if (reply && COORD.has(row.author_id)) delete state.failed[project];
        if (reply) event({ kind: "message", project, text: String(row.text || "").slice(0, 160), answered, author: row.author_id });
        emit();
        break;
      }
      case "reaction": {
        // an agent's emoji on a message: onto the row wherever we hold it (its thread, or its timeline)
        const ts = d.thread_ts || env.thread_ts;
        const inThread = ts && addReaction(state.threadMsgs[ts], d, env.ts);
        if (inThread) { state.threadMsgs[ts] = inThread; soon(); break; }
        const project = projectOf(env.chat_id);
        const onTimeline = project && addReaction(state.timeline[project], d, env.ts);
        if (onTimeline) { state.timeline[project] = onTimeline; soon(); }
        break;
      }
      case "message.updated": {
        // a message changed after it was sent: today, the files an agent shared after its turn's last reply,
        // added to that reply's extra.attachments. Applied where we hold the row, like a reaction.
        const ts = d.thread_ts || env.thread_ts;
        const inThread = ts && updateMessage(state.threadMsgs[ts], d);
        if (inThread) { state.threadMsgs[ts] = inThread; soon(); break; }
        const project = projectOf(d.chat_id || env.chat_id);
        const onTimeline = project && updateMessage(state.timeline[project], d);
        if (onTimeline) { state.timeline[project] = onTimeline; soon(); }
        break;
      }
      case "thread": {
        const ts = d.ts;
        if (!ts) break;
        const old = rawThreads.get(ts);
        if (!old && !d.chat_id) { refetchThread(env.chat_id, ts); break; }
        rawThreads.set(ts, { ...(old || {}), ...d, _at: Date.now(), ...("busy" in d ? { _readAt: Date.now() } : {}), chat_id: d.chat_id || (old && old.chat_id) || env.chat_id, updated_at: d.updated_at || env.ts || (old && old.updated_at) });
        soon();
        break;
      }
      case "thread.continued": {
        // the old thread froze and a linked new thread starts from its work (F4, F5)
        const old = d.from || env.thread_ts;
        if (old) { state.moves[old] = { ...d, at: env.ts }; event({ kind: "moved", thread: old, project: projectOf(env.chat_id), to: d.to, agent: d.agent, by: d.by || null }); }
        if (env.chat_id && old) refetchThread(env.chat_id, old);
        if (env.chat_id && d.to && !rawThreads.has(d.to)) refetchThread(env.chat_id, d.to);
        soon();
        break;
      }
      case "thread.control": {
        // a coordinator steered, interrupted or stopped a thread (F6): kept for the thread's timeline
        if (noteControl(env, d)) soon();
        break;
      }
      case "card": {
        const r = rawThreads.get(d.ts);
        if (r) { rawThreads.set(d.ts, { ...r, card: d.card, updated_at: env.ts || r.updated_at }); soon(); }
        break;
      }
      case "session": {
        const id = env.session_id;
        if (!id) break;
        const old = state.sessions[id] || { id };
        const next = { ...old, chat_id: old.chat_id || env.chat_id || null, thread_ts: old.thread_ts || env.thread_ts || null, state: d.status || old.state, seq: env.seq ?? old.seq };
        if (d.reason === "created") Object.assign(next, { role: d.role, agent: d.agent, preset: d.preset });
        if (d.reason === "paused") next.paused = d.why || "paused";
        if (d.reason === "resumed") next.paused = null;
        if (d.reason === "updated") Object.assign(next, { model: d.model ?? old.model, effort: d.effort ?? old.effort, permission_mode: d.permission_mode ?? old.permission_mode });
        if (d.reason === "attached" && d.native_id) next.native_id = d.native_id;
        if (d.reason === "retired") next.retired_at = env.ts || new Date().toISOString();
        // PR 24: an unconfirmed "send now" was added to the running turn instead
        if (d.reason === "now_became_add") event({ kind: "now_became_add", session: id, wakes: d.wakes || [], runs: d.runs || 0 });
        state.sessions[id] = next;
        // a turn for our message ended: "replying" ends with it; a failure is said plainly (#30)
        if (COORD.has(next.role) && !BUSY.has(next.state)) settleAwaiting(next.chat_id);
        soon();
        break;
      }
      case "turn.finished": {
        const t = tid && state.turns.get(tid);
        if (!t) break;
        const project = projectOf(t.chat);
        const aw = project && state.awaiting[project];
        const wake = aw && `msg:${aw.id}`;
        const mine = aw && (t.wakes || []).includes(wake);
        const requeued = (d.wakes_requeued || []).includes(wake);
        // "interrupted" (a restart) puts the wake back: the coordinator still answers, so we keep waiting
        if (mine && d.status === "failed" && !requeued) {
          state.failed[project] = { at: Date.now(), error: d.error || d.reason || d.stop_reason || "the turn failed", id: aw.id };
          delete state.awaiting[project];
          event({ kind: "coord_failed", project, text: state.failed[project].error });
        }
        soon();
        break;
      }
      case "hop": {
        // creation: the hop without its note; a state move: {id, state}
        const old = state.hops.get(d.id);
        if (old || d.kind) { state.hops.set(d.id, { ...(old || {}), ...d, seq: (old && old.seq) ?? env.seq ?? null, at: (old && old.at) || env.ts }); emitSoon(); }
        // the open thread shows what its hops say: read the new one's note
        if (d.kind && d.thread_ts && d.thread_ts === watched.thread) hopsSoon(d.thread_ts);
        break;
      }
      case "chat": {
        // a creation carries `kind` (UI-reference §4.10): add it from the event, no re-listing
        if (d.kind) {
          if (!chatProject.has(d.id)) {
            const id = d.kind === "workspace" ? "workspace" : d.project;
            chatProject.set(d.id, id);
            if (!state.projects.some((p) => p.chatId === d.id)) state.projects.push({ id, name: d.kind === "workspace" ? "Workspace" : d.project, kind: d.kind, chatId: d.id, routing: null, pin: { agent: null, model: null, effort: null }, hasChat: true });
            soon();
          }
          break;
        }
        if (d.retired_at) { loadChats(); break; }
        const p = state.projects.find((x) => x.chatId === d.id);
        if (p) { for (const k of ["routing", "agent", "model", "effort"]) if (k in d) { if (k === "routing") p.routing = d.routing; else p.pin = { ...(p.pin || {}), [k]: d[k] }; } }
        emit();
        break;
      }
      case "settings":
        if (d.key === "router") { state.router = d.value; emit(); }
        // the person's shape changed on a device (this one's own write echoes too): the shape store decides
        else if (d.key === "ui.shape") event({ kind: "shape", value: d.value ?? null });
        break;
      case "pool":
        if (d.pool) {
          const fresh = !(d.pool in state.pools);
          state.pools[d.pool] = { ...(state.pools[d.pool] || {}), ...d };
          if (poolsSeen && fresh) refreshRuntimes();
          emit();
        }
        break;
      case "run.started": {
        const i = d.info || {};
        state.runs.set(d.run_id, { ...(state.runs.get(d.run_id) || {}), id: d.run_id, session: env.session_id, parent: d.parent_run_id || null, state: d.state || "running", title: i.title || i.agent_type || "Sub-agent", kind: i.kind || "subagent", background: !!i.background, depth: i.depth || 1, model: i.model || null, spawn: i.spawn_call_id || null, started_at: env.ts, hidden: !!i.hidden, seen: Date.now() });
        soon(); // a sub-agent at work keeps its thread Working after the turn: the threads are rebuilt
        break;
      }
      case "run.state": {
        const r = state.runs.get(d.run_id);
        if (r) { state.runs.set(d.run_id, { ...r, state: d.state || r.state, stopping: !!d.stop_requested_at, background: d.background ?? r.background, seen: Date.now() }); soon(); }
        break;
      }
      case "run.finished": {
        const r = state.runs.get(d.run_id) || { id: d.run_id, session: env.session_id, title: "Sub-agent", kind: "subagent" };
        state.runs.set(d.run_id, { ...r, state: d.state || "finished", status: d.status, summary: d.summary || null, tokens: d.tokens ?? r.tokens, tool_calls: d.tool_calls ?? r.tool_calls, last_tool: d.last_tool ?? r.last_tool, stopped_by: d.stopped_by || null, ended_at: env.ts || new Date().toISOString(), seen: Date.now() });
        soon();
        break;
      }
      case "runs": {
        if (d.session) { state.liveRuns[d.session] = { running: d.running || 0, waiting: d.waiting || 0, tokens: d.tokens || 0, at: Date.now() }; soon(); }
        break;
      }
      case "review.opened":
        state.review.set(d.id, { ...d, state: "open", seq: env.seq ?? null });
        soon();
        break;
      case "review.decided": case "review.withdrawn": case "review.expired":
        state.review.delete(d.id);
        soon();
        break;
      case "review.parked": {
        const it = state.review.get(d.id);
        if (it) { state.review.set(d.id, { ...it, parked: true, expires_at: d.expires_at || it.expires_at }); soon(); }
        break;
      }
      case "review.annotated": {
        const it = state.review.get(d.id);
        if (it) { state.review.set(d.id, { ...it, annotations: [...(it.annotations || []), d] }); soon(); }
        break;
      }
      default:
        if (tid) emitSoon(); // a block or turn frame: re-render, no need to rebuild the threads
    }
  }
  const refetchBusy = new Set();
  async function refetchThread(chatId, ts) {
    if (!chatId || refetchBusy.has(ts)) return;
    refetchBusy.add(ts);
    try { rawThreads.set(ts, { ...(await api.thread(chatId, ts)), _readAt: Date.now() }); soon(); } catch { /* the next full frame fills it */ }
    refetchBusy.delete(ts);
  }
  function settleAwaiting(chatId) {
    const project = projectOf(chatId);
    if (!project || !state.awaiting[project]) return;
    // the coordinator went quiet; if it answered, the message frame already cleared this
    const aw = state.awaiting[project];
    if (Date.now() - aw.at > 1500) { delete state.awaiting[project]; soon(); }
  }

  async function reload() {
    // a reset for retention or a replaced store: start again from the server's state. The thread
    // list is refreshed in place (no false "new thread" lines); what's on screen loads again.
    state.timeline = {}; state.hist = {}; state.threadMsgs = {}; state.threadHist = {}; state.found = {}; framesBefore.clear();
    sought.clear();
    state.review.clear(); state.routed = {}; state.turns = createTurns();
    await loadAll();
    for (const [ts, r] of rawThreads) if (!chatProject.has(r.chat_id)) rawThreads.delete(ts);
    await Promise.all([...watched.projects].map((p) => loadTimeline(p)));
    if (watched.thread) await loadThread(watched.thread);
    commit(); emit();
  }

  function startStream() {
    stream = new SSEStream(api.streamUrl(), {
      headers: coderHeaders,
      onFrame,
      onState: (s, info) => {
        state.conn = s; state.connInfo = info;
        if (s === "live" && state.loaded) { loadStatus(); if (state.error || !state.projects.length) recover(); }
        emit();
      },
      onReset: async () => { await reload(); },
    }).start();
  }

  async function boot() {
    startStream();
    // the subscription is in place once its first frame (the snapshot) arrives; frames from then on
    // are held during the load, so nothing that changes while it runs is lost or reverted
    await Promise.race([sawFrame, new Promise((r) => setTimeout(r, 4000))]);
    await Promise.all([loadAll(), loadStatus()]);
    commit();
    holding = false;
    for (const f of held.splice(0)) apply(f);
    commit();
    state.loaded = true;
    emit();
  }
  boot();
  setInterval(() => {
    const keep = new Set();
    const t = watched.thread && rawThreads.get(watched.thread);
    if (t && t.session_id) keep.add(t.session_id);
    if (watched.session) keep.add(watched.session); // an open plain chat keeps its turns
    for (const sid of state.turns.prune(keep)) trimmed.add(sid);
    // sub-agents: keep every live one and the open thread's; the rest only up to a bounded log
    const ended = [...state.runs.values()].filter((r) => !["running", "waiting"].includes(r.state) && !keep.has(r.session));
    if (ended.length > RUNS_KEEP) for (const r of ended.sort((a, b) => String(a.ended_at || "").localeCompare(String(b.ended_at || ""))).slice(0, ended.length - RUNS_KEEP)) state.runs.delete(r.id);
  }, 60000);
  addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    stream && stream.nudge();
    loadStatus();
    maybeChats();
  });
  addEventListener("online", () => stream && stream.nudge());

  // ── acting (writes happen only here, only when the person acts) ────────────
  async function post(project, text, { threadTs, cid, attachments } = {}) {
    const chat = chatIdOf(project);
    if (!chat) throw Object.assign(new Error(`No chat for ${project}`), { code: "no_chat" });
    const row = await api.post(chat, { text, threadTs, clientId: cid, attachments });
    event({ kind: "you", thread: threadTs || null, project, text });
    return row;
  }
  const threadOf = (id) => rawThreads.get(id) || null;
  async function loadThreadHops(ts) {
    const r = rawThreads.get(ts);
    if (!r) return;
    try { const d = await api.hops(r.chat_id, { thread: ts, before_seq: NEWEST, limit: 200 }); for (const h of d.hops || []) state.hops.set(h.id, { ...(state.hops.get(h.id) || {}), ...h, at: h.created_at }); emitSoon(); } catch { /* the stream's hops still arrive */ }
  }
  // a burst of hops (a relay and its state moves) is one read
  let hopsT = 0;
  const hopsSoon = (ts) => { clearTimeout(hopsT); hopsT = setTimeout(() => loadThreadHops(ts), 400); };
  const sought = new Set(); // findRows: "project|id@hint" already looked for
  const hopsRead = new Set(); // loadChatHops: the chats whose hops were read
  const threadHopsRead = new Set(); // threads whose hops were read once; the stream keeps them current after
  /**
   * Rows named by id that aren't loaded (a message relayed into a thread, a thread's root). There's no read by
   * id, so this pages back from each one's hint (the seq it lies just below), but as ONE walk per project for
   * everything asked in the same moment: small pages (50), one at a time, newest hint first, jumping down to
   * the next hint, stopping when all are found or after 6 pages. What it finds goes to state.found, never the
   * visible timeline. (It used to start a 5 × 200-row search per relayed message, all at once and overlapping:
   * 13 requests and 2.4 MB on opening one thread, and the project's conversation grew from 45 to 402 rows.)
   */
  const wanted = new Map(); // project → Map(id → hint seq | null)
  let findT = 0;
  function findRows(project, ids, beforeSeq) {
    let q = wanted.get(project);
    for (const id of ids) {
      if ((state.timeline[project] || []).some((r) => r.id === id) || state.found[project]?.has(id)) continue;
      const key = `${project}|${id}@${beforeSeq ?? ""}`;
      if (sought.has(key)) continue;
      sought.add(key);
      if (!q) wanted.set(project, (q = new Map()));
      q.set(id, beforeSeq ?? null);
    }
    if (q && q.size && !findT) findT = setTimeout(walkFound, 0);
  }
  async function walkFound() {
    findT = 0;
    const jobs = [...wanted]; wanted.clear();
    await Promise.all(jobs.map(async ([project, q]) => {
      const chat = chatIdOf(project);
      if (!chat) return;
      const map = state.found[project] || (state.found[project] = new Map());
      let floor = Infinity; // nothing at or above this seq is left to read
      for (let page = 0; page < 6 && q.size; page++) {
        const top = Math.max(...[...q.values()].map((s) => (s == null ? Infinity : s)));
        const from = Math.min(top === Infinity ? Infinity : top + 1, floor);
        let d;
        try { d = await api.messages(chat, { before_seq: from === Infinity ? NEWEST : from, limit: 50 }); } catch { return; }
        const rows = d.messages || [];
        for (const r of rows) { map.set(r.id, r); q.delete(r.id); }
        if (!rows.length || !d.next_before_seq) break;
        floor = Math.min(...rows.map((r) => r.seq));
        for (const [id, s] of q) if (s == null || s >= floor) q.set(id, floor - 1);
      }
    }));
    emitSoon();
  }

  return {
    act: {
      live: true,
      storm: true,
      /** A reply inside a thread: straight to its agent (a resolved or paused thread goes back to working). */
      reply: async (threadId, text, { clientId: cid = newClientId(), attachments } = {}) => {
        const r = threadOf(threadId);
        if (!r) throw new Error("Unknown thread");
        const project = projectOf(r.chat_id);
        const row = await post(project, text, { threadTs: threadId, cid, attachments });
        if (row) {
          const { list } = mergeRows(state.threadMsgs[threadId] || [], [row]);
          state.threadMsgs[threadId] = list;
        }
        soon();
        return row || null;
      },
      /** A message to a timeline (the Workspace or a project): its router decides what happens. */
      ask: async (projectId, text, { clientId: cid = newClientId(), attachments } = {}) => {
        const project = projectId || "workspace";
        const row = await post(project, text, { cid, attachments });
        if (row) {
          addRows(project, [row]);
          state.awaiting[project] = { id: row.id, at: Date.now() };
          delete state.failed[project];
        }
        emit();
        return row || null;
      },
      /** Resolve or reopen (R1): idempotent, so Undo is the same call the other way. */
      resolve: async (threadId, resolved = true) => {
        const r = threadOf(threadId);
        if (!r) throw new Error("Unknown thread");
        const before = { state: r.state, resolved_at: r.resolved_at };
        rawThreads.set(threadId, { ...r, state: resolved ? "resolved" : "working", resolved_at: resolved ? new Date().toISOString() : null });
        soon();
        try {
          const t = await api.patchThread(r.chat_id, threadId, { resolved });
          rawThreads.set(threadId, { ...rawThreads.get(threadId), ...t, ...(t && "busy" in t ? { _readAt: Date.now() } : {}) });
          soon();
          return t;
        } catch (err) {
          rawThreads.set(threadId, { ...rawThreads.get(threadId), ...before });
          soon();
          throw err;
        }
      },
      /** Rename (1..120) or label (≤32; null clears). */
      editThread: async (threadId, change) => {
        const r = threadOf(threadId);
        if (!r) throw new Error("Unknown thread");
        const t = await api.patchThread(r.chat_id, threadId, change);
        rawThreads.set(threadId, { ...rawThreads.get(threadId), ...t, ...(t && "busy" in t ? { _readAt: Date.now() } : {}) });
        soon();
        return t;
      },
      decide: () => Promise.reject(new Error("Decide a storm item with decideItem.")),
      /**
       * The person's decision on a review item (UI-reference §2.4): the only writer of an owner
       * decision. The idempotency key makes a retry harmless. A refusal is never reported as made:
       * the item is read again (§4.3 #7), so the caller can say what happened instead: decided
       * elsewhere (and how), withdrawn, expired (the agent was told), or a fresh copy to answer again.
       */
      decideItem: async (id, body) => {
        try {
          const it = await api.decide(id, { ...body, idempotency_key: body.idempotency_key || newClientId() });
          if (it && it.state && it.state !== "open") { state.review.delete(id); soon(); }
          return it;
        } catch (err) {
          if (!err.status) throw err; // never reached XO: the item is as it was
          let now = null;
          try { now = await api.reviewItem(id); } catch { /* gone, or unreadable: the code says enough */ }
          const gone = err.code === "already_decided" || err.code === "withdrawn" || err.code === "expired" || err.code === "review_not_found" || !!(now && now.state && now.state !== "open");
          if (gone) state.review.delete(id);
          else if (now) state.review.set(id, { ...(state.review.get(id) || {}), ...now });
          soon();
          err.item = now;
          if (gone) err.gone = err.code || (now && now.state) || "gone";
          throw err;
        }
      },
      /** Read one thread now (a new one the stream hasn't brought yet), so the view can open it. */
      fetchThread: async (chatId, ts) => { await refetchThread(chatId, ts); commit(); emit(); return state.threads.find((t) => t.id === ts) || null; },
      /** The open thread's project timeline: the root message of a continued thread says where it came from. */
      loadTimeline: (project) => loadTimeline(project),
      /** The runtime policy in effect for a project (its own over the Space's), or null before it is read. */
      policyFor: (project) => {
        const chat = chatIdOf(project);
        return (chat && state.chatPolicy[chat] && state.chatPolicy[chat].effective) || (state.policy && state.policy.effective) || null;
      },
      loadPolicies,
      /** Read the runtimes again now (Settings › Runtimes asks every 30 s while it is open). */
      loadRuntimes: () => { refreshRuntimes(); return runtimesBusy; },
      /** Replace the Space's runtime policy, or a project's (chat) override; the answer is kept. */
      setPolicy: async (chat, policy) => {
        if (!chat) { state.policy = await api.setRuntimePolicy(policy); for (const c of Object.keys(state.chatPolicy)) { try { state.chatPolicy[c] = await api.chatRuntimePolicy(c); } catch { /* keep */ } } }
        else state.chatPolicy[chat] = await api.setChatRuntimePolicy(chat, policy);
        emit();
        return chat ? state.chatPolicy[chat] : state.policy;
      },
      refresh: async () => { await loadChats(); await mapLimit(state.projects.filter((p) => p.kind === "project"), LOAD_CAP, loadThreads); commit(); emit(); },
      /** The open conversations: load their timelines once; the stream keeps them current. */
      watch: (projects) => { watched.projects = new Set((projects || []).filter(Boolean)); for (const p of watched.projects) loadTimeline(p); },
      watchThread: (ts) => { watched.thread = ts || null; if (ts) loadThread(ts); },
      /** An open plain chat: its session's turns are never pruned while it is on screen. */
      watchSession: (sid) => { watched.session = sid || null; },
      /** Were this session's older turns pruned? (then read them again; asking clears it) */
      takeTrimmed: (sid) => trimmed.delete(sid),
      loadOlder,
      /** A thread's next older page of messages, with its turns. */
      loadOlderThread,
      replying: (project) => {
        const aw = state.awaiting[project];
        if (aw && Date.now() - aw.at > AWAIT_CAP_MS) delete state.awaiting[project];
        if (state.awaiting[project]) return true;
        const chat = chatIdOf(project);
        return Object.values(state.sessions).some((s) => s.chat_id === chat && COORD.has(s.role) && !s.retired_at && BUSY.has(s.state));
      },
      /** What the coordinator is doing now: its running turn's latest block header, for the typing line. */
      doing: (project) => {
        const chat = chatIdOf(project);
        const s = Object.values(state.sessions).find((x) => x.chat_id === chat && COORD.has(x.role) && !x.retired_at && BUSY.has(x.state));
        const t = s && state.turns.running(s.id);
        if (!t) return null;
        const bl = state.turns.blocksOf(t);
        const last = bl[bl.length - 1];
        return last ? (last.header || (last.type === "text" ? "Writing" : null)) : null;
      },
      /** A session's runs as a tree (the live list and the log), with counts (UI-reference §2.6). */
      listRuns: async (session) => {
        const d = await api.runs(session, { tree: "true", depth: 3, limit: 200 });
        const walk = (nodes) => { for (const n of nodes || []) { state.runs.set(n.id, { ...(state.runs.get(n.id) || {}), id: n.id, session, parent: n.parent_run_id || null, state: n.state, title: n.title || n.agent_type || "Sub-agent", kind: n.kind, background: !!n.background, depth: n.depth, spawn: n.spawn_call_id || null, started_at: n.started_at, ended_at: n.ended_at, summary: n.summary, tokens: n.tokens, tool_calls: n.tool_calls, last_tool: n.last_tool, can_stop: n.can_stop, seen: Date.now() }); walk(n.children); } };
        walk(d.runs);
        soon();
        return d;
      },
      run: (id) => api.run(id),
      transcript: (id, after) => api.transcript(id, after ? { after, limit: 200 } : { limit: 200 }),
      stopRun: (id) => api.stopRun(id),
      stopRuns: (session) => api.stopRuns(session),
      /** What a session's runtime offers (its feature list), e.g. "runs.stop" — never decided by agent name. */
      feature: (session, key) => {
        const s = state.sessions[session];
        const rt = (state.runtimes || []).find((r) => r.name === (s && s.agent)) || mainRuntime(state.runtimes);
        const f = rt && rt.features && rt.features.features && rt.features.features[key];
        return !!f && (f.support === "native" || f.support === "emulated");
      },
      /** Stop a session's running turn and its sub-agents now (the 3 s Undo is the caller's, sedc 09 #1). */
      stop: (sessionId) => api.abort(sessionId),
      /** The id of a session's running turn, or null; and the session's own state. */
      turnOf: (sessionId) => { const t = state.turns.running(sessionId); return t ? t.id : null; },
      sessionState: (sessionId) => (state.sessions[sessionId] || {}).state || null,
      /** Is a session's agent at work: on a turn, or a sub-agent working on after it? Never while it waits on you. */
      sessionBusy: (sessionId) => {
        const s = state.sessions[sessionId];
        return !!s && sessionBusy(s, { runs: [...state.runs.values()].filter((r) => r.session === sessionId), agg: state.liveRuns[sessionId] || null });
      },
      /** The agent a chat's coordinator runs on (its newest live session), if known. */
      coordinatorAgent: (chatId) => {
        const s = Object.values(state.sessions).filter((x) => x.chat_id === chatId && COORD.has(x.role) && !x.retired_at).sort((a, b) => (b.seq || 0) - (a.seq || 0))[0];
        return (s && s.agent) || null;
      },
      /** The coordinator session of a chat that is working now, if any. */
      coordinatorBusy: (project) => {
        const chat = chatIdOf(project);
        const s = Object.values(state.sessions).find((x) => x.chat_id === chat && COORD.has(x.role) && !x.retired_at && BUSY.has(x.state));
        return s ? s.id : null;
      },
      /** A thread's hops (how messages travelled to and from it, and what they said), read when it's opened. */
      // once per thread per page: after that the stream's hops (and hopsSoon's re-read on a relay) keep it current
      loadHops: (ts) => { if (threadHopsRead.has(ts)) return; threadHopsRead.add(ts); loadThreadHops(ts); },
      /**
       * A Workspace or project chat's own hops, for "Show hops" on its timeline: the ones no thread
       * holds (a coordinator acting on its own), and the forward and answer when its work went on to
       * another project. Read once per chat; the stream's hops keep them current.
       */
      loadChatHops: async (project) => {
        const chat = chatIdOf(project);
        if (!chat || hopsRead.has(chat)) return;
        hopsRead.add(chat);
        try { const d = await api.hops(chat, { before_seq: NEWEST, limit: 500 }); for (const h of d.hops || []) state.hops.set(h.id, { ...(state.hops.get(h.id) || {}), ...h, at: h.created_at }); emitSoon(); } catch { hopsRead.delete(chat); }
      },
      /** The chat id of a project ("workspace" for the Workspace), for its attachments. */
      chatId: (project) => chatIdOf(project),
      /** The project a chat id belongs to. */
      projectOf: (chat) => projectOf(chat),
      /**
       * Timeline rows named by id that aren't loaded yet (a message relayed into a thread, if1 #7).
       * There's no read by id, so this pages back from `beforeSeq` (the hop's seq bounds them from
       * above), at most a few pages, and adds what it finds to the project's timeline. Each
       * (project, ids) is tried once; what isn't found stays unknown, never guessed.
       */
      findRows,
      /** A session's recent turns, read from its stored frames (a plain chat's work, a thread's). */
      loadTurns: async (sid) => { await loadTurns(sid); emitSoon(); },
      status: loadStatus,
      chatIdOf,
      projectOf,
    },
    stop: () => { stream && stream.close(); clearTimeout(statusT); clearTimeout(runtimesT); },
  };
}
