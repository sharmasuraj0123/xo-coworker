// @ts-check

// The fake Space's store: a seed (e2e/seeds/*.json) as xo-space's rows, and every /api request answered from them.

/** @import { Seed, Store, Row, Ask, Answer, Frame } from "./types.d.ts" */
import { createApps, answerApps } from "./apps.mjs";

const QUIET_POLICY = { allowed: null, default: null, preferences: null, fallback: null };

/** xo-space's chat row, filled in from a seed's short one. @param {Row} c @param {string} now @returns {Row} */
export function chatRow(c, now) {
  return { id: c.id, kind: c.kind, project: c.project ?? null, project_pid: c.project ? `pid_${c.project}` : null, created_at: c.created_at || now, settings: {}, retired_at: null, routing: null, pin: { agent: null, model: null, effort: null }, seen: null, ...c };
}

/** Reads that never change in a quiet Space. @param {string} now @returns {Record<string, unknown>} */
function quiet(now) {
  return {
    "/api/chat/status": { sessions: { by_state: { cold: 0, running: 0, warm: 0 }, live: 0, warm: 0, released: 0, parked: 0, held_back: [], paused: {}, store_failed: [], backing_off: {}, waiting_for_decision: {} }, queue: { by_priority: { now: 0, next: 0, later: 0 }, by_pool: {}, waiting: {} }, pools: [] },
    "/api/chat/shape": { shape: { shape: 1, preset: "everything" }, version: "e2e", updated_at: now },
    "/api/terminal/status": { enabled: false, reason: "off in tests", max_sessions: 0, detached_ttl_seconds: 0, running: 0, attached: 0 },
    "/api/terminal/sessions": { terminals: [] },
    "/api/chat/sessions": { sessions: [], next_after_seq: null },
    "/api/chat/active": { turns: [] },
    "/api/chat/review": { items: [], next_after_seq: null },
    "/api/chat/events": { events: [], next_before_seq: null, next_after_seq: null },
    "/api/chat/runtimes": { runtimes: [{ name: "claude_code", default: true, health: { agent: "claude_code", usable: true, why_not: null, installed: true, logged_in: true, account: "acct-test", cli_version: "1.0", pool: "claude_code:acct-test", limit: "open", resets_at: null, windows: {}, error: null, checked_at: now }, cli: { version: "1.0", logged_in: true, account: "acct-test", limits: {} }, features: { agent: "claude_code", cli_version: "1.0", contract_version: "1.0", features: { model: { support: "native", values: [] }, effort: { support: "native", values: [] } } } }] },
    "/api/chat/runtime-policy": { space: QUIET_POLICY, effective: { ...QUIET_POLICY, fallback: false } },
    "/api/chat/router": { mode: "agent", decision_model: null, abstain_below: 0.5 },
    "/api/config/workspace": { roots: { home: "/home/test" }, default: "home" },
    "/api/connectors/github/status": { status: "needs_auth" },
    "/api/advisory": { accounts: [] },
    "/api/chat/intent": { intents: [], pools: [] },
  };
}

const MODELS = [
  { id: "default", name: "Default", efforts: ["low", "medium", "high"], default_effort: null, context_window: null, is_default: true, takes_effort: true, family: null, family_default: false, description: "The CLI's own choice" },
  { id: "opus", name: "Opus", efforts: ["low", "medium", "high"], default_effort: null, context_window: null, is_default: false, takes_effort: true, family: "opus", family_default: true, description: "For complex work" },
  { id: "sonnet", name: "Sonnet", efforts: ["low", "medium", "high"], default_effort: null, context_window: null, is_default: false, takes_effort: true, family: "sonnet", family_default: true, description: "Efficient" },
];

