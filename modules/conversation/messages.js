// @ts-check


import { uiMsg } from "../../core/services/world/rows.js";
import { echoes, threadAnchors, waitsForTurn, pageFloor, inPage } from "../../core/services/world/conversation.js";
import { forwardOrigin, hopLine, relayedInto, hopNotes } from "../../core/services/world/relay.js";
import { turnSegments, segmentTurn } from "./blocks/turn.js";

/** @import { Hop } from "../../core/services/world/relay.js" */
/** @import { Control, History, Message, ProjectionDeps, ProjectionThread, RelayRows, RoutedHop, StoredMessage, TimelineRow } from "./message-types.d.ts" */

/** @param {ProjectionDeps} deps */
export function createConversationMessages({ S, world, D, PROJ, convThread, chatOf, convProject, threadsOf }) {
  /** @param {string} conv @returns {Message[]} */
  return function messagesOf(conv) {
    /** @type {Message[]} */
    const out = [];
    const t = convThread(conv);
    const chat = chatOf(conv);
    const st = world.state;
    const h = chat ? st.hist[chat] : null;
    /** @type {StoredMessage[]} */
    let rows;
    if (t) {
      const root = (st.timeline[t.project] || []).find((r) => r.id === t.id) || st.found?.[t.project]?.get(t.id);
      rows = [...(root ? [/** @type {StoredMessage} */ (uiMsg(root))] : []), ...t.messages];
    } else rows = /** @type {StoredMessage[]} */ ((st.timeline[/** @type {string} */ (chat)] || []).map(uiMsg));
    const locals = S.local[conv] || [];
    for (const [lid, sid] of echoes(locals, rows, new Set(S.alias.keys()))) {
      S.alias.set(sid, lid);
      const m = /** @type {NonNullable<typeof locals[number]>} */ (locals.find((x) => x.id === lid));
      m.merged = true; m.status = "sent";
    }
    if (t && !t.loaded) {
      const err = st.threadHist?.[t.id]?.error;
      out.push({ key: "note", at: -Infinity, who: "note", ...(err ? { text: `Couldn't load this thread: ${err}` } : { load: "Loading the thread" }) });
      out.push(...locals.filter((m) => !m.merged).map((m) => ({ ...m, key: m.id })));
      return out;
    }
    if (!t && h) {
      if (h.error && !rows.length) out.push({ key: "note", at: -Infinity, who: "note", text: `Couldn't load this conversation: ${h.error} Retrying.` });
      else if (h.loading && !rows.length) out.push({ key: "note", at: -Infinity, who: "note", load: "Loading the conversation" });
      else if (rows.length || h.loading) out.push({ key: "hist", at: -Infinity, who: "hist", h });
    }
    const th = t ? st.threadHist && st.threadHist[t.id] : null;
    if (th && th.loaded && rows.length && (!th.all || th.paged)) out.push({ key: "hist", at: -Infinity, who: "hist", h: { loading: !!th.older, all: !!th.all, olderError: th.olderError || null, before: th.before } });
    const ids = t ? [] : world.state.threads.filter((x) => x.project === chat).map((x) => x.id);
    const { on, alone } = threadAnchors(rows, ids);
    const turn = t && t.busy && t.sessionId && st.turns ? st.turns.running(t.sessionId) : null;
    for (const m of rows) {
      const key = S.alias.get(m.id) || m.id;
      const base = { key, sid: m.id, at: m.at, seq: m.seq, text: m.text, sent: S.alias.has(m.id), files: m.files, chatId: m.chatId, reactions: m.reactions };
      if (m.who === "you" && !t && conv !== "ws" && m.fwd) {
        const o = forwardOrigin(m.fwd, (id, cid) => {
          const p = cid && world.act.projectOf ? world.act.projectOf(cid) : null;
          return p ? (st.timeline[p] || []).find((r) => r.id === id) || st.found?.[p]?.get(id) || null : null;
        });
        if (!o.known && world.act.findRows) { const p = o.chatId && world.act.projectOf ? world.act.projectOf(o.chatId) : null; if (p) world.act.findRows(p, [o.id], m.seq); }
        const mine = o.known ? (world.act.projectOf?.(o.chatId) === chat ? { id: o.id, text: o.row ? (/** @type {TimelineRow} */ (o.row)).text : m.text } : null)
          : rows.filter((x) => x.who === "you" && !x.fwd && x.id !== m.id && x.at < m.at && x.text && x.text === m.text).pop();
        if (mine) { out.push({ key, sid: m.id, at: m.at, seq: m.seq, who: "system", back: { id: mine.id, text: String(mine.text ?? m.text), via: m.fwd.via } }); continue; }
        out.push({ ...base, who: "you", fwd: o.known ? { chatId: o.chatId, id: o.id, via: m.fwd.via } : m.fwd, queued: waitsForTurn(m, turn) });
        if (alone.has(m.id)) out.push({ key: `${m.id}:card`, at: m.at, who: "card", thread: m.id });
      } else if (m.who === "you") {
        out.push({ ...base, who: "you", fwd: conv !== "ws" && m.fwd ? m.fwd : null, routed: conv === "ws" ? st.routed[m.id] || null : null, queued: waitsForTurn(m, turn) });
        if (alone.has(m.id)) out.push({ key: `${m.id}:card`, at: m.at, who: "card", thread: m.id });
      } else if (m.who === "system") out.push({ ...base, who: "system", passedOn: m.passedOn, continuedIn: m.continuedIn, continuedFrom: m.continuedFrom });
      else if (t && m.who === "agent" && /^✓\s/.test(m.text)) out.push({ key, at: m.at, who: "event", text: m.text.replace(/^✓\s*/, ""), tone: "ok" });
      else out.push({ ...base, who: m.who === "coord" ? "coord" : "agent", fwd: conv !== "ws" && m.fwd ? m.fwd : null, threads: on.get(m.id) || null });
    }
    if (conv.startsWith("p:")) {
      const pid = conv.slice(2);
      const since = h && !h.all ? rows.reduce((a, m) => (Number.isFinite(m.at) && m.at < a ? m.at : a), Infinity) : -Infinity;
      /** @param {number} at */
      const inView = (at) => !(at < since);
      for (const x of threadsOf(pid)) {
        if (!inView(x.lastAt)) continue;
        if (x.state === "done") out.push({ key: `${x.id}:done`, at: x.lastAt, who: "event", text: `${x.title} finished`, tone: "ok" });
        if (x.state === "failed") out.push({ key: `${x.id}:failed`, at: x.lastAt, who: "event", text: `${x.title} stopped`, tone: "stop" });
      }
      for (const d of D.decisions().filter((d) => d.project === pid && inView(d.at))) out.push({ key: `dec:${d.id}`, at: d.at, who: "event", text: `${d.verb} · ${d.said || d.label}`, tone: d.choice === "deny" ? "back" : "ok" });
      for (const d of D.notSent().filter((d) => d.project === pid && inView(d.at))) out.push({ key: `dec:${d.id}`, at: d.at, who: "event", text: `Not sent · ${d.said || d.label} · ${d.why}`, tone: "sys" });
    }
    if (t) for (const c of st.controls[t.id] || []) {
      const at = Date.parse(c.at) || 0;
      const note = c.action !== "steer" ? out.find((x) => x.who === "system" && !x.ctl && !x.continuedIn && !x.continuedFrom && !x.passedOn && /interrupt|stop/i.test(x.text || "") && Math.abs((x.at || 0) - at) < 15000) : null;
      if (note) { note.who = "control"; note.ctl = c; continue; }
      out.push({ key: `ctl:${c.seq ?? at}`, at, seq: c.seq, who: "control", ctl: c });
    }
    if (t) for (const it of t.limits || []) out.push({ key: `lim:${it.id}`, at: Date.now(), who: "limit", item: it });
    if (t && t.movedFrom && !rows.some((m) => m.continuedFrom)) out.push({ key: `mvfrom:${t.id}`, at: t.createdAt - 1, who: "system", text: "", continuedFrom: t.movedFrom.from });
    if (t && t.movedTo && t.movedTo.to && !rows.some((m) => m.continuedIn)) out.push({ key: `mvto:${t.id}`, at: Date.parse(/** @type {string} */ (t.movedTo.at)) || t.lastAt, who: "system", text: "", continuedIn: t.movedTo.to });
    if (t && st.hops) {
      const { shown, missing } = /** @type {RelayRows} */ (/** @type {unknown} */ (relayedInto(t, /** @type {Hop[]} */ (/** @type {unknown} */ (st.hops.values())), st.timeline[t.project] || [], new Set(rows.map((m) => m.id)), st.found?.[t.project])));
      /** @param {string | null | undefined} r */
      const who = (r) => (r === "workspace-coordinator" ? "Workspace coordinator" : r === "project-coordinator" ? `${PROJ(t.project)} coordinator` : null);
      for (const m of shown) {
        if (m.who === "you") out.push({ key: `relay:${m.id}`, at: m.hop.at || m.at, seq: m.hop.seq ?? m.seq, who: "you", text: m.text, files: m.files, chatId: m.chatId, wrote: m.at, relay: { project: t.project, id: m.id, fwd: m.fwd, at: m.hop.at || 0 } });
        else out.push({ key: `relay:${m.id}`, at: m.at, seq: m.seq, who: m.who, text: m.text, files: m.files, chatId: m.chatId, ...(who(m.role) ? { name: who(m.role), role: "passed on", coord: true } : {}) });
      }
      if (world.act.findRows) for (const x of missing) world.act.findRows(t.project, x.ids, x.seq);
    }
    const noted = new Set();
    if (t && st.hops) {
      for (const n of hopNotes(t, /** @type {Hop[]} */ (/** @type {unknown} */ (st.hops.values())))) {
        noted.add(n.id);
        if (n.dir === "down") out.push({ key: `hopn:${n.id}`, at: n.at, seq: n.seq, who: "coord", text: n.text, name: n.from === "workspace" ? "Workspace coordinator" : `${PROJ(t.project)} coordinator`, role: n.kind, cause: n.cause });
        else out.push({ key: `hopn:${n.id}`, at: n.at, seq: n.seq, who: "asked", text: n.text, hop: n.id });
      }
      for (const c of out.filter((x) => x.who === "control" && (/** @type {Control} */ (x.ctl)).action === "steer" && x.seq != null).sort((a, b) => (/** @type {number} */ (a.seq)) - (/** @type {number} */ (b.seq)))) {
        const note = out.filter((x) => x.who === "coord" && !x.lead && x.key.startsWith("hopn:") && (/** @type {number} */ (x.seq)) > (/** @type {number} */ (c.seq)) && x.at - c.at >= 0 && x.at - c.at < 10000).sort((a, b) => (/** @type {number} */ (a.seq)) - (/** @type {number} */ (b.seq)))[0];
        if (note) note.lead = c.key;
      }
    }
    if (t && S.showHops && st.hops) {
      for (const hp of st.hops.values()) {
        if (hp.thread_ts !== t.id || noted.has(hp.id)) continue;
        const text = hopLine(hp, PROJ(t.project));
        if (text) out.push({ key: `hop:${hp.id}`, at: Date.parse(hp.at || hp.created_at) || 0, seq: hp.seq ?? null, who: "system", text });
      }
    }
    if (t && t.sessionId && st.turns) {
      /** @type {{seq: number, at: number, who: string}[]} */
      const says = rows.filter((m) => m.seq != null && m.id !== t.id).map((m) => ({ seq: /** @type {number} */ (m.seq), at: m.at, who: /** @type {string} */ (m.who) }))
        .concat(out.filter((x) => x.seq != null && /^(hopn|relay|ctl|hop):/.test(x.key)).map((x) => ({ seq: /** @type {number} */ (x.seq), at: x.at, who: x.who })));
      const carried = rows.filter((m) => m.who !== "you").flatMap((m) => m.files || []);
      const tail = says.reduce((a, m) => (m.seq > a ? m.seq : a), 0) + 0.5;
      for (const tu of st.turns.list((x) => x.session === t.sessionId)) {
        const blocks = st.turns.blocksOf(tu);
        const said = says.some((q) => q.who === "agent" && q.seq >= (tu.seq ?? Infinity) && q.seq <= (tu.lastSeq || Infinity));
        for (const sg of turnSegments(tu, blocks, says)) {
          const turn = segmentTurn(tu, sg);
          const seq = tu.status === "running" && sg.last && sg.k > 0 && !sg.blocks.length ? Math.max(/** @type {number} */ (sg.seq), tail) : sg.seq;
          out.push({ key: sg.last ? `turn:${tu.id}` : `turn:${tu.id}#${sg.k}`, at: sg.from ?? (Date.parse(/** @type {string} */ (tu.at)) || Date.now()), seq, who: "turn", turn, blocks: sg.blocks, hideAnswer: said, carried, working: sg.k > 0 });
        }
      }
    }
    if (!t && chat && S.showHops && st.hops) {
      const cid = world.act.chatId?.(chat);
      /** @param {RoutedHop} hp */
      const mine = (hp) => hp.chat_id === cid || (hp.kind === "forward" && (/** @type {Map<string, RoutedHop>} */ (st.hops)).get(/** @type {string} */ (hp.cause))?.chat_id === cid);
      for (const hp of cid ? st.hops.values() : []) {
        if (hp.thread_ts != null || !mine(hp)) continue;
        const text = hopLine(hp, PROJ(chat), hp.kind === "forward" ? PROJ(world.act.projectOf?.(hp.chat_id) || "") : null);
        if (text) out.push({ key: `hop:${hp.id}`, at: Date.parse(hp.at || hp.created_at) || 0, seq: hp.seq ?? null, who: "system", text });
      }
    }
    const fail = !t && chat ? st.failed && st.failed[chat] : null;
    if (fail) out.push({ key: `fail:${fail.id}`, at: fail.at, who: "event", tone: "stop", text: `The coordinator couldn't answer: ${fail.error}` });
    if (!rows.length && !locals.some((m) => m.who === "you") && !(h && (h.loading || h.error))) {
      out.push(t || conv === "ws" ? { key: "empty", at: -Infinity, who: "note", text: t ? "No messages in this thread yet." : "No messages yet. Ask the coordinator anything below." } : { key: "empty", at: Infinity, who: "start", pid: convProject(conv) });
    }
    out.push(...locals.filter((m) => !m.merged).map((m) => ({ ...m, key: m.id })));
    const floor = t ? pageFloor(/** @type {History | null} */ (th), t.messages) : null;
    const floorAt = floor == null ? null : (/** @type {ProjectionThread} */ (t)).messages.find((m) => m.seq === floor)?.at ?? null;
    const shown = floor == null ? out : out.filter((m) => inPage(/** @type {NonNullable<Parameters<typeof inPage>[0]>} */ (m), floor, floorAt));
    const stored = shown.filter((m) => m.seq != null).sort((a, b) => (/** @type {number} */ (a.seq)) - (/** @type {number} */ (b.seq)));
    const rest = shown.filter((m) => m.seq == null).sort((a, b) => a.at - b.at);
    const merged = [];
    let i = 0;
    for (const m of stored) {
      while (i < rest.length && rest[i].at < m.at) merged.push(rest[i++]);
      merged.push(m);
    }
    while (i < rest.length) merged.push(rest[i++]);
    return merged;
  }
}
