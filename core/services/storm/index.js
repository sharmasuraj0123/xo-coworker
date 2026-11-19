// @ts-check
import { createTurns } from "../world/turns.js";
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

/** @typedef {import("./types").Ctx} Ctx @typedef {import("./types").StormState} StormState @typedef {import("./types").StormEvent} StormEvent */

/** Storm's chats, threads, sessions, turns and review items made into the world the views render; no decision logic. @param {StormState} state @param {() => void} emit @param {(e: StormEvent) => void} event */
export function stormSource(state, emit, event) {
  Object.assign(state, {
    status: null, statusError: null, runtimes: null, router: null, pools: {},
    advisory: null,  // GET /api/advisory: each account's plan, usage and paid facts
    paidOk: false,   // the intents were read at least once (a server without them shows no Paid usage)
    paidPools: [],   // each account's effective paid mode, its source and what it is doing now
    paid: [],        // the founder's holds and paid modes that hold now
    policy: null,    // {space, effective}: the Space's runtime policy
    chatPolicy: {},  // chat_… → {space, project, effective}: a project's own runtime policy
    controls: {},    // thread ts → [{action, by, by_session, reason, at, seq}]: thread.control
    moves: {},       // old thread ts → {to, from, agent, from_agent, reason, by, wip}: thread.continued
    conn: "connecting", connInfo: null,
    timeline: {},    // project id → storm message rows on its timeline, by seq
    hist: {},        // project id → {all, loading, error, before}
    found: {},       // project id → Map(message id → row): rows looked up by id, kept off the visible timeline
    threadMsgs: {},  // thread ts → storm message rows, by seq
    threadHist: {},  // thread ts → {loading, loaded, error, all, before, paged, older, olderError}: read in pages, newest first
    sessions: {},    // cse id → {id, role, chat_id, thread_ts, state, agent, model, effort, paused, retired_at, seq}
    awaiting: {},    // project id → {id, at}: we wrote to its timeline, no answer yet
    failed: {},      // project id → {at, error}: the coordinator's turn for our message failed
    routed: {},      // workspace message id → [{chat: project id}]
    review: new Map(), // open review items by id
    runs: new Map(),   // sub-agent runs seen on the stream (run_… → summary)
    hops: new Map(),   // hop id → hop: how a message travelled; shown only by choice
    liveRuns: {},      // session → {running, waiting, tokens, at} from the live `runs` frames
    turns: createTurns(),
    lastSeq: 0,
  });
  /** @type {Ctx} */
  const ctx = /** @type {any} */ ({
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