/** A seed as the store; the seed is copied, never changed. @param {Seed} [seed] @returns {Store} */
export function createStore(seed = {}) {
  /** @type {Seed} */
  const s = structuredClone(seed);
  const now = s.now || "2026-11-19T12:00:00Z";
  const chats = (s.chats || [{ id: "chat_ws", kind: "workspace" }, { id: "chat_demo", kind: "project", project: "demo" }]).map((c) => chatRow(c, now));
  let top = 0, last = 0;
  /** @type {Set<number>} */
  const seqs = new Set();
  /** @type {(row: Row, chatId: string | null, where: string) => Row} */
  const fill = (row, chatId, where) => {
    const seq = row.seq ?? Math.max(top, last) + 1;
    if (seq <= last) throw new Error(`seed: ${where} has seq ${seq} after ${last}; rows go in seq order`);
    if (seqs.has(seq)) throw new Error(`seed: seq ${seq} is used twice (${where})`);
    seqs.add(seq);
    last = seq;
    top = Math.max(top, seq);
    return { chat_id: chatId, thread_ts: null, author_kind: "owner", author_id: "owner", created_at: now, extra: {}, ...row, seq };
  };
  /** @type {Record<string, Row[]>} */
  const messages = {};
  /** @type {Record<string, Row[]>} */
  const threads = {};
  /** @type {Record<string, Row[]>} */
  const threadMessages = {};
  for (const [id, rows] of Object.entries(s.messages || {})) { last = 0; messages[id] = rows.map((r) => fill(r, id, `messages.${id}`)); }
  for (const [id, rows] of Object.entries(s.threads || {})) threads[id] = rows.map((r) => ({ chat_id: id, label: null, resolved_at: null, session_id: null, cwd: null, branch: null, worktree_path: null, status_md: null, outputs: [], created_at: now, updated_at: now, summary: null, state: "done", activity: null, wait_reason: null, card: null, agent_ms: 0, git: null, ...r }));
  /** @param {string} ts */
  const chatOf = (ts) => Object.keys(threads).find((id) => threads[id].some((t) => t.ts === ts)) || null;
  for (const [ts, rows] of Object.entries(s.threadMessages || {})) { last = 0; threadMessages[ts] = rows.map((r) => fill({ thread_ts: ts, ...r }, r.chat_id || chatOf(ts), `threadMessages.${ts}`)); }
  return {
    now, chats, messages, threads, threadMessages,
    files: s.files || {},
    routes: s.routes || {},
    statics: quiet(now),
    apps: createApps(s.apps),
    seq: Math.max(0, ...seqs),
    writes: [],
    misses: [],
  };
}

/** The folders and files straight under `rel`, as /tree lists them. @param {Record<string, string>} files @param {string} rel */
export function treeOf(files, rel) {
  const pre = rel ? rel.replace(/\/$/, "") + "/" : "";
  /** @type {Set<string>} */
  const dirs = new Set();
  /** @type {{name: string, relative_path: string, size_bytes?: number}[]} */
  const out = [];
  for (const [p, text] of Object.entries(files || {})) {
    if (!p.startsWith(pre)) continue;
    const rest = p.slice(pre.length), cut = rest.indexOf("/");
    if (cut < 0) out.push({ name: rest, relative_path: p, size_bytes: Buffer.byteLength(String(text)) });
    else dirs.add(rest.slice(0, cut));
  }
  /** @type {(a: {name: string}, b: {name: string}) => number} */
  const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return { dirs: [...dirs].map((d) => ({ name: d, relative_path: pre + d })).sort(byName), files: out.sort(byName) };
}

/** @type {(status: number, code: string, message: string) => Answer} */
const err = (status, code, message) => ({ status, body: { detail: { code, message } } });
/** @type {(body: unknown, status?: number) => Answer} */
const ok = (body, status = 200) => ({ status, body });

