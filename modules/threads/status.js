// @ts-check

import { heldShort } from "../../core/services/world/held.js";

/** @import { ThreadActivity, ThreadStatus, HeldThread } from "./status-types.d.ts" */

/** @type {Partial<Record<string, string>>} */
const WORD = {
  working: "Working", needs_reply: "Needs you", needs_approval: "Needs you",
  paused: "Paused", done: "Done", failed: "Stopped", resolved: "Resolved",
};

/** @param {ThreadActivity} thread */
export const isBusy = (thread) => thread.busy === true || (thread.state === "working" && thread.busy !== false);

/** @template {ThreadActivity} T @param {T | null | undefined} thread @returns {thread is HeldThread<T>} */
export function isHeld(thread) {
  return !!(thread?.held && !isBusy(thread) && thread.state === "working");
}

/** @param {ThreadStatus} thread */
export function glyphOf(thread) {
  if (isHeld(thread)) return "paused";
  if (thread.state === "working" && thread.busy === false) return "idle";
  return thread.frozen ? "resolved" : thread.stop ? "stopped" : thread.state;
}

/** @param {ThreadStatus} thread */
export function wordOf(thread) {
  if (isHeld(thread)) return heldShort(thread.held);
  if (glyphOf(thread) === "idle") return "Waiting";
  return thread.frozen ? "Continued" : WORD[thread.state] || thread.state;
}

/** @param {ThreadStatus} thread */
export const stOf = (thread) => thread.frozen ? "resolved" : isHeld(thread) ? "paused" : thread.stop ? "stopped" : thread.state;

/** @param {(id: string) => (ThreadStatus & {title: string}) | null | undefined} thread */
export function threadInfo(thread) {
  return (/** @type {string} */ id) => {
    const item = thread(id);
    return item ? { state: glyphOf(item), word: wordOf(item), title: item.title } : null;
  };
}
