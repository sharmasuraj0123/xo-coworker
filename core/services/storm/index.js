// @ts-check
import { createScope } from "../../kernel/scope.js";
import { installSessions } from "./selectors/sessions.js";
import { installThreads } from "./selectors/threads.js";
import { installCommit } from "./selectors/commit.js";
import { installLoad } from "./load.js";
import { createThreadRecords, installThreadReads } from "./thread-reads.js";
import { installAccount } from "./account.js";
import { installHistory } from "./history.js";
import { installHops } from "./hops.js";
import { installApply } from "./reducers/index.js";
import { installSessionReads } from "./reducers/sessions.js";
import { startStorm } from "./stream.js";
import { createAct } from "./act.js";

export { WAITING_STATES } from "./config.js";

/** @typedef {import("./types").Ctx} Ctx @typedef {import("../world/state-types").WorldState} WorldState */

/** @param {WorldState} state @param {Ctx["emit"]} emit @param {Ctx["event"]} event @param {Ctx["scope"]} scope */
export function stormSource(state, emit, event, scope) {
  let reads = createScope();
  let retireReads = scope.effect(() => reads.dispose);
  const threadRecords = createThreadRecords();
  /** @type {Ctx} */
  const ctx = /** @type {Ctx} */ ({
    state, emit, event, scope,
    get reads() { return reads; },
    renewReads() {
      if (scope.signal.aborted) return reads;
      const retire = retireReads;
      reads = createScope();
      retireReads = scope.effect(() => reads.dispose);
      retire();
      return reads;
    },
    chatProject: new Map(),  // chat_… → project id ("workspace" or the folder)
    rawThreads: threadRecords.rows,
    threadRecords,
    // what's on screen, to reload after a reset: the main chat's thread, and a thread page in the panel beside it
    watched: { projects: new Set(), thread: null, side: null, session: null },
    trimmed: new Set(),      // sessions whose older turns were pruned (read again when shown)
    framesBefore: new Map(), // session → the cursor below its stored frames read so far (null: all read)
    holding: true,
    poolsSeen: false,
  });
  try {
    installSessions(ctx);
    installThreads(ctx);
    installCommit(ctx);
    installThreadReads(ctx);
    installLoad(ctx);
    installAccount(ctx);
    installHistory(ctx);
    installHops(ctx);
    installSessionReads(ctx);
    installApply(ctx);
    startStorm(ctx);
    return createAct(ctx);
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
