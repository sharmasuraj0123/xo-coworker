// @ts-check

/** @typedef {Record<string, any>} Row */

/** Session states in which its agent is on a turn: a process starting it, running it or stopping it. @type {Set<string>} */
export const BUSY_STATES = new Set(["starting", "running", "stopping"]);
/** A session held back by a gate before its turn: no process, its message waits (heldOf). */
export const HELD_STATE = "queued";
const RUN_ENDED = new Set(["finished", "failed", "stopped", "lost"]);
/** A sub-agent run the stream said started and hasn't said ended; a hidden one isn't the person's to see. @param {Row | null | undefined} r */
export const runWorks = (r) => !!r && !r.ended_at && !RUN_ENDED.has(r.state) && !r.hidden;

/** What a read of a session says beyond its status: a sub-agent working on after the turn; undefined when the view has no `busy`. @param {Row | null | undefined} view @returns {boolean | undefined} */
export function readSub(view) {
  if (!view || typeof view.busy !== "boolean") return undefined;
  if (view.state === HELD_STATE) return false;
  return view.busy && !BUSY_STATES.has(view.state);
}

/** A session read's word on busy, to spread onto its record: {sub, readAt} when the view has `busy`, else {}. @param {Row | null | undefined} view */
export function sessionRead(view, now = Date.now()) {
  const sub = readSub(view);
  return sub === undefined ? {} : { sub, readAt: now };
}

/** A status from `b` stands later than one from `a`: by the stream's order when both have a seq (a read stands where it was sent), else by the moment. @param {Row} b @param {Row} a */
export function statusLater(b, a) {
  if (b.statusSeq != null && a.statusSeq != null && b.statusSeq !== a.statusSeq) return b.statusSeq > a.statusSeq;
  return (b.statusAt || 0) > (a.statusAt || 0);
}

/** A session that says queued, yet work is seen after that status came (a turn, a sub-agent the stream named, counts above none): Working. @param {Row | null | undefined} s @param {{ runs?: Row[], agg?: Row | null, turn?: Row | null }} [e] */
export function queuedButWorking(s, { runs = [], agg = null, turn = null } = {}) {
  if (!s || s.state !== HELD_STATE) return false;
  const at = s.statusAt || 0, seq = s.statusSeq ?? null;
  /** After the status: in the stream's order when both have a seq (a read's when sent), else by the moment. @param {number | null} xSeq @param {number | undefined} xAt */
  const after = (xSeq, xAt) => (xSeq != null && seq != null ? xSeq > seq : (xAt || 0) > at);
  if (turn && turn.status !== "ended" && (seq == null || (turn.seq ?? -1) > seq)) return true;
  // a run counts only as the stream named it (seenSeq): a runs list read holds runs whose end was never written
  for (const r of runs) if ((r.session == null || r.session === s.id) && runWorks(r) && r.seenSeq != null && after(r.seenSeq, r.seen)) return true;
  return !!(agg && after(agg.seq ?? null, agg.at) && (agg.running || 0) + (agg.waiting || 0) > 0);
}

/** Is a session's agent at work: never while it waits on you; queued only with work seen since; on a turn; or a sub-agent at work after it. @param {Row | null | undefined} s @param {{ runs?: Row[], agg?: Row | null, turn?: Row | null }} [e] */
export function sessionBusy(s, { runs = [], agg = null, turn = null } = {}) {
  if (!s) return false;
  if (s.state === "waiting_on_person") return false;
  if (s.state === HELD_STATE) return queuedButWorking(s, { runs, agg, turn });
  if (BUSY_STATES.has(s.state)) return true;
  const readAt = s.readAt || 0;
  const counted = agg && (agg.at || 0) >= readAt ? agg : null;
  const since = Math.max(readAt, counted ? counted.at || 0 : 0);
  for (const r of runs) if ((r.session == null || r.session === s.id) && runWorks(r) && (r.seen || 0) >= since) return true;
  if (counted) return (counted.running || 0) + (counted.waiting || 0) > 0;
  return s.sub === true;
}

/** What a gate can hold a session for (the session view's `waiting.for`). */
export const HELD_FOR = new Set(["limit", "paid", "near_limit", "memory", "founder"]);

/** What a session held back by a gate waits for ({for, until, why, asked}), or null: the backend's `waiting` first, else its pool's state. @param {Row | null | undefined} s @param {Record<string, Row>} [pools] */
export function heldOf(s, pools = {}) {
  if (!s || s.state !== HELD_STATE) return null;
  const w = s.waiting;
  const asked = (/** @type {Row | null | undefined} */ p) => !!p && p.state === "paid" && p.reason === "paid_asked";
  if (w && typeof w === "object") {
    const p = (w.pool || s.pool) ? (pools || {})[w.pool || s.pool] : null;
    const until = w.until || (w.for === "limit" && p && p.state === "closed" && p.resets_at) || null;
    return { for: HELD_FOR.has(w.for) ? w.for : null, until, why: w.why ? String(w.why) : null, asked: w.for === "paid" && asked(p) };
  }
  const p = s.pool ? (pools || {})[s.pool] : null;
  if (p && p.state === "closed") return { for: "limit", until: p.resets_at || null, why: null, asked: false };
  if (p && p.state === "paid") return { for: "paid", until: null, why: null, asked: asked(p) };
  if (p && p.state === "warn") return { for: "near_limit", until: null, why: null, asked: false };
  return { for: null, until: null, why: null, asked: false };
}

/** The pools that can hold work back now: a pool counts only when its account is its runtime's account now (an old login's pool doesn't). @param {Record<string, Row> | null | undefined} pools @param {Row[] | null | undefined} runtimes @returns {Row[]} */
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

/** The runtime this server is for: the one marked `default`, else the first connected, else the first listed; null when none. @param {Row[] | null | undefined} rts @returns {Row | null} */
export const mainRuntime = (rts) => (rts || []).find((r) => r.default) || (rts || []).find((r) => r.cli && r.cli.logged_in && !r.error) || (rts || [])[0] || null;
