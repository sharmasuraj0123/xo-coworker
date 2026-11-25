// @ts-check
import { isResponseObject } from "./http.js";
import { isBranch } from "./record-responses.js";
import { isRouter } from "./runtime-responses.js";

/** @import * as Wire from "./chat-response-types" */

/** @param {unknown} value */
const finite = (value) => typeof value === "number" && Number.isFinite(value);
/** @param {unknown} value */
const textOrNone = (value) => value == null || typeof value === "string";
/** @param {unknown} value */
const optionalText = (value) => value === undefined || typeof value === "string";
/** @param {unknown} value */
const numberOrNone = (value) => value == null || finite(value);
/** @param {unknown} value */
const optionalNumber = (value) => value === undefined || finite(value);
/** @param {unknown} value */
const optionalFlag = (value) => value === undefined || typeof value === "boolean";
/** @param {unknown} value */
const recordOrNone = (value) => value == null || isResponseObject(value);

/** @param {Record<string, unknown>} page */
const hasCursor = (page) => numberOrNone(page.next_before_seq) && numberOrNone(page.next_after_seq);

/** @param {unknown} value */
const isPin = (value) => isResponseObject(value) && [value.agent, value.model, value.effort].every(textOrNone);

/** @param {unknown} value @returns {value is Wire.Seen} */
const isSeen = (value) => isResponseObject(value) && typeof value.seen_at === "string" && numberOrNone(value.seen_seq);

/** @param {unknown} value @returns {value is { seen: Wire.Seen }} */
export const isSeenAck = (value) => isResponseObject(value) && isSeen(value.seen);

/** @param {unknown} value @returns {value is Wire.ChatRecord} */
export const isChat = (value) => isResponseObject(value) && typeof value.id === "string" && isPin(value)
  && optionalText(value.kind) && [value.project_pid, value.project, value.created_at, value.retired_at].every(textOrNone)
  && (value.settings === undefined || isResponseObject(value.settings)) && (value.routing == null || isRouter(value.routing))
  && (value.pin == null || isPin(value.pin)) && (value.seen == null || isSeen(value.seen));

/** @param {unknown} value @returns {value is { chats: Wire.ChatRecord[] }} */
export const isChats = (value) => isResponseObject(value) && Array.isArray(value.chats) && value.chats.every(isChat);

/** @param {unknown} value @returns {value is Wire.SessionFields} */
function isSessionFields(value) {
  return isResponseObject(value) && isPin(value) && optionalText(value.state)
    && optionalFlag(value.busy) && optionalNumber(value.live_runs) && recordOrNone(value.waiting);
}

/** @param {unknown} value @returns {value is Wire.SessionRecord} */
export function isSession(value) {
  return isResponseObject(value) && typeof value.id === "string" && isSessionFields(value)
    && [value.chat_id, value.thread_ts, value.pool, value.cwd, value.native_id, value.retired_at].every(textOrNone)
    && [value.role, value.preset, value.created_at, value.updated_at].every(optionalText)
    && optionalNumber(value.seq) && optionalNumber(value.epoch);
}

/** @param {unknown} value @returns {value is Wire.CursorPage & { sessions: Wire.SessionRecord[] }} */
export const isSessions = (value) => isResponseObject(value) && hasCursor(value)
  && Array.isArray(value.sessions) && value.sessions.every(isSession);

/** @param {unknown} value */
const isThreadOutput = (value) => isResponseObject(value) && [value.name, value.path, value.type].every(optionalText)
  && textOrNone(value.title) && numberOrNone(value.bytes);

/** @param {unknown} value @returns {value is NonNullable<Wire.ThreadRecord["card"]>} */
export const isThreadCard = (value) => isResponseObject(value)
  && [value.title, value.happened, value.needs_you, value.updated_at].every(optionalText);

/** @param {unknown} value @returns {value is Wire.ThreadRecord} */
export function isThread(value) {
  return isResponseObject(value) && typeof value.ts === "string"
    && [value.title, value.label, value.resolved_at, value.session_id, value.cwd, value.branch, value.worktree_path,
      value.base_commit, value.status_md, value.created_at, value.updated_at, value.summary].every(textOrNone)
    && optionalText(value.chat_id) && optionalText(value.state)
    && (value.session == null || isSessionFields(value.session)) && (value.pin == null || isPin(value.pin))
    && optionalFlag(value.busy) && optionalFlag(value.can_delete)
    && [value.activity, value.wait_reason, value.continued_from, value.continued_in].every(textOrNone)
    && numberOrNone(value.agent_ms) && (value.card == null || isThreadCard(value.card))
    && (value.runs == null || isResponseObject(value.runs)
      && [value.runs.running, value.runs.waiting, value.runs.total].every(optionalNumber))
    && (value.outputs == null || Array.isArray(value.outputs) && value.outputs.every(isThreadOutput))
    && (value.git == null || isBranch(value.git));
}

