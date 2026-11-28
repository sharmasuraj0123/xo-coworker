// @ts-check
import { rejectFrame } from "./frame-failures.js";
import { REDUCERS } from "./reducers/index.js";
import { isFrame } from "../../platform/chat-responses.js";
import { isRecord } from "../../platform/util.js";
import { client, coderHeaders, SSEStream } from "./client.js";
import { createTurns } from "../world/turns.js";
import { LOAD_CAP, RUNS_KEEP } from "./config.js";
import { mapLimit } from "./load.js";
import { resumeReadRetries, retryStep, scheduleReadRetry } from "./read-policy.js";
import { reportFailure } from "../notices/failures.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").Frame} Frame */

/** @param {Ctx} ctx */
function pruneHistory({ state, watched, rawThreads, trimmed }) {
  const keep = new Set();
  for (const ts of [watched.thread, watched.side]) { const t = ts && rawThreads.get(ts); if (t && t.session_id) keep.add(t.session_id); }
  if (watched.session) keep.add(watched.session); // an open plain chat keeps its turns
  for (const sid of state.turns.prune(keep)) { if (sid != null) trimmed.add(sid); }
  // sub-agents: keep every live one and the open thread's; the rest only up to a bounded log
  const ended = [...state.runs.values()].filter((r) => !["running", "waiting"].includes(r.state) && !keep.has(r.session));
  if (ended.length > RUNS_KEEP) for (const r of ended.sort((a, b) => String(a.ended_at || "").localeCompare(String(b.ended_at || ""))).slice(0, ended.length - RUNS_KEEP)) state.runs.delete(r.id);
}

