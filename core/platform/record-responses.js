// @ts-check

import { isResponseObject } from "./http.js";

/** @import * as Wire from "./record-response-types.d.ts" */

/** @param {unknown} value */
const text = (value) => typeof value === "string";
/** @param {unknown} value */
const count = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
/** @param {unknown} value */
const flag = (value) => typeof value === "boolean";
/** @param {unknown} value @param {(field: unknown) => boolean} check */
const optional = (value, check) => value === undefined || check(value);
/** @param {unknown} value @param {(field: unknown) => boolean} check */
const nullable = (value, check) => value == null || check(value);
/** @param {unknown} value @param {(field: unknown) => boolean} check */
const arrayOf = (value, check) => Array.isArray(value) && value.every(check);

/** @param {unknown} value @returns {value is Wire.TreeState} */
const isTreeState = (value) => isResponseObject(value) && flag(value.exists)
  && [value.changed, value.untracked, value.kept_ignored, value.local_commits].every((n) => optional(n, count))
  && [value.xo, value.would_lose].every((field) => optional(field, flag))
  && nullable(value.error, text) && nullable(value.checked_at, text);

/** @param {unknown} value @returns {value is Wire.BranchReceipt} */
export function isBranch(value) {
  return isResponseObject(value) && nullable(value.branch, text) && nullable(value.merged_at, text)
    && [value.ahead, value.behind, value.commits].every((n) => nullable(n, count)) && nullable(value.unpushed, count)
    && optional(value.merged, flag)
    && nullable(value.pr, (pr) => isResponseObject(pr) && nullable(pr.number, count)
      && nullable(pr.url, text) && nullable(pr.state, text) && optional(pr.draft, flag) && nullable(pr.merged_at, text))
    && nullable(value.upstream, (upstream) => isResponseObject(upstream)
      && optional(upstream.pushed, flag) && optional(upstream.gone, flag))
    && nullable(value.tree, isTreeState);
}

/** @param {unknown} value */
const isLostPaths = (value) => isResponseObject(value) && count(value.count) && arrayOf(value.paths, text);

/** @param {unknown} value @returns {value is Wire.WorktreeLoss} */
export function isWorktreeLoss(value) {
  return isResponseObject(value) && nullable(value.branch, text) && optional(value.summary, text) && optional(value.commits, count)
    && [value.changed, value.untracked, value.ignored].every((entry) => nullable(entry, isLostPaths));
}

/** @param {unknown} value @returns {value is Wire.WorktreeRow} */
function isWorktree(value) {
  return isResponseObject(value) && text(value.chat_id) && text(value.thread_ts)
    && [value.path, value.thread_state].every((field) => optional(field, text))
    && [value.branch, value.base_commit, value.resolved_at, value.session_id, value.session_state, value.error,
      value.removed_at, value.removed_by].every((field) => nullable(field, text))
    && [value.exists, value.xo, value.removable].every((field) => optional(field, flag))
    && nullable(value.would_lose, isWorktreeLoss) && nullable(value.git, isBranch);
}

/** @param {unknown} value @returns {value is Wire.ReportedTree} */
function isReported(value) {
  return isResponseObject(value) && text(value.path) && text(value.reported_at)
    && optional(value.seq, count) && optional(value.chat_id, text) && nullable(value.thread_ts, text)
    && (value.managed === undefined || value.managed === false);
}

/** @param {unknown} value @returns {value is Wire.WorktreesReply} */
export const isWorktrees = (value) => isResponseObject(value) && arrayOf(value.worktrees, isWorktree)
  && optional(value.removed, (rows) => arrayOf(rows, isWorktree)) && optional(value.reported, (rows) => arrayOf(rows, isReported))
  && nullable(value.next_cursor, text);

/** @param {unknown} value @returns {value is Wire.WorktreeRemoveReply} */
export const isWorktreeRemoval = (value) => isResponseObject(value) && value.removed === true
  && flag(value.forced) && nullable(value.lost, isWorktreeLoss) && nullable(value.note, text);

/** @param {unknown} value @returns {value is Wire.MadeReceipt} */
export function isMadeItem(value) {
  return isResponseObject(value) && text(value.id)
    && [value.chat_id, value.kind, value.source, value.created_at, value.updated_at].every((field) => optional(field, text))
    && [value.path, value.url, value.name, value.title, value.mime, value.thread_ts, value.message_id, value.turn_id, value.copy_path,
      value.pinned_at, value.where, value.project_id, value.relative_path].every((field) => nullable(field, text))
    && nullable(value.bytes, count) && optional(value.pinned, flag) && optional(value.exists, flag) && nullable(value.git, isBranch);
}

/** @param {unknown} value @returns {value is Wire.MadeReply} */
export const isMade = (value) => isResponseObject(value) && arrayOf(value.made, isMadeItem) && nullable(value.next_before, text);

/** @param {unknown} value @returns {value is Wire.MemoryReply} */
export const isMemory = (value) => isResponseObject(value) && arrayOf(value.files, (file) => isResponseObject(file)
  && text(file.path) && text(file.version) && count(file.bytes));

/** @param {unknown} value @returns {value is Wire.MemoryFileReceipt} */
export const isMemoryFile = (value) => isResponseObject(value) && text(value.path) && text(value.version) && text(value.content);

/** @param {unknown} value @returns {value is Wire.ShapeReceipt} */
export const isShape = (value) => isResponseObject(value) && (value.shape === null || isResponseObject(value.shape))
  && text(value.version) && nullable(value.updated_at, text);
