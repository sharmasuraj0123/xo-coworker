// @ts-check

import { api, clientId } from "../../core/platform/api.js";
import { esc, once } from "../../core/platform/index.js";
import { reportFailure } from "../../core/services/notices/failures.js";
import { ICON } from "../../core/ui/icons/names.js";
import { stateMark, xi } from "../../core/ui/icons/icon.js";
import { BUSY_STATES, mainRuntime } from "../../core/services/world/sessions.js";
import { rtMark, rtName } from "../../core/services/runtimes.js";
import { EFFORT_WORD } from "./effort.js";
import { createSetup, MODE_WORDS, store } from "./setup.js";
import { chatGroups, chatListItems } from "./list.js";
import { createChatTitles } from "./titles.js";
import { createChatReads } from "./reads.js";
import { promptFailure } from "./prompt-failure.js";
import { createScope } from "../../core/kernel/scope.js";

/** @typedef {import("./types").ChatState} ChatState @typedef {import("./types").ChatDeps} ChatDeps @typedef {import("./types").Conversation} Conversation @typedef {import("./types").Session} Session @typedef {import("./types").LocalPrompt} LocalPrompt @typedef {import("./types").Runtime} Runtime */

const BUSY = new Set([...BUSY_STATES, "waiting_on_person"]);

