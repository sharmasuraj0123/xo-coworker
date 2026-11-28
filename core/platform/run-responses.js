// @ts-check
import { isResponseObject } from "./http.js";

/** @import * as Wire from "./run-response-types" */

/** @param {unknown} part */
const textOrNone = (part) => part == null || typeof part === "string";
/** @param {unknown} part */
const finite = (part) => typeof part === "number" && Number.isFinite(part);
/** @param {unknown} part */
const numberOrNone = (part) => part == null || finite(part);
/** @param {unknown} part */
const optionalFlag = (part) => part === undefined || typeof part === "boolean";
/** @template T @param {unknown} value @param {(row: unknown) => row is T} check */
const isArrayOf = (value, check) => Array.isArray(value) && value.every(check);

/** @param {unknown} value @returns {value is Wire.RunRecord} */
function isRun(value) {
  return isResponseObject(value) && typeof value.id === "string" && typeof value.state === "string" && typeof value.kind === "string"
    && [value.title, value.agent_type, value.last_activity_at, value.last_tool, value.summary, value.started_at,
      value.ended_at, value.parent_run_id, value.spawn_call_id].every(textOrNone)
    && [value.tool_calls, value.tokens].every(numberOrNone) && (value.depth === undefined || finite(value.depth))
    && [value.can_stop, value.background].every(optionalFlag)
    && (value.children === undefined || isArrayOf(value.children, isRun));
}

/** @param {unknown} value @returns {value is Wire.RunCounts} */
const isCounts = (value) => isResponseObject(value)
  && [value.running, value.waiting, value.done, value.failed, value.stopped, value.lost, value.total, value.tokens]
    .every((part) => part === undefined || finite(part));

/** @param {unknown} value @returns {value is Wire.RunList} */
export const isRunList = (value) => isResponseObject(value) && isArrayOf(value.runs, isRun)
  && (value.counts === undefined || isCounts(value.counts)) && numberOrNone(value.next_after_seq);

/** @param {unknown} value @returns {value is Wire.Ancestry} */
const isAncestry = (value) => isResponseObject(value)
  && (value.chat == null || isResponseObject(value.chat) && [value.chat.kind, value.chat.name, value.chat.project_pid].every(textOrNone))
  && (value.thread == null || isResponseObject(value.thread) && textOrNone(value.thread.title))
  && (value.runs === undefined || isArrayOf(value.runs, isRun));

/** @param {unknown} value @returns {value is Wire.RunDetail} */
export const isRunDetail = (value) => isResponseObject(value)
  && (value.ancestry == null || isAncestry(value.ancestry)) && isRun(value);

/** @param {unknown} value @returns {value is Wire.TranscriptItem} */
const isTranscriptItem = (value) => isResponseObject(value) && typeof value.id === "string" && typeof value.type === "string"
  && [value.text, value.call_id, value.kind, value.status, value.title, value.tool, value.target].every(textOrNone)
  && [value.duration_ms, value.bytes].every(numberOrNone) && optionalFlag(value.truncated)
  && (value.steps === undefined || Array.isArray(value.steps) && value.steps.every((step) => typeof step === "string"))
  && (value.plan === undefined || Array.isArray(value.plan)
    && value.plan.every((row) => isResponseObject(row) && typeof row.state === "string" && textOrNone(row.text)));

/** @param {unknown} value @returns {value is Wire.RunTranscript} */
export const isRunTranscript = (value) => isResponseObject(value) && isArrayOf(value.items, isTranscriptItem) && textOrNone(value.next);

/** @param {unknown} value @returns {value is Wire.MissingStopReceipt} */
const isMissingStopReceipt = (value) => value === null || isResponseObject(value) && value.run === undefined && value.stopping == null;

/** @param {unknown} value @returns {value is Wire.StopRunReceipt | Wire.MissingStopReceipt} */
export const isStopRunReceipt = (value) => isMissingStopReceipt(value)
  || isResponseObject(value) && typeof value.stopping === "boolean" && isRunDetail(value.run);

/** @param {unknown} value @returns {value is Wire.StopRunsReceipt | Wire.MissingStopReceipt} */
export const isStopRunsReceipt = (value) => isMissingStopReceipt(value) || isResponseObject(value) && value.run === undefined
  && Array.isArray(value.stopping) && value.stopping.every((run) => typeof run === "string");
