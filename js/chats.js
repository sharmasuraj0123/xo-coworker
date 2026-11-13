// Chats: plain chats with one agent, outside the coordinators (UI-reference §2.1, §4.4). A new chat
// is set up from the runtime's own feature list (folder, agent, model, effort, permission mode,
// never "bypass"); the conversation is your prompts (observation's /api/messages, where a plain
// chat's history lives) and the agent's work as storm's turn blocks, the same look as a thread.
// While a turn runs, a message joins it (the runtime's send_while_running) or, by choice, interrupts
// it ("send now"), which first says how many background tasks it would stop (409 would_stop_runs).

import { api, clientId, NEWEST } from "./api.js";
import { esc } from "./world.js";
import { ICON } from "./ui.js";
import { renderMarkdown } from "./markdown.js";
import { turnHtml, turnAv } from "./turnview.js";
import { cliName, mainRuntime, chatOrder, sessionRead, BUSY_STATES, heldShort } from "./timeline.js";
import { redraw } from "./redraw.js";
import { rovingTab } from "./keynav.js";
import { once } from "./pending.js";

const MODE_WORDS = {
  auto: ["Auto", "Its own safety check decides; most actions run unasked."],
  ask: ["Ask first", "It asks you before each action."],
  accept_edits: ["Edits", "It edits files freely and asks for the rest."],
  plan: ["Plan only", "It plans and changes nothing."],
  deny_unasked: ["Rules only", "Only what your rules allow; the rest is refused."],
};
// a turn in progress: waiting on your decision is still mid-turn (storm's session.py), so a message
// joins it and Stop can end it. "queued" is no turn: a gate holds its message back with no process
// (timeline.js heldOf), so nothing joins it and there is nothing to stop.
const BUSY = new Set([...BUSY_STATES, "waiting_on_person"]);
const EFFORT_WORD = { low: "Quick", medium: "Balanced", high: "Deep", xhigh: "Deeper", max: "Deepest" };
const PREFS = "cv-chat-prefs";
const store = { get() { try { return JSON.parse(localStorage.getItem(PREFS) || "{}"); } catch { return {}; } }, set(v) { try { localStorage.setItem(PREFS, JSON.stringify(v)); } catch { /* private */ } } };
const ago = (iso) => { const s = (Date.now() - Date.parse(iso)) / 1000; if (!Number.isFinite(s)) return ""; return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); };