/** @param {unknown} value @returns {value is { threads: Wire.ThreadRecord[] }} */
export const isThreads = (value) => isResponseObject(value) && Array.isArray(value.threads) && value.threads.every(isThread);

/** @param {unknown} value @returns {value is Wire.MessageRecord} */
export const isMessage = (value) => isResponseObject(value) && typeof value.id === "string" && optionalNumber(value.seq)
  && [value.thread_ts, value.author_id, value.author_session_id, value.client_id, value.reply_to].every(textOrNone)
  && [value.chat_id, value.author_kind, value.text, value.created_at].every(optionalText)
  && recordOrNone(value.extra);

/** @param {unknown} value @returns {value is Wire.CursorPage & { messages: Wire.MessageRecord[] }} */
export const isMessages = (value) => isResponseObject(value) && hasCursor(value)
  && Array.isArray(value.messages) && value.messages.every(isMessage);

/** @param {unknown} part */
const isObservedPart = (part) => isResponseObject(part) && (part.data === undefined
  || isResponseObject(part.data) && optionalText(part.data.type) && optionalText(part.data.text));

/** @param {unknown} value @returns {value is Wire.ObservedMessage} */
const isObservedMessage = (value) => isResponseObject(value) && typeof value.id === "string" && typeof value.time_created === "string"
  && (value.data === undefined || isResponseObject(value.data) && optionalText(value.data.role))
  && (value.parts === undefined || Array.isArray(value.parts) && value.parts.every(isObservedPart));

/** @param {unknown} value @returns {value is Wire.ObservedPage} */
export const isObservedPage = (value) => isResponseObject(value) && Array.isArray(value.messages)
  && value.messages.every(isObservedMessage) && optionalNumber(value.total) && optionalNumber(value.offset);

/** @param {unknown} value @returns {value is Wire.PromptReceipt} */
export const isPromptReceipt = (value) => isResponseObject(value) && typeof value.session_id === "string"
  && textOrNone(value.turn_id) && optionalText(value.stream_id);

/** @param {unknown} value @returns {value is Wire.AbortReceipt} */
export const isAbortReceipt = (value) => isResponseObject(value) && typeof value.session_id === "string"
  && typeof value.stopped === "boolean" && textOrNone(value.turn_id);

/** @param {unknown} value @returns {value is Wire.ThreadDeletion} */
export const isThreadDeletion = (value) => isResponseObject(value) && value.deleted === true && optionalText(value.undo_until);

/** @param {unknown} value @returns {value is Wire.ThreadContinuation} */
export const isThreadContinuation = (value) => isResponseObject(value) && typeof value.thread_id === "string"
  && textOrNone(value.agent);

/** @param {unknown} value @returns {value is Wire.StoredFrame} */
export const isFrame = (value) => isResponseObject(value) && typeof value.type === "string" && numberOrNone(value.seq)
  && [value.id, value.ts, value.chat_id, value.session_id, value.thread_ts, value.turn_id, value.run_id].every(textOrNone)
  && recordOrNone(value.data);

/** @param {unknown} value @returns {value is Wire.CursorPage & { events: Wire.StoredFrame[] }} */
export const isEvents = (value) => isResponseObject(value) && hasCursor(value)
  && Array.isArray(value.events) && value.events.every(isFrame);

/** @param {unknown} value @returns {value is Wire.ActiveTurn} */
const isActiveTurn = (value) => isResponseObject(value) && typeof value.session_id === "string" && typeof value.turn_id === "string"
  && [value.chat_id, value.thread_ts, value.started_at, value.origin, value.agent, value.role].every(textOrNone);

/** @param {unknown} value @returns {value is { turns: Wire.ActiveTurn[] }} */
export const isActive = (value) => isResponseObject(value) && Array.isArray(value.turns) && value.turns.every(isActiveTurn);

/** @param {unknown} value */
const optionalStrings = (value) => value === undefined || (Array.isArray(value) && value.every((part) => typeof part === "string"));

/** @param {unknown} value @returns {value is Wire.HopRecord} */
export const isHop = (value) => isResponseObject(value) && typeof value.id === "string" && optionalText(value.chat_id)
  && [value.thread_ts, value.kind, value.from_role, value.to_role, value.from_session, value.to_session, value.state,
    value.created_at, value.delivered_at, value.answered_at, value.note, value.cause, value.wake_id].every(textOrNone)
  && numberOrNone(value.seq) && optionalStrings(value.via) && optionalStrings(value.message_ids);

/** @param {unknown} value @returns {value is Wire.CursorPage & { hops: Wire.HopRecord[] }} */
export const isHops = (value) => isResponseObject(value) && hasCursor(value) && Array.isArray(value.hops) && value.hops.every(isHop);