/** One request's answer, and the frames the Space streams because of it. @param {Store} st @param {Ask} q @returns {{answer: Answer, frames: Frame[]}} */
export function answer(st, q) {
  const { method: m, path: p, query } = q;
  /** @type {Frame[]} */
  const frames = [];
  /** @param {Answer} a */
  const done = (a) => ({ answer: a, frames });
  const own = st.routes[`${m} ${p}`];
  if (own !== undefined) { if (m !== "GET") st.writes.push({ method: m, path: p, body: q.body }); return done(ok(own)); }
  if (m === "GET" && st.statics[p]) return done(ok(st.statics[p]));
  const app = answerApps(st.apps, q, frames);
  if (app) { if (m !== "GET") st.writes.push({ method: m, path: p, body: q.body }); return done(app); }
  if (m === "GET" && p === "/api/chat/chats") return done(ok({ chats: st.chats }));
  /** @type {RegExpExecArray | null} */
  let k;
  if ((k = /^\/api\/chat\/chats\/([^/]+)\/(threads|messages|hops|made|runtime-policy|memory)$/.exec(p)) && m === "GET") {
    const id = decodeURIComponent(k[1]);
    if (!st.chats.some((c) => c.id === id)) return done(err(404, "not_found", "No such chat"));
    if (k[2] === "threads") return done(ok({ threads: st.threads[id] || [] }));
    if (k[2] === "messages") {
      const ts = query.get("thread");
      const rows = ts ? st.threadMessages[ts] || [] : st.messages[id] || [];
      return done(ok({ messages: rows, next_after_seq: st.seq, next_before_seq: null }));
    }
    if (k[2] === "made") return done(ok({ made: [], next_before: null }));
    if (k[2] === "memory") return done(ok({ files: [] }));
    if (k[2] === "runtime-policy") return done(ok({ space: QUIET_POLICY, project: QUIET_POLICY, effective: { ...QUIET_POLICY, fallback: false } }));
    return done(ok({ hops: [], next_after_seq: null, next_before_seq: null }));
  }
  if ((k = /^\/api\/chat\/chats\/([^/]+)\/threads\/([^/]+)$/.exec(p)) && m === "GET") {
    const ts = decodeURIComponent(k[2]);
    const row = (st.threads[decodeURIComponent(k[1])] || []).find((t) => t.ts === ts);
    return done(row ? ok(row) : err(404, "not_found", "No such thread"));
  }
  if (/^\/api\/chat\/runtimes\/[^/]+\/models$/.test(p) && m === "GET") return done(ok({ name: "claude_code", models: MODELS }));
  if ((k = /^\/api\/chat\/chats\/([^/]+)\/messages$/.exec(p)) && m === "POST") {
    const id = decodeURIComponent(k[1]), b = /** @type {Record<string, unknown>} */ (q.body || {});
    st.writes.push({ method: m, path: p, body: b });
    st.seq += 1;
    const ts = typeof b.thread_ts === "string" ? b.thread_ts : null;
    const row = { id: `msg_e2e_${st.seq}`, chat_id: id, thread_ts: ts, seq: st.seq, author_kind: "owner", author_id: "owner", text: String(b.text ?? ""), created_at: st.now, client_id: b.client_id ?? null, extra: {} };
    const list = ts ? (st.threadMessages[ts] ||= []) : (st.messages[id] ||= []);
    list.push(row);
    frames.push({ type: "message", data: row, chat_id: id, thread_ts: row.thread_ts, seq: row.seq });
    return done(ok(row));
  }
  if ((k = /^\/api\/chat\/chats\/([^/]+)\/seen$/.exec(p)) && m === "PUT") {
    const id = decodeURIComponent(k[1]);
    const c = st.chats.find((x) => x.id === id);
    if (!c) return done(err(404, "not_found", "No such chat"));
    st.writes.push({ method: m, path: p, body: q.body });
    c.seen = { seen_at: st.now, seen_seq: st.seq };
    return done(ok({ seen: c.seen }));
  }
  if ((k = /^\/api\/deploy\/([^/]+)\/check$/.exec(p)) && m === "GET") {
    const id = decodeURIComponent(k[1]);
    if (!st.chats.some((c) => c.project === id)) return done(err(404, "not_found", "No such project"));
    return done(ok({ schema: 1, project: id, state: "needs-agent", summary: "Needs preparing.", reasons: [{ what: "A Dockerfile", why: "Nothing builds an image yet" }], blockers: [], warnings: [], config: null, config_error: null,
      fields: { name: { value: id, source: "the project folder" }, port: { value: null, source: "" }, health_path: { value: null, source: "default" }, env: [], repo: { full_name: null, remote: null, branch: "main", origin: null, new_repo_name: id }, size: { value: null, source: "the template's default" }, storage: { value: null, source: "none" } },
      git: { repo: false, branch: null, head: null, deployed_head: null, origin_github: null },
      prerequisites: { github_connected: false, github_source: null, launchpad_key: false, launchpad_cli: false }, running: null, last: null }));
  }
  if ((k = /^\/api\/xo-projects\/([^/]+)\/changes$/.exec(p)) && m === "GET") {
    const id = decodeURIComponent(k[1]);
    return done(ok({ project_id: id, worktree: null, root: `/home/test/${id}`, base_ref: "HEAD", base_commit: "c0", base_source: "head", head_commit: "c0", computed_at: st.now, truncated: false, total_files: 0, files: [] }));
  }
  if ((k = /^\/api\/xo-projects\/([^/]+)\/(tree|file)$/.exec(p)) && m === "GET") {
    const id = decodeURIComponent(k[1]);
    if (!st.chats.some((c) => c.project === id)) return done(err(404, "not_found", "No such project"));
    const files = st.files[id] || {};
    const rel = query.get("relative_path") || "";
    if (k[2] === "tree") return done(ok({ project_id: id, relative_path: rel,
      parent_relative_path: rel ? rel.split("/").slice(0, -1).join("/") : null, ...treeOf(files, rel) }));
    if (!(rel in files)) return done(err(404, "not_found", "No such file"));
    const content = String(files[rel]);
    return done(ok({ project_id: id, relative_path: rel, kind: "code", name: rel.split("/").pop(), content,
      version: `sha256:e2e-${content.length}`, editable: true, size_bytes: Buffer.byteLength(content), place: "ordinary", truncated: false }));
  }
  if (m !== "GET") {
    st.writes.push({ method: m, path: p, body: q.body, unknown: true });
    return done(err(405, "not_in_seed", `e2e: ${m} ${p} isn't answered by this seed`));
  }
  st.misses.push(`${m} ${p}`);
  return done(err(404, "not_found", "not in the seeded store"));
}
