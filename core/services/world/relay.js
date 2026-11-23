// @ts-check
import { uiMsg } from "./rows.js";

/** @typedef {{id: string, from_role: string, to_role: string, kind: string, state?: string, via?: string[], message_ids?: string[], thread_ts?: string, created_at: string, at: string, note?: string, cause?: string, seq?: number}} Hop */

/** @typedef {{id: string, chatId?: string | null}} MessageRef */

/** @typedef {{id: string, chat_id?: string, extra?: {forwarded_from?: {message_id?: string, chat_id?: string, root?: {message_id: string, chat_id?: string}}}}} ForwardRow */

/** @param {Hop} h @param {string} project @param {string | null} [onward] */
export function hopLine(h, project, onward = null) {
  /** @param {string} role */
  const who = (role) => (/** @type {Record<string, string>} */ ({ thread: "this thread", "project-coordinator": `the ${project} coordinator`, "workspace-coordinator": "the Workspace", xo: "XO", owner: "you", person: "you" }))[role] || "someone";
  const from = who(h.from_role), to = who(h.to_role);
  const state = h.state === "sent" ? " · not taken up yet" : h.state === "answered" ? " · answered" : "";
  /** @param {string} t */
  const up = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const via = h.via || [];
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

/** @param {{project?: string, worktree?: string, cwd?: string} | null | undefined} thread @param {string | null | undefined} path */
export function sharedFileRoute(thread, path) {
  const none = { why: "This file is in a folder XO doesn't serve to the UI yet." };
  if (!thread || !thread.project) return none;
  let p = String(path || "").replace(/\\/g, "/");
  const root = String(thread.worktree || thread.cwd || "").replace(/\/+$/, "");
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

/** @type {Record<string, string>} */
const COORD_WORD = { "project-coordinator": "project", "workspace-coordinator": "workspace" };
/** @type {Record<string, string>} */
const DOWN_KINDS = { brief: "brief", relay: "follow-up", answer: "answer" };
const UP_KINDS = new Set(["relay", "ask"]);

/** @param {{id: string}} thread @param {readonly (Hop | null)[] | null} hops */
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

/** @param {MessageRef & {root?: MessageRef}} fwd @param {(id: string, chatId?: string | null) => ForwardRow | null | undefined} find */
export function forwardOrigin(fwd, find, max = 6) {
  /** @param {MessageRef} r */
  const at = (r) => ({ chatId: r.chatId || null, id: r.id });
  /** @param {MessageRef} r */
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

/** @param {{id: string}} thread @param {readonly (Hop | null)[] | null} hops @param {readonly {id: string}[]} timeline @param {Set<string>} [have] @param {ReadonlyMap<string, {id: string}> | null} [found] */
export function relayedInto(thread, hops, timeline, have = new Set(), found = null) {
  const shown = [], missing = [], seen = new Set(have);
  for (const hp of hops || []) {
    if (!hp || hp.thread_ts !== thread.id || hp.to_role !== "thread" || !(hp.message_ids || []).length) continue;
    const lost = [];
    for (const id of /** @type {string[]} */ (hp.message_ids)) {
      if (seen.has(id)) continue;
      const row = timeline.find((r) => r.id === id) || (found && found.get(id));
      if (!row) { lost.push(id); continue; }
      seen.add(id);
      shown.push({ ...uiMsg(row), hop: { id: hp.id, seq: hp.seq ?? null, at: Date.parse(hp.created_at || hp.at) || 0 } });
    }
    if (lost.length) missing.push({ ids: lost, seq: hp.seq ?? null });
  }
  return { shown, missing };
}