/** Boot: open the stream from "now", hold its frames, GET everything, apply the held frames in order; then the stream alone. @param {Ctx} ctx */
export function startStorm(ctx) {
  const { state, rawThreads, chatProject, watched, framesBefore, emit, scope } = ctx;
  const { signal } = scope;
  /** @type {Frame[]} */
  let held = [];
  /** @type {SSEStream | null} */
  let stream = null;
  const subscribed = Promise.withResolvers();
  const releaseSubscription = scope.effect(() => () => subscribed.resolve(undefined));
  scope.effect(() => () => { held.length = 0; stream?.close(); });

  /** @param {import("../../platform/types").StreamFrame} frame */
  function onFrame({ type, id, envelope }) {
    if (signal.aborted) return;
    releaseSubscription();
    const raw = isRecord(envelope) ? { ...envelope, type } : { type };
    if (!isFrame(raw)) return rejectFrame(ctx, Object.hasOwn(REDUCERS, type) ? type : "stream", "envelope");
    const f = { type, id, envelope: raw };
    const fe = f.envelope, at = fe.seq ?? (type === "snapshot" && fe.data ? fe.data.seq : null);
    if (typeof at === "number" && at > state.lastSeq) state.lastSeq = at;
    if (ctx.holding) { held.push(f); return; }
    ctx.apply(f);
  }

  let recoveryScheduled = false;
  let attempt = 0;
  ctx.scheduleRecover = () => {
    if (recoveryScheduled) return true;
    if (signal.aborted) return false;
    const step = retryStep(attempt++);
    const cycle = ctx.reads;
    recoveryScheduled = true;
    const clear = cycle.effect(() => () => { recoveryScheduled = false; });
    scheduleReadRetry(cycle, step.delay, () => { clear(); void ctx.recover().catch(reportFailure); });
    return !step.report;
  };
  /** @type {Promise<void> | null} */
  let recovering = null;
  ctx.recover = async () => {
    if (signal.aborted) return;
    if (recovering) return recovering;
    if (!state.error && state.projects.length) return;
    recovering = (async () => {
      const cycle = ctx.renewReads();
      ctx.clearSought();
      ctx.holding = true;
      const cutoff = Promise.withResolvers();
      const cancelCutoff = cycle.timeout(() => cutoff.resolve(true), 15000);
      const release = cycle.effect(() => () => cutoff.resolve(false));
      const expired = await Promise.race([ctx.loadAll().then(() => false), cutoff.promise]).catch((error) => {
        if (!cycle.signal.aborted) reportFailure(error);
        return false;
      }).finally(() => { cancelCutoff(); release(); });
      if (cycle.signal.aborted) return;
      if (expired) { ctx.renewReads(); ctx.clearSought(); }
      if (!replayHeld()) return;
      if (!state.error) attempt = 0;
      emit();
      const { signal: current } = ctx.reads;
      void loadWatched(current).catch((error) => { if (!current.aborted) reportFailure(error); });
    })();
    try { await recovering; } finally { recovering = null; }
  };

  function replayHeld() {
    if (signal.aborted) return false;
    ctx.commit();
    ctx.holding = false;
    for (const frame of held.splice(0)) {
      if (signal.aborted) return false;
      ctx.apply(frame);
    }
    if (signal.aborted) return false;
    ctx.commit();
    return !signal.aborted;
  }

  /** @param {AbortSignal} readSignal */
  async function loadWatched(readSignal) {
    if (readSignal.aborted) return;
    await Promise.all([...watched.projects].map((project) => ctx.loadTimeline(project)));
    if (readSignal.aborted) return;
    if (watched.thread) await ctx.loadThread(watched.thread);
    if (!readSignal.aborted && watched.side && watched.side !== watched.thread) await ctx.loadThread(watched.side);
  }

  async function reload() {
    const cycle = ctx.renewReads();
    state.timeline = {}; state.hist = {}; state.threadMsgs = {}; state.threadHist = {}; state.found = {}; framesBefore.clear();
    ctx.clearSought();
    state.review.clear(); state.routed = {}; state.turns = createTurns();
    await ctx.loadAll();
    if (cycle.signal.aborted) return;
    for (const [ts, r] of rawThreads) if (!chatProject.has(r.chat_id)) ctx.threadRecords.remove(ts);
    await loadWatched(cycle.signal);
    if (cycle.signal.aborted) return;
    if (ctx.holding) {
      if (!replayHeld()) return;
    } else ctx.commit();
    if (cycle.signal.aborted) return;
    state.loaded = true;
    emit();
  }

  function startStream() {
    stream = new SSEStream(client.streamUrl(), {
      headers: coderHeaders,
      onError: reportFailure,
      onFrame,
      onState: (s, info) => {
        if (signal.aborted) return;
        state.conn = s; state.connInfo = info;
        if (s !== "connecting") releaseSubscription();
        if (s === "live" && state.loaded) {
          resumeReadRetries(ctx.reads.signal);
          if (state.error || !state.projects.length) void ctx.recover().catch(reportFailure);
          ctx.loadStatus();
        }
        emit();
      },
      onReset: async () => { await reload(); },
    });
    stream.start();
  }

  async function boot() {
    const cycle = ctx.reads;
    startStream();
    await subscribed.promise;
    if (cycle.signal.aborted) return;
    await Promise.all([ctx.loadAll(), ctx.loadStatus(), ctx.loadActive()]);
    if (cycle.signal.aborted || !replayHeld()) return;
    state.loaded = true;
    emit();
    await mapLimit(state.projects.filter((p) => p.kind === "project" && p.chatId), LOAD_CAP,
      async (p) => ctx.loadChatPolicy(p.chatId), cycle.signal);
  }
  scope.interval(() => pruneHistory(ctx), 60000);
  const events = typeof window === "undefined" ? globalThis : window;
  scope.listen(events, "visibilitychange", () => {
    if (document.hidden) return;
    resumeReadRetries(ctx.reads.signal);
    stream && stream.nudge();
    ctx.loadStatus();
    ctx.maybeChats();
  });
  scope.listen(events, "online", () => { resumeReadRetries(ctx.reads.signal); stream?.nudge(); });
  boot().catch((error) => { if (!signal.aborted) reportFailure(error); });
}
