// @ts-check

/** @typedef {Record<string, any>} Notice @typedef {{ h: Notice, ms: number }} Waiting */

/** A line's own kinds: a passing line yields to them. */
export const OWN = new Set(["sent", "started", "ready", "clear", "rec", "halt"]);

/** The dock line's notices: the one on screen (state.herald), the queue, and how a newer line meets an older one. @param {{ state: { herald: Notice | null }, schedule?: () => void, now?: () => number, setTimer?: (fn: () => void, ms: number) => any, clearTimer?: (t: any) => void }} o */
export function createHerald({ state, schedule = () => {}, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  /** Lines waiting for an Undo on screen to end: an Undo is never pushed out of reach by a newer line. @type {Waiting[]} */
  const HQ = [];
  /** @type {any} */
  let timer = 0;
  /** @param {Notice} h */
  function show(h, ms = 4200) {
    const t = now();
    const cur = state.herald && state.herald.until > t ? state.herald : null;
    const stops = h.tag === "stops";
    if (cur && cur.undo && !(stops && cur.tag === "stops")) {
      if (stops) {
        // a Stop's own Undo shows at once (its 3 s are already running); the line it covers comes back after
        HQ.unshift({ h: cur, ms: Math.max(3000, cur.until - t) });
      } else if (h.undo || h.force || OWN.has(h.kind)) { HQ.push({ h, ms }); return; }
      else return; // a passing notice yields to an Undo
    }
    // a passing line yields to an own kind, and to a forced line (a message that didn't go): it isn't pushed off
    if (!h.force && !h.undo && !stops && cur && (OWN.has(cur.kind) || cur.force) && !OWN.has(h.kind)) return;
    put(h, ms);
  }
  /** A message's own notice changed in place, on screen (at least 4 s left) or waiting; false when it has none now. @param {string} mid @param {(h: Notice) => Notice} make @param {number | null} [ms] */
  function forMsg(mid, make, ms = null) {
    const t = now();
    if (state.herald && state.herald.mid === mid && state.herald.until > t) { put(make(state.herald), ms ?? Math.max(4000, state.herald.until - t)); return true; }
    const q = HQ.find((x) => x.h.mid === mid);
    if (q) { q.h = make(q.h); if (ms) q.ms = ms; return true; }
    return false;
  }
  /** A notice that's no longer true goes, on screen or waiting (a refused resolve, once a later one went through). @param {string} mid */
  function drop(mid) {
    for (let i = HQ.length - 1; i >= 0; i--) if (HQ[i].h.mid === mid) HQ.splice(i, 1);
    if (state.herald && state.herald.mid === mid && state.herald.until > now()) { state.herald = { ...state.herald, until: 0 }; clearTimer(timer); next(); }
  }
  /** @param {Notice} h @param {number} ms */
  function put(h, ms) {
    state.herald = { ...h, until: now() + ms, n: (state.herald?.n || 0) + 1 };
    clearTimer(timer);
    timer = setTimer(next, ms + 40);
    schedule();
  }
  /** The next waiting line: Undo lines first, in order; then forced lines, oldest first, never merged away; of the rest only the newest. */
  function next() {
    if (state.herald && state.herald.until > now() && state.herald.undo) return;
    const iu = HQ.findIndex((x) => x.h.undo), fi = HQ.findIndex((x) => x.h.force);
    /** @type {Waiting | null} */
    let nx = null;
    if (iu >= 0) nx = HQ.splice(iu, 1)[0];
    else if (fi >= 0) nx = HQ.splice(fi, 1)[0];
    else if (HQ.length) { nx = HQ[HQ.length - 1]; HQ.length = 0; }
    if (!nx) { schedule(); return; }
    let { h, ms } = nx;
    // a line whose Undo has a deadline (h.undoUntil) comes back only for what is left of it, or without its Undo
    if (h.undo && h.undoUntil) {
      const left = h.undoUntil - now();
      if (left < 600) { h = { ...h, undo: null, undoUntil: 0 }; ms = Math.min(ms, 2400); } else ms = Math.min(ms, left);
    }
    put(h, ms);
  }
  return { show, forMsg, drop, put, next, HQ };
}

/** A message's own notice for each state, set whole every time: out, sent, failed (forced: it never yields to a passing line). @param {Notice} m @param {string} phase */
export function noticeFor(m, phase) {
  const to = m.to || "the conversation";
  if (phase === "failed") return { kind: "stopped", text: `Not sent: ${(m.err && m.err.title) || "it didn't go"}`, sub: "open the conversation to retry", open: m.conv, mid: m.id, force: true };
  if (phase === "sent") return { kind: "sent", text: `Sent to ${to}`, sub: "open to follow the reply", open: m.conv, mid: m.id };
  return { kind: "sent", text: `Sending to ${to}…`, sub: "open to follow it", open: m.conv, mid: m.id };
}

/** A send the gate refused before it went, shown as a message that didn't go: forced, with what was kept. @param {string} block */
export function refusedNotice(block, kept = "your words are kept") {
  return { kind: "stopped", text: `Not sent: ${block}`, sub: kept, force: true };
}
