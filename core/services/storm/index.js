// @ts-check
import { installSessions } from "./selectors/sessions.js";
import { installThreads } from "./selectors/threads.js";
import { installCommit } from "./selectors/commit.js";
import { installLoad } from "./load.js";
import { installAccount } from "./account.js";
import { installHistory } from "./history.js";
import { installHops } from "./hops.js";
import { installApply } from "./reducers/index.js";
import { installSessionReads } from "./reducers/sessions.js";
import { startStorm } from "./stream.js";
import { createAct } from "./act.js";

export { WAITING_STATES } from "./config.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("../world/state-types").WorldState} WorldState */

/** @param {WorldState} state @param {() => void} emit @param {(e: import("./types").StormEvent) => void} event */
export function stormSource(state, emit, event) {
  /** @type {Ctx} */
  const ctx = /** @type {Ctx} */ ({
    state, emit, event,
    chatProject: new Map(),  // chat_… → project id ("workspace" or the folder)
    rawThreads: new Map(),   // ts → the storm thread row, kept merged
    // what's on screen, to reload after a reset: the main chat's thread, and a thread page in the panel beside it
    watched: { projects: new Set(), thread: null, side: null, session: null },
    trimmed: new Set(),      // sessions whose older turns were pruned (read again when shown)
    framesBefore: new Map(), // session → the cursor below its stored frames read so far (null: all read)
    holding: true,
    poolsSeen: false,
  });
  installSessions(ctx);
  installThreads(ctx);
  installCommit(ctx);
  installLoad(ctx);
  installAccount(ctx);
  installHistory(ctx);
  installHops(ctx);
  installSessionReads(ctx);
  installApply(ctx);
  const { stop } = startStorm(ctx);
  return { act: createAct(ctx), stop };
}
