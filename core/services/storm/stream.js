// @ts-check
import { client, coderHeaders, SSEStream } from "./client.js";
import { createTurns } from "../world/turns.js";
import { RUNS_KEEP } from "./config.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Frame} Frame */

/** Boot: open the stream from "now", hold its frames, GET everything, apply the held frames in order; then the stream alone. @param {Ctx} ctx */
export function startStorm(ctx) {
  const { state, rawThreads, chatProject, watched, trimmed, framesBefore, emit } = ctx;
  /** @type {Frame[]} */
  let held = [];
  /** @type {SSEStream | null} */
  let stream = null;
  /** @type {(v?: unknown) => void} */
  let firstFrame = () => {};
  const sawFrame = new Promise((r) => { firstFrame = r; });

  /** @param {Frame} f */
  function onFrame(f) {
    firstFrame();
    // where the stream stands, even while its frames are held: a read sent now stands there (the snapshot's seq before any stored frame)
    const fe = f.envelope || {}, at = fe.seq ?? (f.type === "snapshot" && fe.data ? fe.data.seq : null);
    if (at != null && at > state.lastSeq) state.lastSeq = at;
    if (ctx.holding) { held.push(f); return; }
    ctx.apply(f);
  }

  /** @type {ReturnType<typeof setTimeout> | null} */
  let recoverT = null;
  /** The first load failed (storm restarting, the server down): try again until it works. */
  ctx.scheduleRecover = (ms = 8000) => {
    if (recoverT) return;
    recoverT = setTimeout(async () => { recoverT = null; await ctx.recover(); }, ms);
  };
  /** @type {Promise<void> | null} */
  let recovering = null;
  ctx.recover = async () => {
    if (recovering) return recovering;
    if (!state.error && state.projects.length) return;
    recovering = (async () => {
      ctx.holding = true;
      /** Live updates wait at most 15 s for the reload, so a hung GET doesn't freeze the page. @type {ReturnType<typeof setTimeout> | undefined} */
      let cutoff;
      try { await Promise.race([ctx.loadAll(), new Promise((r) => { cutoff = setTimeout(r, 15000); })]); } finally {
        clearTimeout(cutoff);
        ctx.commit();
        ctx.holding = false;
        for (const f of held.splice(0)) ctx.apply(f);
        ctx.commit(); emit();
      }
    })();
    try { await recovering; } finally { recovering = null; }
  };

  // a reset for retention or a replaced store: the thread list is refreshed in place (no false "new thread" lines); what's on screen loads again
  async function reload() {
    state.timeline = {}; state.hist = {}; state.threadMsgs = {}; state.threadHist = {}; state.found = {}; framesBefore.clear();
    ctx.clearSought();
    state.review.clear(); state.routed = {}; state.turns = createTurns();
    await ctx.loadAll();
    for (const [ts, r] of rawThreads) if (!chatProject.has(r.chat_id)) rawThreads.delete(ts);
    await Promise.all([...watched.projects].map((p) => ctx.loadTimeline(p)));
    if (watched.thread) await ctx.loadThread(watched.thread);
    if (watched.side && watched.side !== watched.thread) await ctx.loadThread(watched.side);
    ctx.commit(); emit();
  }

  function startStream() {
    stream = new SSEStream(client.streamUrl(), {
      headers: coderHeaders,
      onFrame,
      onState: (/** @type {string} */ s, /** @type {any} */ info) => {
        state.conn = s; state.connInfo = info;
        if (s === "live" && state.loaded) { ctx.loadStatus(); if (state.error || !state.projects.length) ctx.recover(); }
        emit();
      },
      onReset: async () => { await reload(); },
    }).start();
  }

  async function boot() {
    startStream();
    /** The snapshot frame means the subscription is in place; later frames are held during the load. @type {ReturnType<typeof setTimeout> | undefined} */
    let fallback;
    await Promise.race([sawFrame, new Promise((r) => { fallback = setTimeout(r, 4000); })]).finally(() => clearTimeout(fallback));
    await Promise.all([ctx.loadAll(), ctx.loadStatus()]);
    ctx.commit();
    ctx.holding = false;
    for (const f of held.splice(0)) ctx.apply(f);
    ctx.commit();
    state.loaded = true;
    emit();
  }
  boot();
  setInterval(() => {
    const keep = new Set();
    for (const ts of [watched.thread, watched.side]) { const t = ts && rawThreads.get(ts); if (t && t.session_id) keep.add(t.session_id); }
    if (watched.session) keep.add(watched.session); // an open plain chat keeps its turns
    for (const sid of state.turns.prune(keep)) trimmed.add(sid);
    // sub-agents: keep every live one and the open thread's; the rest only up to a bounded log
    const ended = [...state.runs.values()].filter((r) => !["running", "waiting"].includes(r.state) && !keep.has(r.session));
    if (ended.length > RUNS_KEEP) for (const r of ended.sort((a, b) => String(a.ended_at || "").localeCompare(String(b.ended_at || ""))).slice(0, ended.length - RUNS_KEEP)) state.runs.delete(r.id);
  }, 60000);
  addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    stream && stream.nudge();
    ctx.loadStatus();
    ctx.maybeChats();
  });
  addEventListener("online", () => stream && stream.nudge());

  return { stop: () => { stream && stream.close(); ctx.stopTimers(); } };
}
