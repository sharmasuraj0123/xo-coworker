// @ts-check
import { BUSY_STATES } from "../world/sessions.js";

export const STATUS_MS = 30000;
export const STATUS_RETRY_MS = 8000;
export const RUNTIMES_MS = 5 * 60000;
export const CHATS_MIN_MS = 30000;
export const PAGE = 40;
// an older page as you scroll up: small enough that drawing it never stalls a frame (80 rows took 250-470 ms on a slow machine)
export const OLDER_PAGE = 30;
export const RUNS_KEEP = 300;
export const LOAD_CAP = 6;
export const AWAIT_CAP_MS = 10 * 60000;

/** On a turn; "queued" is held, not busy. @type {Set<string>} */
export const BUSY = BUSY_STATES;
export const COORD = new Set(["workspace-coordinator", "project-coordinator"]);
export const WAITING_STATES = new Set(["needs_reply", "needs_approval", "paused"]);
