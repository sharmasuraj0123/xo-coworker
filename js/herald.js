// The dock line's lines (the herald): what's on screen (state.herald), what waits (the queue), and how a newer line
// meets an older one. Moved here from app.js so tests run the real thing (Astra on dfe1491: a message's notice kept
// "Not sent" through a successful Retry, which tests that only read the source didn't catch).
//   An Undo is never pushed out of reach by a newer line; a passing line yields to an Undo, and to an own kind.

export const OWN = new Set(["sent", "started", "ready", "clear", "rec", "halt"]);

/**
 * state: an object holding .herald (the line on screen, or null); schedule(): draw again; now(): the clock;
 * setTimer / clearTimer: for the line's end.
 */
export function createHerald({ state, schedule = () => {}, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  // Lines waiting for an Undo on screen to end: an Undo is never pushed out of reach by a newer line.
  const HQ = [];
  let timer = 0;
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
  /** A message's own notice, changed in place: on screen, or still waiting in the queue. make(h) gives the new one;
   *  ms its time (on screen: what's left, at least 4 s). False when this message has no notice now. */
  function forMsg(mid, make, ms = null) {
    const t = now();
    if (state.herald && state.herald.mid === mid && state.herald.until > t) { put(make(state.herald), ms ?? Math.max(4000, state.herald.until - t)); return true; }
    const q = HQ.find((x) => x.h.mid === mid);
    if (q) { q.h = make(q.h); if (ms) q.ms = ms; return true; }
    return false;
  }
  function put(h, ms) {
    state.herald = { ...h, until: now() + ms, n: (state.herald?.n || 0) + 1 };
    clearTimer(timer);
    timer = setTimer(next, ms + 40);
    schedule();
  }
  /** The line on screen ended (or was cleared): the next waiting line. Undo lines first, in order; then forced
   *  lines (a message that didn't go), each in its turn, oldest first, never merged away; of the rest only the newest
   *  shows (each was already announced). Astra on dfe1491 (C111-SEND-NOTICE-QUEUE-1): a failure queued behind an
   *  Undo was cleared with the passing receipts when the Undo ended. */
  function next() {
    if (state.herald && state.herald.until > now() && state.herald.undo) return;
    const iu = HQ.findIndex((x) => x.h.undo), fi = HQ.findIndex((x) => x.h.force);
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
  return { show, forMsg, put, next, HQ };
}

/**
 * A message's own notice for each of its states, set whole every time (never a text edit of the last one): out
 * ("Sending to …"), sent ("Sent to …"), failed ("Not sent: <why>", forced: it never yields to a passing line). m.to:
 * where it went, in words; m.conv: its conversation.
 */
export function noticeFor(m, phase) {
  const to = m.to || "the conversation";
  if (phase === "failed") return { kind: "stopped", text: `Not sent: ${(m.err && m.err.title) || "it didn't go"}`, sub: "open the conversation to retry", open: m.conv, mid: m.id, force: true };
  if (phase === "sent") return { kind: "sent", text: `Sent to ${to}`, sub: "open to follow the reply", open: m.conv, mid: m.id };
  return { kind: "sent", text: `Sending to ${to}…`, sub: "open to follow it", open: m.conv, mid: m.id };
}