export function createChats({ world, announce, heraldShow, go, schedule, view, restore }) {
  // confirm: one "send now" question per chat (session id → {local, count}), shown only in that chat
  const C = { list: null, loading: false, err: null, titles: new Map(), hist: new Map(), local: new Map(), prefs: { ...store.get() }, models: new Map(), read: new Set(), failed: new Map(), pop: { open: false }, confirm: new Map() };

  const sessions = () => Object.values(world.state.sessions || {}).filter((s) => s.role === "plain" && !s.retired_at);
  const session = (sid) => (world.state.sessions || {})[sid] || null;
  const runtime = (name) => (world.state.runtimes || []).find((r) => r.name === name) || (!name ? mainRuntime(world.state.runtimes) : null) || null;
  const feature = (rt, key) => (rt && rt.features && rt.features.features && rt.features.features[key]) || null;
  const offers = (rt, key) => { const f = feature(rt, key); return !!f && (f.support === "native" || f.support === "emulated"); };

  // ── the list ────────────────────────────────────────────────────────────
  async function loadList() {
    if (C.loading) return;
    C.loading = true;
    try {
      const d = await api.sessions({ role: "plain", before_seq: NEWEST, limit: 100 });
      for (const s of d.sessions || []) {
        const old = world.state.sessions[s.id];
        if (old && old.seq != null && s.seq != null && old.seq > s.seq) continue; // the stream knows newer
        world.state.sessions[s.id] = { ...(old || {}), ...s, ...sessionRead(s) }; // its `busy` beyond the status, and when
      }
      C.list = true; C.err = null;
      // the list names models as their agent's catalog does
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
  const metaLine = (s) => capFirst([folderWord(s.cwd), cliName(s.agent), s.model ? modelWord(s.agent, s.model) : "", s.effort ? EFFORT_WORD[s.effort] || s.effort : "", (MODE_WORDS[s.permission_mode] || [s.permission_mode || ""])[0]].filter(Boolean).join(" · "));
  const waiting = (s) => s.state === "waiting_on_person";
  /** What a gate holds this chat for (the usage limit…), or null: it waits, nothing runs. */
  const heldOf = (s) => (s && s.state === "queued" && world.act.sessionHeld ? world.act.sessionHeld(s.id) : null);

  function listItems() {
    const rows = sessions().sort((a, b) => Date.parse(b.updated_at || b.created_at) - Date.parse(a.updated_at || a.created_at));
    if (!C.list && !rows.length) return [{ key: "chats-load", html: `<p class="m-note">${C.err ? `Couldn't read your chats: ${esc(C.err)}` : "Reading your chats…"}</p>` }];
    if (!rows.length) return [{ key: "chats-none", html: `<div class="calm ch-calm"><div class="calm-mark">${ICON.thread}</div><h2>No chats yet.</h2><p>Ask anything below. A chat is one agent in one folder, outside your projects' coordinators.</p></div>` }];
    return [{ key: "chats-list", html: `<ul class="ch-list" aria-label="Your chats">${rows.map((s) => {
      // Working: on a turn, or a sub-agent working on after it (storm's busy rule); waiting on you says so first
      const wait = waiting(s), busy = BUSY.has(s.state) || !!(world.act.sessionBusy && world.act.sessionBusy(s.id));
      const held = !wait && !busy ? heldOf(s) : null;
      return `<li><button type="button" class="ch-row" data-go="c:${esc(s.id)}"><i class="g g-${wait ? "needs_approval" : busy ? "working" : held ? "paused" : "idle"}" aria-hidden="true"></i>` +
        `<span class="ch-main"><span class="ch-t">${esc(titleFor(s))}</span><span class="ch-m">${esc(metaLine(s))}</span></span>` +
        `<span class="ch-a${wait ? " is-need" : ""}">${wait ? "Needs you" : busy ? "Working" : held ? esc(heldShort(held)) : esc(ago(s.updated_at || s.created_at))}</span></button></li>`;
    }).join("")}</ul>` }];
  }

  // ── one chat ────────────────────────────────────────────────────────────
  /**
   * Read a chat: its session (when we only know part of it), your prompts (observation's history, where
   * a plain chat's prompts live) and its turns (storm's blocks). Read again on every open, so prompts sent
   * from the CLI or another tab show; a history is "loaded" only once it was really read.
   */
  async function loadChat(sid) {
    const h = C.hist.get(sid) || { loading: false, loaded: false, user: [], error: null, turns: false };
    C.hist.set(sid, h);
    if (h.loading) { h.again = true; return; }
    h.loading = true; schedule();
    try {
      let s = session(sid);
      if (s && s.agent) ensureModels(s.agent); // model names in words in the header
      if (!s || !s.native_id || s.cwd === undefined) {
        const full = await api.session(sid).catch(() => null);
        if (full) { world.state.sessions[sid] = { ...(session(sid) || {}), ...full }; s = session(sid); }
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
    if (C.now && !BUSY.has((session(C.now) || {}).state)) C.now = null;
    const v = view && view();
    if (!v || !v.startsWith("c:")) return;
    const sid = v.slice(2);
    const n = world.state.turns ? world.state.turns.list((t) => t.session === sid).length : 0;
    const before = turnCount.get(sid);
    turnCount.set(sid, n);
    if (before != null && n > before) setTimeout(() => loadChat(sid), 1500);
    // the CLI attached after the chat opened: its history can be read now (once per native id; an error
    // waits for the next open, so a struggling server is never asked again and again)
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
          : m.added ? `<div class="meta"><span>Added to the turn in progress, not sent now</span>${BUSY.has(s.state) ? `<button type="button" class="meta-btn" data-chat-stop>${ICON.stop}Stop the turn</button>` : ""}</div>` : "";
        items.push({ key: `u:${m.id}`, html: `<div class="m m-you${m.status === "failed" ? " is-failed" : ""}"><div class="bubble">${esc(m.text)}</div>${meta}</div>` });
      } else {
        const inner = turnHtml(x.t, world.state.turns.blocksOf(x.t), { open: world.ui ? world.ui.tbOpen : {} });
        if (inner) items.push({ key: `turn:${x.t.id}`, html: `<div class="m m-them m-turn">${x.t.status === "running" ? turnAv(x.t, world.state.turns.blocksOf(x.t)) : `<div class="av av-t">${ICON.thread}</div>`}<div class="mb">${inner}</div></div>` });
      }
    }
    if (!all.length && !h.loading && !h.error) items.push({ key: "chat-empty", html: `<p class="m-note">Nothing here yet.</p>` });
    return items;
  }
  function headHtml(v) {
    if (v === "chats") return `<span class="tw-ic" aria-hidden="true">${ICON.thread}</span><span class="tw-t"><h1 id="conv-title">Chats</h1><span class="pj-s">One agent, one folder, outside your projects' coordinators</span></span>`;
    const s = session(v.slice(2));
    if (!s) return `<span class="tw-t"><h1 id="conv-title">Chat</h1></span>`;
    const busy = BUSY.has(s.state), wait = waiting(s), held = !busy && !wait ? heldOf(s) : null;
    const st = s.retired_at ? ["resolved", "done", "Ended"] : wait ? ["needs_approval", "needs_approval", "Needs you"] : busy ? ["working", "working", "Working"] : held ? ["paused", "paused", heldShort(held)] : ["resolved", "idle", "Idle"];
    return `<span class="tw-t"><h1 id="conv-title">${esc(titleFor(s))}</h1><span class="pj-s">${esc(metaLine(s))}</span></span>` +
      `<span class="badge st-${st[0]}"><i class="g g-${st[1]}" aria-hidden="true"></i>${st[2]}</span>`;
  }

  // ── the composer's line and the new chat's setup ─────────────────────────
  /** The modes a runtime offers (never "bypass": plain chat refuses it). */
  const modesOf = (rt) => ((feature(rt, "permissions.mode") || {}).values || []).filter((m) => m !== "bypass");
  /** The new chat's setup: your last choices, kept only where the chosen runtime still offers them. */
  function setup() {
    const p = C.prefs;
    const rt = runtime(p.agent) || runtime(null);
    const agent = rt ? rt.name : null;
    const modes = modesOf(rt);
    const mode = modes.includes(p.mode) ? p.mode : modes.includes("auto") ? "auto" : modes[0] || null;
    // One model, everywhere: what the picker shows, what the line above the composer names and what Send sends
    // all come from here, and a saved model counts only once the agent's catalog confirms it (Astra S153/H19).
    // Not offered any more: gone, said so, never sent. Not confirmed yet (the catalog on its way, or unread):
    // the agent's default meanwhile, said so, never the unchecked one.
    let model = p.model || null, gone = null, unsure = null;
    if (model && !(C.read.has(agent) && offered(agent).some((m) => m.id === model))) {
      if (C.read.has(agent)) gone = model; else unsure = { model, failed: C.failed.has(agent) };
      model = null;
    }
    return { rt, agent, model, gone, unsure, effort: p.effort || null, mode, modes, cwd: p.cwd || "" };
  }
  /** The models the picker offers for an agent: its catalog's families (each family's default) and loose models. */
  const offered = (agent) => (C.models.get(agent) || []).filter((m) => !m.is_default && (m.family_default || !m.family));
  /** The efforts for a model (or the agent's default model): its own list, else the runtime's (§2.7). */
  function effortsFor(st) {
    const list = C.models.get(st.agent) || [];
    const m = list.find((x) => x.id === st.model) || list.find((x) => x.is_default) || null;
    if (m && !m.takes_effort) return [];
    if (m && m.efforts && m.efforts.length) return m.efforts;
    const f = feature(st.rt, "effort");
    return f && f.support !== "unsupported" ? f.values || [] : [];
  }
  /**
   * An agent's catalog, read once. A read that failed is remembered as failed (so the many redraws don't ask again
   * and again) until the setup opens again, which tries it afresh (again: true; Astra: a failure was kept for good).
   */
  async function ensureModels(agent, { again = false } = {}) {
    if (!agent) return;
    if (again && C.failed.has(agent)) { C.failed.delete(agent); C.models.delete(agent); }
    if (C.models.has(agent)) return;
    C.models.set(agent, []);
    try { C.models.set(agent, (await api.models(agent)).models || []); C.read.add(agent); } catch (err) { C.failed.set(agent, err.message || "no answer"); /* the agent's default only, said so */ }
    renderSetup(); schedule();
  }
  function targetHtml(v) {
    if (v === "chats") {
      const st = setup();
      if (!st.agent) return `<span class="tg-warn">${ICON.pause}</span><span>No agent can chat here yet</span>`;
      ensureModels(st.agent);
      return `<span class="tg-t">${ICON.thread}</span><span>New chat in <b>${esc(st.cwd ? (world.project(st.cwd) || {}).name || st.cwd : "your projects folder")}</b> · ${esc(cliName(st.agent))} · ${esc(st.model ? modelWord(st.agent, st.model) : st.gone ? `its default model (${st.gone} is gone)` : st.unsure ? `its default model (${st.unsure.model} ${st.unsure.failed ? "unconfirmed" : "being checked"})` : "its default model")}${st.mode ? ` · ${esc(MODE_WORDS[st.mode] ? MODE_WORDS[st.mode][0] : st.mode)}` : ""}</span><span class="tg-ch">Change</span>`;
    }
    const s = session(v.slice(2));
    if (!s) return "";
    // neutral, not amber: nothing waits on you, and nothing resumes
    if (s.retired_at) return `<span class="tg-end">${ICON.stop}</span><span>Ended. Start a new one from Chats.</span>`;
    if (BUSY.has(s.state)) {
      const rt = runtime(s.agent);
      const steer = (feature(rt, "send_while_running") || {}).behaviour === "steered";
      if (C.now === s.id) return `<span class="tg-t tg-now-on">${ICON.bolt}</span><span>Sends now: <b>stops the turn in progress</b></span>`;
      return `<span class="tg-t">${ICON.thread}</span><span>${steer ? "Adds to the turn in progress" : "Waits for the turn in progress"}</span>`;
    }
    // held back by a gate: a reply waits with what's already waiting, and runs with it
    if (heldOf(s)) return `<span class="tg-t">${ICON.thread}</span><span>Reply in <b>this chat</b> · it runs with the waiting message</span>`;
    return `<span class="tg-t">${ICON.thread}</span><span>Reply in <b>this chat</b></span>`;
  }

  /** "Send now" is its own toggle beside the line, only where the runtime can interrupt a turn. */
  function nowState(v) {
    const s = v && v.startsWith("c:") ? session(v.slice(2)) : null;
    if (!s || !BUSY.has(s.state) || !offers(runtime(s.agent), "interrupt")) return null;
    return { on: C.now === s.id };
  }

  async function openSetup(anchor) {
    const pop = document.getElementById("cs-pop");
    C.pop = { open: true, anchor };
    // shown (unseen) before it is measured, so it opens where it belongs the first time
    pop.style.visibility = "hidden";
    pop.hidden = false;
    renderSetup();
    pop.style.visibility = "";
    pop.focus({ preventScroll: true });
    const st = setup();
    if (st.agent) await ensureModels(st.agent, { again: true });
  }
  function renderSetup() {
    const pop = document.getElementById("cs-pop");
    if (!C.pop.open) return;
    const st = setup();
    const rts = world.state.runtimes || [];
    const models = offered(st.agent);

    const efforts = effortsFor(st);
    const modes = st.modes;
    const folders = [{ id: "", name: "Your projects folder" }, ...world.state.projects.filter((p) => p.kind === "project").map((p) => ({ id: p.id, name: p.name }))];
    // each picker's options, by its field: a picker draws its own insides (redraw.js leaves them to it), so new
    // options (another agent's catalog arriving) are handed to it below, through its own re-render path
    const opts = {
      cwd: folders.map((f) => `<option value="${esc(f.id)}"${f.id === st.cwd ? " selected" : ""}>${esc(f.name)}</option>`).join(""),
      agent: rts.length > 1 ? rts.map((r) => `<option value="${esc(r.name)}"${r.name === st.agent ? " selected" : ""}>${esc(cliName(r.name))}</option>`).join("") : null,
      model: `<option value="">The agent's default</option>${models.map((m) => `<option value="${esc(m.id)}"${m.id === st.model ? " selected" : ""}${m.description ? ` data-desc="${esc(m.description)}"` : ""}>${esc(m.name)}</option>`).join("")}`,
      effort: efforts.length ? `<option value="">Default</option>${efforts.map((e) => `<option value="${esc(e)}"${e === st.effort ? " selected" : ""}>${esc(EFFORT_WORD[e] || e)}</option>`).join("")}` : null,
    };
    const field = (k, word) => (opts[k] == null ? "" : `<label class="cs-f"><span>${word}</span><xo-select data-cs="${k}">${opts[k]}</xo-select></label>`);
    // What it may do: a radio group (keynav.js's keys); only the chosen mode is in the Tab order
    const html = `<header class="iq-h"><h2>New chat</h2></header>` +
      `<div class="iq-sec">${field("cwd", "Folder")}${field("agent", "Agent")}${field("model", "Model")}` +
      // why the list holds only the default, whenever it does: gone, unread (with the reason), or still checking
      (st.gone ? `<p class="iq-rl" role="status">“${esc(st.gone)}” isn't offered by ${esc(cliName(st.agent))} any more, so a new chat uses its default model.</p>`
        : C.failed.has(st.agent) ? `<p class="iq-rl" role="status">Couldn't read ${esc(cliName(st.agent))}'s models: ${esc(C.failed.get(st.agent).replace(/[.\s]+$/, ""))}. ${st.unsure ? `“${esc(st.unsure.model)}” isn't confirmed, so a` : "A"} new chat uses its default model. Open this again to try again.</p>`
        : st.unsure ? `<p class="iq-rl" role="status">Checking that “${esc(st.unsure.model)}” is still offered… until then a new chat uses its default.</p>` : "") +
      `${field("effort", "Effort")}</div>` +
      (!modes.length ? `<div class="iq-sec"><p class="iq-rl">This agent doesn't say what it may do on its own; it uses its default.</p></div>` : `<div class="iq-sec"><p class="iq-lab">What it may do</p><div class="cs-modes" role="radiogroup" aria-label="What it may do">${modes.map((m, i) => `<button type="button" role="radio" class="set-choice${m === st.mode ? " is-on" : ""}" aria-checked="${m === st.mode}"${rovingTab(m === st.mode, i === 0 && !modes.includes(st.mode))} data-csmode="${esc(m)}"><span class="sc-dot" aria-hidden="true"></span><span class="sc-b"><b>${esc((MODE_WORDS[m] || [m])[0])}</b><span>${esc((MODE_WORDS[m] || ["", ""])[1])}</span></span></button>`).join("")}</div></div>`) +
      `<footer class="iq-f"><span>Used for your next new chat.</span><button type="button" class="iq-back" data-cs-done>Done</button></footer>`;
    // in place (js/redraw.js): a mode chosen, a catalog arriving, keep the control you're on
    redraw(pop, html);
    for (const x of pop.querySelectorAll("xo-select[data-cs]")) {
      const want = opts[x.dataset.cs];
      if (x._opts === undefined) x._opts = want; // drawn just now, with these options
      else if (want != null && x._opts !== want) {
        // only its <option>s change: its button (focused or not) and list stay, so focus never leaves it (S152)
        x._opts = want;
        const t = document.createElement("template"); t.innerHTML = want;
        for (const o of [...x.children]) if (o.tagName === "OPTION") o.remove();
        x.append(t.content);
      }
    }
    const a = C.pop.anchor;
    if (a && !matchMedia("(max-width: 760px)").matches) {
      // anchored by its bottom edge just above the line: it grows upwards and never leaves the screen
      pop.classList.remove("is-sheet");
      const r = a.getBoundingClientRect(); const w = Math.min(400, innerWidth - 24);
      pop.style.width = `${w}px`; pop.style.left = `${Math.max(12, Math.min(r.left, innerWidth - w - 12))}px`;
      pop.style.top = ""; pop.style.bottom = `${Math.max(12, innerHeight - r.top + 10)}px`; pop.style.maxHeight = `${Math.max(240, r.top - 22)}px`;
    } else { pop.style.left = pop.style.top = pop.style.bottom = pop.style.width = pop.style.maxHeight = ""; pop.classList.add("is-sheet"); }
  }
  function closeSetup() { C.pop.open = false; const pop = document.getElementById("cs-pop"); pop.hidden = true; C.pop.anchor?.focus?.({ preventScroll: true }); }
  const setPref = (k, v) => {
    C.prefs = { ...C.prefs, [k]: v || null };
    // another agent has its own models, efforts and modes: read them, and start from its defaults
    if (k === "agent") { C.prefs.model = null; C.prefs.effort = null; C.prefs.mode = null; ensureModels(C.prefs.agent); }
    if (k === "model") C.prefs.effort = null;
    store.set(C.prefs);
  };

  // ── sending ─────────────────────────────────────────────────────────────
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
      // while a turn runs: "now" when chosen (and offered), else "add" where the runtime steers a
      // running turn; a runtime that queues takes the message for its next turn (no delivery)
      const steer = (feature(rt, "send_while_running") || {}).behaviour === "steered";
      const delivery = s && BUSY.has(s.state) ? (C.now === sid && offers(rt, "interrupt") ? "now" : steer ? "add" : null) : null;
      local.body = { text, client_id: local.cid, session_id: sid, ...(delivery ? { delivery } : {}) };
      (C.local.get(sid) || C.local.set(sid, []).get(sid)).push(local);
      schedule();
    }
    await deliver(local, sid);
  }
  /** One request at a time per message (its client_id): a Retry pressed again, or the would-stop question answered
   *  twice, joins the one that's out (js/pending.js). */
  function deliver(local, sid) { return once(`chat-send:${local.cid}`, () => post(local, sid)); }
  async function post(local, sid) {
    local.status = "sending";
    try {
      const r = await api.prompt(local.body);
      local.status = "sent";
      if (!sid) {
        // what we know until the stream says more (never over a newer state it already sent): starting, as
        // the server admits it; held back by a gate, its own "queued" frame says so (timeline.js heldOf)
        const old = world.state.sessions[r.session_id];
        world.state.sessions[r.session_id] = { id: r.session_id, role: "plain", state: "starting", agent: local.body.agent, model: local.body.model || null, effort: local.body.effort || null, permission_mode: local.body.permission_mode || null, cwd: local.body.cwd || null, created_at: new Date().toISOString(), ...(old || {}) };
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
    items: (v) => (v === "chats" ? listItems() : chatItems(v.slice(2))),
    headHtml, targetHtml, confirmHtml, resolveConfirm, nowState,
    placeholder: (v) => (v === "chats" ? "Ask anything to start a chat…" : session(v.slice(2))?.retired_at ? "This chat has ended" : "Reply in this chat…"),
    session: (v) => (v && v.startsWith("c:") ? session(v.slice(2)) : null),
    busy: (v) => { const s = v && v.startsWith("c:") ? session(v.slice(2)) : null; return !!(s && BUSY.has(s.state)); },
    /** Working now (not waiting on you): the typing line shows only then. */
    working: (v) => { const s = v && v.startsWith("c:") ? session(v.slice(2)) : null; return !!(s && BUSY.has(s.state) && !waiting(s)); },
    /** Why this chat can't take a message, if it can't. */
    blocked: (v) => { const s = v && v.startsWith("c:") ? session(v.slice(2)) : null; return s && s.retired_at ? "This chat has ended" : ""; },
    send, openSetup, closeSetup, setPref, renderSetup,
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
