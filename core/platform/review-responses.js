// @ts-check
import { optionalText as maybeText, optionalNullableText as nullableText, optionalNumber as maybeNumber,
  optionalFlag as maybeBoolean } from "./response-fields.js";
import { isResponseObject } from "./http.js";

/** @import {ReviewRecord, ReviewPage, Rule, RuleBatch} from "./review-response-types" */

/** @param {unknown} field */
const text = (field) => typeof field === "string";
/** @param {unknown} field @param {(value: unknown) => boolean} predicate */
const optionalList = (field, predicate) => field === undefined || Array.isArray(field) && field.every(predicate);

/** @param {unknown} value */
const isAnnotation = (value) => isResponseObject(value) && text(value.by) && text(value.note);

/** @param {unknown} value */
const isRiskGroup = (value) => isResponseObject(value) && text(value.text) && nullableText(value.kind) && maybeNumber(value.count);

/** @param {unknown} value */
const isDecision = (value) => isResponseObject(value) && maybeText(value.decision) && maybeText(value.idempotency_key);

/** @param {unknown} value */
const isReviewOption = (value) => isResponseObject(value) && text(value.decision)
  && [value.id, value.label, value.scope, value.sentence, value.answer].every(maybeText)
  && nullableText(value.why) && maybeBoolean(value.note) && maybeBoolean(value.hold_to_confirm);

/** @param {unknown} value */
const isQuestionOption = (value) => isResponseObject(value) && text(value.label)
  && nullableText(value.description) && nullableText(value.cost) && maybeBoolean(value.recommended);

/** @param {unknown} value */
const isQuestion = (value) => isResponseObject(value) && [value.id, value.header, value.question].every(nullableText)
  && maybeBoolean(value.secret) && maybeBoolean(value.multi) && optionalList(value.options, isQuestionOption);

/** @param {unknown} value */
const isDetail = (value) => isResponseObject(value) && optionalList(value.questions, isQuestion)
  && maybeText(value.limit) && nullableText(value.move_to) && nullableText(value.resets_at)
  && optionalList(value.threads, (row) => isResponseObject(row) && text(row.chat_id) && maybeText(row.ts) && maybeText(row.title));

/** @param {unknown} value @returns {value is ReviewRecord} */
export const isReview = (value) => isResponseObject(value) && text(value.id) && text(value.state) && maybeText(value.kind)
  && nullableText(value.created_at) && nullableText(value.expires_at)
  && [value.title, value.why, value.risk, value.origin, value.chat_id, value.thread_ts,
    value.session_id, value.run_id, value.turn_id].every(nullableText)
  && maybeNumber(value.seq) && (value.epoch === null || maybeNumber(value.epoch))
  && [value.blocking, value.parked].every(maybeBoolean) && (value.detail === undefined || isDetail(value.detail))
  && optionalList(value.risk_reasons, text)
  && optionalList(value.options, isReviewOption) && optionalList(value.annotations, isAnnotation)
  && optionalList(value.risk_groups, isRiskGroup) && (value.decision == null || isDecision(value.decision));

/** Each item is checked where it is read, so one bad item costs only itself. @param {unknown} value @returns {value is ReviewPage} */
export const isReviewPage = (value) => isResponseObject(value) && Array.isArray(value.items)
  && value.items.every(isResponseObject) && (value.next_after_seq === null || maybeNumber(value.next_after_seq));

/** @param {unknown} value @returns {value is Rule} */
export const isRule = (value) => isResponseObject(value) && text(value.id)
  && [value.sentence, value.scope, value.effect, value.created_at].every(maybeText)
  && [value.project_pid, value.thread_ts, value.tier, value.revoked_at].every(nullableText) && maybeNumber(value.uses);

/** @param {unknown} value @returns {value is RuleBatch} */
export const isRuleBatch = (value) => isResponseObject(value) && Array.isArray(value.rules) && value.rules.every(isRule)
  && optionalList(value.defaults, isRule) && (value.next_after_seq === null || maybeNumber(value.next_after_seq));