/** @param {Session} a @param {Session} b */
const recentFirst = (a, b) => Date.parse(b.updated_at || b.created_at || "") - Date.parse(a.updated_at || a.created_at || "");
/** @param {ChatDeps} deps @param {Conversation} conversation */
export function createChats({ world, announce, heraldShow, go, schedule, view, restore, listRoot, transcriptOpen, workspace }, { turnHtml, turnAv, cliName, chatOrder, heldShort, heldBadge, rowTime }) {
  const scope = createScope();
  /** @type {ChatState} */
  const C = { list: null, loading: false, err: null, hist: new Map(), local: new Map(), prefs: { ...store.get() }, models: new Map(), read: new Set(), failed: new Map(), pop: { open: false }, confirm: new Map() };

  const sessions = () => Object.values(world.state.sessions || {}).filter((s) => s.role === "plain" && !s.retired_at);
  /** @param {string} sid */
  const session = (sid) => (world.state.sessions || {})[sid] || null;
  const listHost = listRoot ?? (typeof document === "undefined" ? undefined : document.getElementById("msgs")) ?? undefined;
  const titleList = createChatTitles(listHost, session, schedule);
  scope.effect(() => titleList.stop);
  /** @param {string | null} [name] @returns {Runtime | null} */
  const runtime = (name) => (world.state.runtimes || []).find((r) => r.name === name) || (!name ? /** @type {Runtime | null} */ (mainRuntime(world.state.runtimes)) : null) || null;
  /** @param {Runtime | null} rt @param {string} key */
  const feature = (rt, key) => (rt && rt.features && rt.features.features && rt.features.features[key]) || null;

  const { setup, effortsFor, ensureModels, openSetup, closeSetup, setPref, renderSetup, toggleSetup } = createSetup(C, { world, schedule, runtime, feature, cliName });

  const { loadList, loadChat } = createChatReads(C, { world, sessions, session, schedule, ensureModels, titles: titleList, signal: scope.signal });
  /** @param {Session} s */
  const titleFor = (s) => titleList.get(s) || `A chat in ${folderWord(s.cwd)}`;
  /** @param {string | null | undefined} cwd */
  const folderWord = (cwd) => (!cwd ? "your projects folder" : cwd.replace(/^\/home\/[^/]+\/?/, "~/").replace(/^~\/$/, "~"));
  /** @param {string | null | undefined} agent @param {string} id */
  const modelWord = (agent, id) => { const m = (C.models.get(/** @type {string | null} */ (agent)) || []).find((x) => x.id === id); return m?.name ?? id; };
  /** @param {string | null | undefined} agent */
  const agentMark = (agent, lead = true) => rtMark(/** @type {string} */ (agent), { lead }) || `${esc(cliName(agent))}${lead ? " " : ""}`;
  /** @param {string | null | undefined} cwd */
  const isHome = (cwd) => !cwd || /^\/home\/[^/]+\/?$/.test(cwd);
  /** @param {Session} s */
  const metaHtml = (s) => [`${agentMark(s.agent)}${esc(s.model ? modelWord(s.agent, s.model) : "Default model")}`, s.effort ? esc(EFFORT_WORD[s.effort] || s.effort) : "",
    esc((MODE_WORDS[/** @type {string} */ (s.permission_mode)] || [s.permission_mode || ""])[0]), isHome(s.cwd) ? "" : `in ${esc(folderWord(s.cwd))}`].filter(Boolean).join(" · ");
  /** What search matches besides the title: only what isn't a new chat's default (model, effort, mode, folder). @param {Session} s */
  const rowLine = (s) => {
    const home = isHome(s.cwd);
    return [s.model ? modelWord(s.agent, s.model) : "", s.effort ? EFFORT_WORD[s.effort] || s.effort : "",
      s.permission_mode && s.permission_mode !== "auto" ? (MODE_WORDS[s.permission_mode] || [s.permission_mode])[0] : "", home ? "" : `in ${folderWord(s.cwd)}`].filter(Boolean).join(" · ");
  };
  /** @param {Session} s */
  const waiting = (s) => s.state === "waiting_on_person";
  /** What a gate holds this chat for (the usage limit…), or null: it waits, nothing runs. @param {Session | null} s */
  const heldOf = (s) => (s && s.state === "queued" && world.act.sessionHeld ? world.act.sessionHeld(s.id) : null);
  /** A turn in progress: its status says so, or it says queued and the stream has seen it work since. @param {Session | null} s */
  const inTurn = (s) => !!s?.state && (BUSY.has(s.state) || (s.state === "queued" && !!(world.act.onTurn && world.act.onTurn(s.id))));

  scope.effect(() => world.subscribe?.(() => {
    titleList.noteSessions();
    const v = view && view();
    if (v && v !== "chats" && !v.startsWith("c:")) titleList.stop();
    if (!v || !v.startsWith("c:")) return;
    const sid = v.slice(2);
    const s = session(sid), h = C.hist.get(sid);
    if (s?.native_id && h && h.tried !== s.native_id) loadChat(sid, { afterTurn: true });
  }));
  /** A prompt sent while a turn ran waits behind it, as in a thread: or Interrupt, and it reads this now. @param {Session} s @param {import("./types").Prompt} m */
  const waitingMeta = (s, m) => !m.waits || m.status !== "sent" || !inTurn(s) || (world.act.turnOf?.(s.id) || "turn") !== m.waits ? ""
    : world.act.sessionState?.(s.id) === "stopping"
    ? `<div class="meta"><i class="spin" aria-hidden="true"></i><span>Stopping its turn · it reads this next</span></div>`
    : `<div class="meta"><span>Waiting · it reads this when its current turn ends</span><button type="button" class="meta-btn" data-interrupt title="Stop its current turn so it reads this now (Undo for 3 s)">${ICON.bolt}Interrupt</button></div>`;
  /** @param {string} sid */
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
          : waitingMeta(s, m);
        items.push({ key: `u:${m.id}`, html: `<div class="m m-you${m.status === "failed" ? " is-failed" : ""}"><div class="bubble">${esc(m.text)}</div>${meta}</div>` });
      } else {
        const inner = turnHtml(x.t, (/** @type {NonNullable<typeof world.state.turns>} */ (world.state.turns)).blocksOf(x.t), { view: "c:" + sid, open: transcriptOpen?.() ?? world.ui?.tbOpen });
        if (inner) items.push({ key: `turn:${x.t.id}`, html: `<div class="m m-them m-turn">${x.t.status === "running" ? turnAv(x.t, (/** @type {NonNullable<typeof world.state.turns>} */ (world.state.turns)).blocksOf(x.t)) : `<div class="av av-t">${rtMark(/** @type {string} */ (s.agent)) || ICON.thread}</div>`}<div class="mb">${inner}</div></div>` });
      }
    }
    if (!all.length && !h.loading && !h.error) items.push({ key: "chat-empty", html: `<p class="m-note">Nothing here yet.</p>` });
    return items;
  }
  /** @param {string} v */
  function headHtml(v) {
    if (v === "chats") return `<span class="tw-ic" aria-hidden="true">${ICON.thread}</span><span class="tw-t"><h1 id="conv-title">Chats</h1></span>`;
    const s = session(v.slice(2));
    if (!s) return `<span class="tw-t"><h1 id="conv-title">Chat</h1></span>`;
    const busy = inTurn(s), wait = waiting(s), held = !busy && !wait ? heldOf(s) : null;
    const st = s.retired_at ? ["resolved", "done", "Ended"] : wait ? ["needs_approval", "needs_approval", "Needs you"] : busy ? ["working", "working", "Working"] : held ? ["paused", "paused", heldBadge(held)] : ["resolved", "idle", "Waiting"];
    return `<span class="tw-t"><h1 id="conv-title">${esc(titleFor(s))}</h1><span class="pj-s">${metaHtml(s)}</span></span>` +
      `<span class="badge st-${st[0]}">${stateMark(st[1])}${st[2]}</span>`;
  }

  /** A new chat works in the first project you @: its folder. @param {string} text */
  const aimedAt = (text) => [...text.matchAll(/(?:^|\s)@([\w.-]+)/g)]
    .map((m) => (world.state.projects || []).find((p) => p.id === m[1] && p.kind === "project")).find(Boolean) || null;
  /** @param {string} v */
  function targetHtml(v, text = "") {
    if (v === "chats") {
      const st = setup(), cwd = aimedAt(text);
      if (!st.agent) return `<span class="tg-warn">${ICON.pause}</span><span>No agent can chat here yet</span>`;
      ensureModels(st.agent);
      return `${ICON.thread}<span>New chat${cwd ? ` in ${esc(cwd.name)}` : ""}</span>${ICON.chevron}`;
    }
    const s = session(v.slice(2));
    if (!s) return "";
    // neutral, not amber: nothing waits on you, and nothing resumes
    if (s.retired_at) return `<span class="tg-end">${ICON.stop}</span><span>Ended. Start a new one from Chats.</span>`;
    if (inTurn(s)) {
      const rt = runtime(s.agent);
      const steer = (feature(rt, "send_while_running") || {}).behaviour === "steered";
      return `<span class="tg-t">${ICON.thread}</span><span>${steer ? "Adds to the turn in progress" : "Waits for the turn in progress"}</span>`;
    }
    // held back by a gate: a reply waits with what's already waiting, and runs with it
    if (heldOf(s)) return `<span class="tg-t">${ICON.thread}</span><span>Reply in <b>this chat</b> · it runs with the waiting message</span>`;
    return ""; // the box's own "Reply in this chat…" says it
  }

  /** An open chat's own agent, model, thinking and mode, as the new chat's chips show them (fixed: set when it started). @param {string} v */
  const ownOf = (v) => { const s = v && v.startsWith("c:") ? session(v.slice(2)) : null; return s && s.agent ? { agent: s.agent, model: s.model || null, effort: s.effort || null, mode: s.permission_mode || null, cwd: s.cwd } : null; };
  /** @param {string} v */
  function chipHtml(v) {
    const own = ownOf(v);
    if (v !== "chats" && !own) return "";
    const st = own || setup();
    if (!st.agent) return "";
    const sep = `<span class="iq-sep" aria-hidden="true">·</span>`;
    const effort = own ? st.effort : st.effort && effortsFor(/** @type {ReturnType<typeof setup>} */ (st)).includes(st.effort) ? st.effort : null;
    return `<span class="iq-l">${rtMark(st.agent, { lead: true }) || ""}${st.model ? `<span class="iq-t">${esc(modelWord(st.agent, st.model))}</span>` : `<span class="iq-a">Default</span>`}${effort ? `${sep}<span class="iq-e">${esc(EFFORT_WORD[effort] || effort)}</span>` : ""}</span>`;
  }
  /** @param {string} v */
  function permHtml(v) {
    const own = ownOf(v);
    if (v !== "chats" && !own) return "";
    const st = own || setup();
    return st.agent && st.mode ? `${xi(MODE_WORDS[st.mode]?.[2] || "lock")}<span>${esc((MODE_WORDS[st.mode] || [st.mode])[0])}</span>` : "";
  }
  /** The mode chip's title: a new chat's choice, or an open chat's fixed mode and folder. @param {string} v */
  function permTitle(v) {
    const own = ownOf(v);
    if (!own) return "What a new chat may do on its own";
    return `${(MODE_WORDS[/** @type {string} */ (own.mode)] || [own.mode || ""])[0]}${isHome(own.cwd) ? "" : ` · in ${folderWord(own.cwd)}`}, set when it started`;
  }
  /** @param {string} v */
  function chipTitle(v) {
    const own = ownOf(v);
    if (own) return `This chat runs ${rtName(own.agent)} · ${own.model ? modelWord(own.agent, own.model) : "its default model"}${own.effort ? ` · ${EFFORT_WORD[own.effort] || own.effort}` : ""}, set when it started`;
    if (v !== "chats") return "";
    const st = setup();
    if (!st.agent) return "";
    return `A new chat runs ${rtName(st.agent)} · ${st.model ? modelWord(st.agent, st.model) : "its default model"}${st.effort ? ` · ${EFFORT_WORD[st.effort] || st.effort}` : ""}. Change it`;
  }

  /** @param {string} v @param {string} text */
  async function send(v, text) {
    const sid = v.startsWith("c:") ? v.slice(2) : null;
    /** @type {LocalPrompt} */
    const local = /** @type {LocalPrompt} */ ({ id: `lc${Date.now().toString(36)}`, at: Date.now(), text, status: "sending", cid: clientId() });
    if (!sid) {
      const st = setup();
      if (!st.agent) { announce("No agent can chat here yet."); return; }
      local.body = { text, client_id: local.cid, agent: st.agent, ...(st.model ? { model: st.model } : {}), ...(st.effort && effortsFor(st).includes(st.effort) ? { effort: st.effort } : {}), ...(st.mode ? { permission_mode: st.mode } : {}), ...(aimedAt(text) ? { cwd: aimedAt(text)?.id } : {}) };
    } else {
      const s = session(sid);
      const rt = s ? runtime(s.agent) : null;
      const steer = (feature(rt, "send_while_running") || {}).behaviour === "steered";
      const delivery = s && inTurn(s) && steer ? "add" : null;
      if (s && inTurn(s) && !steer) local.waits = world.act.turnOf?.(sid) || "turn";
      local.body = { text, client_id: local.cid, session_id: sid, ...(delivery ? { delivery } : {}) };
      (C.local.get(sid) || /** @type {LocalPrompt[]} */ (C.local.set(sid, []).get(sid))).push(local);
      schedule();
    }
    await deliver(local, sid);
  }
  /** @param {LocalPrompt} local @param {string | null} sid */
  function deliver(local, sid) { return once(`chat-send:${local.cid}`, () => post(local, sid)); }
  /** @param {LocalPrompt} local @param {string | null} sid */
  async function post(local, sid) {
    if (scope.signal.aborted) return;
    local.status = "sending";
    let r;
    try {
      r = await api.prompt(local.body);
    } catch (error) {
      if (scope.signal.aborted) return;
      promptFailure(C.confirm, { restore, heraldShow }, local, sid, error);
      schedule();
      return;
    }
    if (scope.signal.aborted) return;
    local.status = "sent";
    try {
      if (!sid) {
        const old = /** @type {Partial<Session> | undefined} */ (world.state.sessions[r.session_id]);
        const agent = local.body.agent || (mainRuntime(world.state.runtimes) || {}).name || null;
        const heldNow = !!(world.act.agentHeld && world.act.agentHeld(agent));
        titleList.optimistic(r.session_id, local.body.text);
        C.local.set(r.session_id, [local]);
        world.act.noteSession({
          id: r.session_id, role: "plain", state: heldNow ? "queued" : "starting",
          agent: local.body.agent || agent, model: local.body.model || null, effort: local.body.effort || null,
          permission_mode: local.body.permission_mode || null, cwd: local.body.cwd || null,
          created_at: new Date().toISOString(), ...old,
        }, world.act.sentAt());
        // open it, unless the person has gone somewhere else meanwhile
        if (!view || view() === "chats") go("c:" + r.session_id);
        else announce("Your new chat started. It's in Chats.");
      }
      announce("Sent.");
    } catch (error) {
      reportFailure(error);
    }
    schedule();
  }
  /** @param {string} v */
  function confirmHtml(v) {
    const c = v && v.startsWith("c:") ? C.confirm.get(v.slice(2)) : null;
    if (!c) return "";
    return `<div class="ch-confirm" role="alertdialog" aria-labelledby="chc-h"><p id="chc-h"><b>Sending now stops ${c.count} background task${c.count === 1 ? "" : "s"}</b> (sub-agents or shells) this chat started.</p>` +
      `<div class="set-fa"><button type="button" class="btn" data-chc="add">Add to the turn instead</button><button type="button" class="btn btn-danger" data-chc="now">Stop them and send</button></div></div>`;
  }
  /** @param {string} v @param {string} choice */
  function resolveConfirm(v, choice) {
    const c = v && v.startsWith("c:") ? C.confirm.get(v.slice(2)) : null;
    if (!c) return;
    C.confirm.delete(c.sid);
    if (choice === "now") c.local.body = { ...c.local.body, delivery: "now", confirm_stop_runs: c.count };
    else c.local.body = { ...c.local.body, delivery: "add" };
    deliver(c.local, c.sid);
  }

  scope.effect(() => world.onEvent((e) => {
    if (e.kind === "chat_turn_finished" && e.session) {
      titleList.invalidateEmpty(e.session);
      if (view?.() === "c:" + e.session) void loadChat(e.session, { afterTurn: true });
    }
  }));

  return {
    dispose: scope.dispose, leaveList: titleList.stop,
    /** @param {string} v */
    isChats: (v) => v === "chats" || v?.startsWith("c:") === true,
    /** @returns {"waiting" | "working" | ""} whether a direct chat waits on you, else whether one is working */
    live: () => { const all = sessions(); return all.some(waiting) ? "waiting" : all.some(inTurn) ? "working" : ""; },
    /** @param {string} v */
    open(v) { if (v === "chats" || !C.list) loadList(); if (v.startsWith("c:")) loadChat(v.slice(2)); },
    /** @param {string} v */
    items: (v) => (v === "chats" ? chatListItems(workspace?.() ?? null) : chatItems(v.slice(2))),
    /** Your chats, grouped for the panel; null until the list is read. A filter reads titles not yet read. @param {string} v */
    groups: (v, q = "") => {
      const rows = sessions().sort(recentFirst);
      if (!scope.signal.aborted) titleList.observe(rows, q);
      return !C.list && !rows.length ? null : chatGroups(v, { rows, waiting, inTurn, heldOf, heldShort, rowLine, titleFor, world, rowTime, agentName: cliName });
    },
    /** Why the panel has no chats to list: still reading, or couldn't. */
    listNote: () => (C.err ? `Couldn't read your chats: ${C.err}` : "Reading your chats…"),
    headHtml, targetHtml, permTitle, confirmHtml, resolveConfirm,
    /** @param {string} v */
    placeholder: (v) => (v === "chats" ? "Ask anything, or @ a project to work in it…" : session(v.slice(2))?.retired_at ? "This chat has ended" : "Reply in this chat…"),
    /** @param {string} v */
    session: (v) => (v && v.startsWith("c:") ? session(v.slice(2)) : null),
    /** @param {string} v */
    busy: (v) => { const s = v && v.startsWith("c:") ? session(v.slice(2)) : null; return !!(s && inTurn(s)); },
    /** Working now (not waiting on you): the typing line shows only then. @param {string} v */
    working: (v) => { const s = v && v.startsWith("c:") ? session(v.slice(2)) : null; return !!(s && inTurn(s) && !waiting(s)); },
    /** Why this chat can't take a message, if it can't. @param {string} v */
    blocked: (v) => { const s = v && v.startsWith("c:") ? session(v.slice(2)) : null; return s && s.retired_at ? "This chat has ended" : ""; },
    send, openSetup, closeSetup, setPref, renderSetup, chipHtml, chipTitle,
    permHtml,
    toggleSetup,
    /** @param {string} id */
    retry(id) { for (const [sid, list] of C.local) { const l = list.find((x) => x.id === id && x.status === "failed"); if (l) { deliver(l, sid); return; } } },
    /** A failed message taken back to edit: it leaves the chat and its text is returned. @param {string} id */
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
