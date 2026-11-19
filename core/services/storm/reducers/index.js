// @ts-check
import { messages } from "./messages.js";
import { threads } from "./threads.js";
import { sessions } from "./sessions.js";
import { runs } from "./runs.js";
import { review } from "./review.js";
import { space } from "./space.js";
import { apps } from "./apps.js";

/** @typedef {import("../types").Ctx} Ctx @typedef {import("../types").Reducer} Reducer */

/** Every stream frame type storm keeps in the world, and what it does; turn and block frames go to the turn store. @type {Record<string, Reducer>} */
export const REDUCERS = { ...messages, ...threads, ...sessions, ...runs, ...review, ...space, ...apps };

/** Applying a frame: where the stream stands, the turn store, then its reducer. @param {Ctx} ctx */
export function installApply(ctx) {
  const { state, chatProject } = ctx;
  ctx.apply = (f) => {
    const env = f.envelope || {};
    const type = f.type;
    const d = env.data || {};
    if (env.seq != null && env.seq > state.lastSeq) state.lastSeq = env.seq;
    const tid = state.turns.apply(f);
    if (type !== "chat" && env.chat_id && !chatProject.has(env.chat_id)) ctx.maybeChats(); // a chat we don't know yet (a creation says so itself)
    const reduce = Object.hasOwn(REDUCERS, type) ? REDUCERS[type] : null;
    if (reduce) reduce(ctx, env, d, tid, type);
    else if (tid) ctx.emitSoon(); // a block or turn frame: re-render, no need to rebuild the threads
  };
}
