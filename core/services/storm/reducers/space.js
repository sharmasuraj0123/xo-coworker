// @ts-check
import { invalidField, rejectFrame } from "../frame-failures.js";
import { isChat, isHop } from "../../../platform/chat-responses.js";
import { isRouter } from "../../../platform/runtime-responses.js";
import { text } from "../../world/frame-values.js";

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Reducer} */
const file = (ctx, env, d, tid, type) => { ctx.event({ kind: "file", type, data: d }); };

/** @type {Record<string, Reducer>} */
export const space = {
  // a file changed on disk (Space's watcher and version store): the open file takes it in
  "file.version": file,
  "file.version.attributed": file,
  "file.rescan": file,
  // creation: the hop without its note; a state move: {id, state}
  hop(ctx, env, d) {
    if (!isHop(d)) return rejectFrame(ctx, "hop", invalidField(d, { id: "" }, isHop));
    const old = ctx.state.hops.get(d.id);
    if (old || d.kind) { ctx.putHop({ ...d, id: d.id }, { seq: old?.seq ?? env.seq ?? null, at: old?.at || env.ts }); ctx.emitSoon(); }
    // a move for a hop not read yet (a cold load, its history still on the way) is held for it
    else if (d.id && d.state) ctx.holdMove(d.id, d.state);
    // the open thread shows what its hops say: read the new one's note
    if (d.kind && d.thread_ts && ctx.isWatched(d.thread_ts)) ctx.hopsSoon(d.thread_ts);
  },
  chat(ctx, env, d) {
    if (!isChat(d)) return rejectFrame(ctx, "chat", invalidField(d, { id: "" }, isChat));
    ctx.noteChat(d);
  },
  settings(ctx, env, d) {
    if (d.key === "router") {
      if (d.value !== null && !isRouter(d.value)) return rejectFrame(ctx, "settings", "router");
      ctx.state.router = d.value;
      ctx.emit();
    }
    // the person's shape changed on a device (this one's own write echoes too): the shape store decides
    else if (d.key === "ui.shape") ctx.event({ kind: "shape", value: d.value ?? null });
  },
  // a runtime was installed, signed in or changed account: read the runtimes again
  "runtimes.changed"(ctx) { ctx.refreshRuntimes(); },
  pool(ctx, env, d) {
    const { state } = ctx;
    if (typeof d.pool !== "string" || !d.pool) return rejectFrame(ctx, "pool", "pool");
    const fresh = !(d.pool in state.pools);
    const sig = ctx.poolsSig();
    const old = state.pools[d.pool];
    state.pools[d.pool] = { ...old, pool: d.pool,
      state: "state" in d ? text(d.state) ?? null : old?.state,
      resets_at: "resets_at" in d ? text(d.resets_at) ?? null : old?.resets_at,
      reason: "reason" in d ? text(d.reason) ?? null : old?.reason };
    if (ctx.poolsSeen && fresh) ctx.refreshRuntimes();
    if (ctx.poolsSig() !== sig) ctx.soon(); else ctx.emit();
  },
};
