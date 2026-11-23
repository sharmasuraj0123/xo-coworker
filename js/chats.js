import { api, clientId, NEWEST } from "../core/platform/api.js";
import { esc } from "./world.js";
import { once } from "../core/platform/index.js";
import { ICON, stateMark, xi } from "./ui.js";
import { EFFORT_WORD } from "../modules/chats/effort.js";
import { renderMarkdown } from "./markdown.js";
import { turnHtml, turnAv } from "./turnview.js";
import { cliName, mainRuntime, chatOrder, BUSY_STATES, heldShort, heldBadge, dayGroup, rowTime } from "./timeline.js";
import { rtMark, rtName } from "../core/services/runtimes.js";
import { createSetup, MODE_WORDS, store } from "../modules/chats/setup.js";
import { chatListItems } from "../modules/chats/list.js";

const BUSY = new Set([...BUSY_STATES, "waiting_on_person"]);
export function createChats({ world, announce, heraldShow, go, schedule, view, restore }) {
  // confirm: one "send now" question per chat (session id → {local, count}), shown only in that chat
  const C = { list: null, loading: false, err: null, titles: new Map(), hist: new Map(), local: new Map(), prefs: { ...store.get() }, models: new Map(), read: new Set(), failed: new Map(), pop: { open: false }, confirm: new Map(), q: "", all: false };

  const sessions = () => Object.values(world.state.sessions || {}).filter((s) => s.role === "plain" && !s.retired_at);
  const session = (sid) => (world.state.sessions || {})[sid] || null;
  const runtime = (name) => (world.state.runtimes || []).find((r) => r.name === name) || (!name ? mainRuntime(world.state.runtimes) : null) || null;
  const feature = (rt, key) => (rt && rt.features && rt.features.features && rt.features.features[key]) || null;
  const offers = (rt, key) => { const f = feature(rt, key); return !!f && (f.support === "native" || f.support === "emulated"); };

  const { setup, effortsFor, ensureModels, openSetup, closeSetup, setPref, renderSetup, toggleSetup } = createSetup(C, { world, schedule, runtime, feature, cliName });

  async function loadList() {
    if (C.loading) return;
    C.loading = true;
    try {
      // the read stands where it was sent in the stream's order, so a status frame that lands meanwhile stays
      const sent = world.act.sentAt();
      const d = await api.sessions({ role: "plain", before_seq: NEWEST, limit: 100 });
      for (const s of d.sessions || []) world.act.noteSession(s, sent);
      C.list = true; C.err = null;
      for (const a of new Set(sessions().map((x) => x.agent).filter(Boolean))) ensureModels(a);
      // titles: the first thing you asked, read from the chat's own history (a few at a time)
      const todo = sessions().filter((s) => s.native_id && !C.titles.has(s.id)).slice(0, 24);
      await Promise.all(todo.map((s) => titleOf(s)));
    } catch (err) { C.err = err.message; }
    C.loading = false;
    schedule();
  }
  async function titleOf(s) {
    C.titles.set(s.id, null);
    try {
      const d = await api.observedMessages(s.native_id, { offset: 0, limit: 5 });
      const first = (d.messages || []).find((m) => m.data && m.data.role === "user");
      const text = first ? (first.parts || []).map((p) => (p.data && p.data.type === "text" ? p.data.text : "")).join(" ").trim() : "";
      C.titles.set(s.id, text ? text.replace(/\s+/g, " ").slice(0, 120) : null);
    } catch { /* stays untitled */ }
  }
  const titleFor = (s) => C.titles.get(s.id) || `A chat in ${folderWord(s.cwd)}`;
  // no folder means the projects folder (storm's default for a plain chat)
  const folderWord = (cwd) => (!cwd ? "your projects folder" : cwd.replace(/^\/home\/[^/]+\/?/, "~/").replace(/^~\/$/, "~"));
  const capFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const modelWord = (agent, id) => { const m = (C.models.get(agent) || []).find((x) => x.id === id); return m ? m.name : id; };
  const agentMark = (agent, lead = true) => rtMark(agent, { lead }) || `${esc(cliName(agent))}${lead ? " " : ""}`;
  /** A chat's header line: folder · the agent's mark beside its model · effort · mode. */
  const isHome = (cwd) => !cwd || /^\/home\/[^/]+\/?$/.test(cwd);
  const metaHtml = (s) => [`${agentMark(s.agent)}${esc(s.model ? modelWord(s.agent, s.model) : "Default model")}`, s.effort ? esc(EFFORT_WORD[s.effort] || s.effort) : "",
    esc((MODE_WORDS[s.permission_mode] || [s.permission_mode || ""])[0]), isHome(s.cwd) ? "" : `in ${esc(folderWord(s.cwd))}`].filter(Boolean).join(" · ");
  /** What search matches besides the title: only what isn't a new chat's default (model, effort, mode, folder). */
  const rowLine = (s) => {
    const home = isHome(s.cwd);
    return [s.model ? modelWord(s.agent, s.model) : "", s.effort ? EFFORT_WORD[s.effort] || s.effort : "",
      s.permission_mode && s.permission_mode !== "auto" ? (MODE_WORDS[s.permission_mode] || [s.permission_mode])[0] : "", home ? "" : `in ${folderWord(s.cwd)}`].filter(Boolean).join(" · ");
  };
  const waiting = (s) => s.state === "waiting_on_person";
  /** What a gate holds this chat for (the usage limit…), or null: it waits, nothing runs. */
  const heldOf = (s) => (s && s.state === "queued" && world.act.sessionHeld ? world.act.sessionHeld(s.id) : null);
  /** A turn in progress: its status says so, or it says queued and the stream has seen it work since. */
  const inTurn = (s) => !!s && (BUSY.has(s.state) || (s.state === "queued" && !!(world.act.onTurn && world.act.onTurn(s.id))));

  async function loadChat(sid) {
    const h = C.hist.get(sid) || { loading: false, loaded: false, user: [], error: null, turns: false };
    C.hist.set(sid, h);
    if (h.loading) { h.again = true; return; }
    h.loading = true; schedule();
    try {
      let s = session(sid);
      if (s && s.agent) ensureModels(s.agent); // model names in words in the header
      if (!s || !s.native_id || s.cwd === undefined) {
        const sent = world.act.sentAt(); // as the list's read: it stands where it was sent
        const full = await api.session(sid).catch(() => null);
        if (full) { world.act.noteSession(full, sent); s = session(sid); }
      }
      if (!s) throw new Error("This chat isn't here any more.");
      const trimmed = world.act.takeTrimmed ? world.act.takeTrimmed(sid) : false;
      h.tried = s.native_id || null; // tried once for this id, whatever the answer
      const [m] = await Promise.all([
        // whole: observation pages only from an offset, oldest first, so a limit would drop the newest prompts
        s.native_id ? api.observedMessages(s.native_id) : null,
        (!h.turns || trimmed) && world.act.loadTurns ? world.act.loadTurns(sid) : null,
      ]);
      h.turns = true;
      if (m) {
        h.user = (m.messages || []).filter((x) => x.data && x.data.role === "user").map((x) => ({ id: x.id, at: Date.parse(x.time_created) || 0, text: (x.parts || []).map((p) => (p.data && p.data.type === "text" ? p.data.text : "")).join("\n").trim() })).filter((x) => x.text);
        h.loaded = true;
        if (!C.titles.get(sid) && h.user[0]) C.titles.set(sid, h.user[0].text.replace(/\s+/g, " ").slice(0, 120));
      }
      h.error = null;
    } catch (err) { h.error = err.message; }
    h.loading = false; schedule();
    if (h.again) { h.again = false; loadChat(sid); }
  }
  // a turn that starts in the open chat may carry a prompt sent from elsewhere: read the history again
  const turnCount = new Map();
  if (world.subscribe) world.subscribe(() => {
    // a "send now" chosen for a turn ends with that turn, wherever you are when it ends
    if (C.now && !inTurn(session(C.now))) C.now = null;
    const v = view && view();
    if (!v || !v.startsWith("c:")) return;
    const sid = v.slice(2);
    const n = world.state.turns ? world.state.turns.list((t) => t.session === sid).length : 0;
    const before = turnCount.get(sid);
    turnCount.set(sid, n);
    if (before != null && n > before) setTimeout(() => loadChat(sid), 1500);
    const s = session(sid), h = C.hist.get(sid);
    if (s && s.native_id && h && !h.loaded && !h.loading && h.tried !== s.native_id) loadChat(sid);
  });
  function chatItems(sid) {
    const s = session(sid);
    if (!s) return [{ key: "chat-gone", html: `<p class="m-note">This chat isn't here any more.</p>` }];
    const h = C.hist.get(sid) || {};
    const items = [];
    const mine = [...(h.user || [])];
    // your prompts sent from this tab and not in its history yet
    for (const l of C.local.get(sid) || []) if (!mine.some((m) => m.text === l.text && Math.abs(m.at - l.at) < 120000)) mine.push(l);
    const turns = world.state.turns ? world.state.turns.list((t) => t.session === sid) : [];
    // each turn right under the prompt that woke it, whenever the CLI got round to writing that down
    const all = chatOrder(mine, turns);
    if (h.loading && !all.length) items.push({ key: "chat-load", html: `<p class="m-note">Reading the chat…</p>` });
    if (h.error) items.push({ key: "chat-err", html: `<p class="m-note">Couldn't read its history: ${esc(h.error)}</p>` });
    for (const x of all) {
      if (x.kind === "you") {
        const m = x.m;
        const meta = m.status === "sending" ? `<div class="meta"><i class="spin" aria-hidden="true"></i>Sending</div>`
          : m.status === "held" ? `<div class="meta is-warn"><span>Waiting for your choice below</span></div>`
          : m.status === "failed" ? `<div class="meta is-err"><span title="${esc(m.err || "")}">${esc(m.errTitle || "Not sent")}</span><button type="button" class="meta-btn" data-chat-retry="${esc(m.id)}">${ICON.retry}Retry</button><button type="button" class="meta-btn" data-chat-edit="${esc(m.id)}">${ICON.edit}Edit</button></div>`
          : m.added ? `<div class="meta"><span>Added to the turn in progress, not sent now</span>${inTurn(s) ? `<button type="button" class="meta-btn" data-chat-stop>${ICON.stop}Stop the turn</button>` : ""}</div>` : "";
        items.push({ key: `u:${m.id}`, html: `<div class="m m-you${m.status === "failed" ? " is-failed" : ""}"><div class="bubble">${esc(m.text)}</div>${meta}</div>` });
      } else {
        const inner = turnHtml(x.t, world.state.turns.blocksOf(x.t), { open: world.ui ? world.ui.tbOpen : {} });
        if (inner) items.push({ key: `turn:${x.t.id}`, html: `<div class="m m-them m-turn">${x.t.status === "running" ? turnAv(x.t, world.state.turns.blocksOf(x.t)) : `<div class="av av-t">${rtMark(s.agent) || ICON.thread}</div>`}<div class="mb">${inner}</div></div>` });
      }
    }
    if (!all.length && !h.loading && !h.error) items.push({ key: "chat-empty", html: `<p class="m-note">Nothing here yet.</p>` });
    return items;
  }
  function headHtml(v) {
    if (v === "chats") return `<span class="tw-ic" aria-hidden="true">${ICON.thread}</span><span class="tw-t"><h1 id="conv-title">Chats</h1></span>`;
    const s = session(v.slice(2));
    if (!s) return `<span class="tw-t"><h1 id="conv-title">Chat</h1></span>`;
    const busy = inTurn(s), wait = waiting(s), held = !busy && !wait ? heldOf(s) : null;
    const st = s.retired_at ? ["resolved", "done", "Ended"] : wait ? ["needs_approval", "needs_approval", "Needs you"] : busy ? ["working", "working", "Working"] : held ? ["paused", "paused", heldBadge(held)] : ["resolved", "idle", "Waiting"];
    return `<span class="tw-t"><h1 id="conv-title">${esc(titleFor(s))}</h1><span class="pj-s">${metaHtml(s)}</span></span>` +
      `<span class="badge st-${st[0]}">${stateMark(st[1])}${st[2]}</span>`;
  }

  function targetHtml(v) {
    if (v === "chats") {
      const st = setup();
      if (!st.agent) return `<span class="tg-warn">${ICON.pause}</span><span>No agent can chat here yet</span>`;
      ensureModels(st.agent);
      return `${ICON.folder}<span>${esc(capFirst(folderName(st.cwd).replace(/^your /, "")))}</span>`;
    }
    const s = session(v.slice(2));
    if (!s) return "";
    // neutral, not amber: nothing waits on you, and nothing resumes
    if (s.retired_at) return `<span class="tg-end">${ICON.stop}</span><span>Ended. Start a new one from Chats.</span>`;
    if (inTurn(s)) {
      const rt = runtime(s.agent);
      const steer = (feature(rt, "send_while_running") || {}).behaviour === "steered";
      if (C.now === s.id) return `<span class="tg-t tg-now-on">${ICON.bolt}</span><span>Sends now: <b>stops the turn in progress</b></span>`;
      return `<span class="tg-t">${ICON.thread}</span><span>${steer ? "Adds to the turn in progress" : "Waits for the turn in progress"}</span>`;
    }
    // held back by a gate: a reply waits with what's already waiting, and runs with it
    if (heldOf(s)) return `<span class="tg-t">${ICON.thread}</span><span>Reply in <b>this chat</b> · it runs with the waiting message</span>`;
    return ""; // the box's own "Reply in this chat…" says it
  }

  const folderName = (cwd) => (cwd ? (world.project(cwd) || {}).name || cwd : "your projects folder");
  /** The new chat's chip, as every composer's: the agent's mark, its model (Default until one is picked) and its thinking. */
  /** An open chat's own agent, model, thinking and mode, as the new chat's chips show them (fixed: set when it started). */
  const ownOf = (v) => { const s = v && v.startsWith("c:") ? session(v.slice(2)) : null; return s && s.agent ? { agent: s.agent, model: s.model || null, effort: s.effort || null, mode: s.permission_mode || null, cwd: s.cwd } : null; };
  function chipHtml(v) {
    const own = ownOf(v);
    if (v !== "chats" && !own) return "";
    const st = own || setup();
    if (!st.agent) return "";
    const sep = `<span class="iq-sep" aria-hidden="true">·</span>`;
    const effort = own ? st.effort : st.effort && effortsFor(st).includes(st.effort) ? st.effort : null;
    return `<span class="iq-l">${rtMark(st.agent, { lead: true }) || ""}${st.model ? `<span class="iq-t">${esc(modelWord(st.agent, st.model))}</span>` : `<span class="iq-a">Default</span>`}${effort ? `${sep}<span class="iq-e">${esc(EFFORT_WORD[effort] || effort)}</span>` : ""}</span>`;
  }
  function permHtml(v) {
    const own = ownOf(v);
    if (v !== "chats" && !own) return "";
    const st = own || setup();
    return st.agent && st.mode ? `${xi(MODE_WORDS[st.mode]?.[2] || "lock")}<span>${esc((MODE_WORDS[st.mode] || [st.mode])[0])}</span>` : "";
  }
  /** The mode chip's title: a new chat's choice, or an open chat's fixed mode and folder. */
  function permTitle(v) {
    const own = ownOf(v);
    if (!own) return "What a new chat may do on its own";
    return `${(MODE_WORDS[own.mode] || [own.mode || ""])[0]}${isHome(own.cwd) ? "" : ` · in ${folderWord(own.cwd)}`}, set when it started`;
  }
  function chipTitle(v) {
    const own = ownOf(v);
    if (own) return `This chat runs ${rtName(own.agent)} · ${own.model ? modelWord(own.agent, own.model) : "its default model"}${own.effort ? ` · ${EFFORT_WORD[own.effort] || own.effort}` : ""}, set when it started`;
    if (v !== "chats") return "";
    const st = setup();
    if (!st.agent) return "";
    return `A new chat runs ${rtName(st.agent)} · ${st.model ? modelWord(st.agent, st.model) : "its default model"}${st.effort ? ` · ${EFFORT_WORD[st.effort] || st.effort}` : ""}. Change it`;
  }

  /** "Send now" is its own toggle beside the line, only where the runtime can interrupt a turn. */
  function nowState(v) {
    const s = v && v.startsWith("c:") ? session(v.slice(2)) : null;
    if (!s || !inTurn(s) || !offers(runtime(s.agent), "interrupt")) return null;
    return { on: C.now === s.id };
  }


  async function send(v, text) {
    const sid = v.startsWith("c:") ? v.slice(2) : null;
    const local = { id: `lc${Date.now().toString(36)}`, at: Date.now(), text, status: "sending", cid: clientId() };
    if (!sid) {
      const st = setup();
      if (!st.agent) { announce("No agent can chat here yet."); return; }
      local.body = { text, client_id: local.cid, agent: st.agent, ...(st.model ? { model: st.model } : {}), ...(st.effort && effortsFor(st).includes(st.effort) ? { effort: st.effort } : {}), ...(st.mode ? { permission_mode: st.mode } : {}), ...(st.cwd ? { cwd: st.cwd } : {}) };
    } else {
      const s = session(sid);
      const rt = s ? runtime(s.agent) : null;
      const steer = (feature(rt, "send_while_running") || {}).behaviour === "steered";
      const delivery = s && inTurn(s) ? (C.now === sid && offers(rt, "interrupt") ? "now" : steer ? "add" : null) : null;
      local.body = { text, client_id: local.cid, session_id: sid, ...(delivery ? { delivery } : {}) };
      (C.local.get(sid) || C.local.set(sid, []).get(sid)).push(local);
      schedule();
    }
    await deliver(local, sid);
  }
  function deliver(local, sid) { return once(`chat-send:${local.cid}`, () => post(local, sid)); }
  async function post(local, sid) {
    local.status = "sending";
    try {
      const r = await api.prompt(local.body);
      local.status = "sent";
      if (!sid) {
        const old = world.state.sessions[r.session_id];
        const agent = local.body.agent || (mainRuntime(world.state.runtimes) || {}).name || null;
        const heldNow = !!(world.act.agentHeld && world.act.agentHeld(agent));
        world.state.sessions[r.session_id] = { id: r.session_id, role: "plain", state: heldNow ? "queued" : "starting", statusAt: Date.now(), statusSeq: world.state.lastSeq ?? null, agent: local.body.agent || agent, model: local.body.model || null, effort: local.body.effort || null, permission_mode: local.body.permission_mode || null, cwd: local.body.cwd || null, created_at: new Date().toISOString(), ...(old || {}) };
        C.titles.set(r.session_id, local.body.text.replace(/\s+/g, " ").slice(0, 120));
        C.local.set(r.session_id, [local]);
        // open it, unless the person has gone somewhere else meanwhile
        if (!view || view() === "chats") go("c:" + r.session_id);
        else announce("Your new chat started. It's in Chats.");
      }
      if (local.body.delivery === "now") C.now = null;
      announce("Sent.");
    } catch (err) {
      if (err.code === "would_stop_runs") {
        // say what "now" would stop; resend the same request (same client_id) only if the person agrees
        const count = Number(err.count);
        C.confirm.set(sid, { local, sid, count: Number.isInteger(count) && count >= 0 ? count : 0 });
        local.status = "held";
      } else {
        local.status = "failed"; local.errTitle = err.code === "auth_required" ? "The agent isn't connected" : err.code === "timeout" ? "No answer from XO" : err.status === 501 ? "This agent can't chat yet" : err.status === 0 || err.status === 502 ? "Can't reach XO" : "Not sent"; local.err = err.message;
        // a new chat has nowhere to show a failed message: your words go back into the composer
        if (!sid) {
          const back = restore ? restore(local.body.text) : false;
          if (back) heraldShow({ kind: "stopped", text: local.errTitle, sub: `${err.message} Your message is back in the box.` }, 7000);
          else heraldShow({ kind: "stopped", text: local.errTitle, sub: err.message, undo: () => restore && restore(local.body.text, { force: true }), undoLabel: "Put my message back" }, 12000);
        }
      }
    }
    schedule();
  }
  function confirmHtml(v) {
    const c = v && v.startsWith("c:") ? C.confirm.get(v.slice(2)) : null;
    if (!c) return "";
    return `<div class="ch-confirm" role="alertdialog" aria-labelledby="chc-h"><p id="chc-h"><b>Sending now stops ${c.count} background task${c.count === 1 ? "" : "s"}</b> (sub-agents or shells) this chat started.</p>` +
      `<div class="set-fa"><button type="button" class="btn" data-chc="add">Add to the turn instead</button><button type="button" class="btn btn-danger" data-chc="now">Stop them and send</button></div></div>`;
  }
  function resolveConfirm(v, choice) {
    const c = v && v.startsWith("c:") ? C.confirm.get(v.slice(2)) : null;
    if (!c) return;
    C.confirm.delete(c.sid);
    if (choice === "now") c.local.body = { ...c.local.body, delivery: "now", confirm_stop_runs: c.count };
    else c.local.body = { ...c.local.body, delivery: "add" };
    C.now = null;
    deliver(c.local, c.sid);
  }

  // PR 24: an unconfirmed "now" that became "add" says so; the message joined the running turn
  world.onEvent((e) => {
    if (e.kind !== "now_became_add") return;
    for (const list of C.local.values()) for (const l of list) if ((e.wakes || []).includes(`msg:prompt:${l.cid}`)) l.added = true;
    schedule();
  });

  return {
    isChats: (v) => v === "chats" || (v && v.startsWith("c:")),
    open(v) { if (v === "chats") loadList(); else if (v.startsWith("c:")) loadChat(v.slice(2)); },
    items: (v) => (v === "chats" ? chatListItems(C, { sessions, waiting, inTurn, heldOf, heldShort, rowLine, titleFor, world, dayGroup, rowTime }) : chatItems(v.slice(2))),
    headHtml, targetHtml, permTitle, confirmHtml, resolveConfirm, nowState,
    placeholder: (v) => (v === "chats" ? "Ask anything to start a chat…" : session(v.slice(2))?.retired_at ? "This chat has ended" : "Reply in this chat…"),
    session: (v) => (v && v.startsWith("c:") ? session(v.slice(2)) : null),
    busy: (v) => { const s = v && v.startsWith("c:") ? session(v.slice(2)) : null; return !!(s && inTurn(s)); },
    /** Working now (not waiting on you): the typing line shows only then. */
    working: (v) => { const s = v && v.startsWith("c:") ? session(v.slice(2)) : null; return !!(s && inTurn(s) && !waiting(s)); },
    /** Why this chat can't take a message, if it can't. */
    blocked: (v) => { const s = v && v.startsWith("c:") ? session(v.slice(2)) : null; return s && s.retired_at ? "This chat has ended" : ""; },
    search(q) { if (C.q !== q) { C.q = q; schedule(); } },
    showAll(on) { C.all = on; if (!on) C.q = ""; schedule(); },
    send, openSetup, closeSetup, setPref, renderSetup, chipHtml, chipTitle,
    permHtml,
    toggleSetup,
    toggleNow: (v) => { const sid = v.slice(2); const s = session(sid); if (!s || !offers(runtime(s.agent), "interrupt")) return; C.now = C.now === sid ? null : sid; schedule(); },
    retry(id) { for (const [sid, list] of C.local) { const l = list.find((x) => x.id === id); if (l) { deliver(l, sid); return; } } },
    /** A failed message taken back to edit: it leaves the chat and its text is returned. */
    edit(id) {
      for (const list of C.local.values()) {
        const i = list.findIndex((x) => x.id === id && x.status === "failed");
        if (i >= 0) { const [l] = list.splice(i, 1); schedule(); return l.body.text; }
      }
      return null;
    },
    get setupOpen() { return C.pop.open; },
  };
}
