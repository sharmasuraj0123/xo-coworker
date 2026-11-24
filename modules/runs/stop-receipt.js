// @ts-check
import { ApiError } from "../../core/platform/http.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @import {RunStopResult} from "./stop-types.d.ts" */

/** @param {RunStopResult | null | undefined} r @param {string} what @param {boolean} all */
export function stopReceipt(r, what, all) {
  const sent = !!r && (all ? Array.isArray(r.stopping) && r.stopping.length > 0 : r.stopping === true);
  if (sent) {
    const n = Array.isArray(r.stopping) ? r.stopping.length : 1;
    const sub = n > 1 ? `${n} sub-agents · what they did is kept` : `${what} · what it did is kept`;
    return { kind: "halt", text: "Stopping", sub, say: `Stopping ${what}. What it did is kept.` };
  }
  if (!all && r && r.stopping === false) {
    return { kind: "halt", text: "It had already finished", sub: what, say: `${what} had already finished.` };
  }
  if (all && r && Array.isArray(r.stopping) && !r.stopping.length) {
    const why = "none of them is running in a live session";
    return {
      kind: "stopped",
      text: "No stop went out",
      sub: `${what}: ${why}, though XO's record may still say they're working`,
      say: `No stop went out for ${what}: ${why}.`,
    };
  }
  return {
    kind: "stopped",
    text: "Not confirmed",
    sub: `${what}: XO didn't confirm a stop was sent. Stop again if it keeps working.`,
    say: `XO didn't confirm the stop of ${what}.`,
  };
}

/** @param {unknown} error @param {string} what */
export function failedStopReceipt(error, what) {
  const notice = { kind: "stopped", text: "Couldn't stop it" };
  if (error instanceof ApiError && error.code === "run_not_live") {
    const detail = "nothing is running it any more, though XO's record still says it's running";
    return { ...notice, sub: `${what}: ${detail}`, say: `Couldn't stop ${what}: ${detail}.` };
  }
  const sub = error instanceof ApiError && error.status === 501 ? "this agent can't stop a sub-agent; stop the thread instead"
    : requestFailureMessage(error, "Couldn't stop this sub-agent.");
  return { ...notice, sub, say: `Couldn't stop ${what}: ${sub}.` };
}
