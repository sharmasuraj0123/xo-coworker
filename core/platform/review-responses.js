// @ts-check
import { isResponseObject } from "./http.js";

/** @import {ReviewRecord, ReviewPage, Rule, RuleBatch} from "./review-response-types" */

/** @param {unknown} field */
const text = (field) => typeof field === "string";
/** @param {unknown} field */
const maybeText = (field) => field === undefined || text(field);
/** @param {unknown} field */
const nullableText = (field) => field === null || maybeText(field);
/** @param {unknown} field */
const maybeNumber = (field) => field === undefined || typeof field === "number" && Number.isFinite(field);
/** @param {unknown} field */
const maybeBoolean = (field) => field === undefined || typeof field === "boolean";
/** @param {unknown} field @param {(value: unknown) => boolean} predicate */
const optionalList = (field, predicate) => field === undefined || Array.isArray(field) && field.every(predicate);

/** @param {unknown} value */
const isAnnotation = (value) => isResponseObject(value) && text(value.by) && text(value.note);

/** @param {unknown} value */
const isRiskGroup = (value) => isResponseObject(value) && text(value.text) && nullableText(value.kind) && maybeNumber(value.count);

/** @param {unknown} value */
const isDecision = (value) => isResponseObject(value) && maybeText(value.decision) && maybeText(value.idempotency_key);

/** @param {unknown} value @returns {value is ReviewRecord} */
export const isReview = (value) => isResponseObject(value) && text(value.id) && text(value.state) && maybeText(value.kind)
  && nullableText(value.created_at) && nullableText(value.expires_at)
  && [value.title, value.why, value.risk, value.chat_id, value.thread_ts, value.session_id, value.run_id, value.turn_id].every(nullableText)
  && maybeNumber(value.seq) && (value.epoch === null || maybeNumber(value.epoch))
  && [value.blocking, value.parked].every(maybeBoolean) && (value.detail === undefined || isResponseObject(value.detail))
  && optionalList(value.risk_reasons, text)
  && optionalList(value.options, isResponseObject) && optionalList(value.annotations, isAnnotation)
  && optionalList(value.risk_groups, isRiskGroup) && (value.decision == null || isDecision(value.decision));

/** @param {unknown} value @returns {value is ReviewPage} */
export const isReviewPage = (value) => isResponseObject(value) && Array.isArray(value.items) && value.items.every(isReview)
  && (value.next_after_seq === null || maybeNumber(value.next_after_seq));

/** @param {unknown} value @returns {value is Rule} */
export const isRule = (value) => isResponseObject(value) && text(value.id)
  && [value.sentence, value.scope, value.effect, value.created_at].every(maybeText)
  && [value.project_pid, value.thread_ts, value.tier, value.revoked_at].every(nullableText) && maybeNumber(value.uses);

/** @param {unknown} value @returns {value is RuleBatch} */
export const isRuleBatch = (value) => isResponseObject(value) && Array.isArray(value.rules) && value.rules.every(isRule)
  && optionalList(value.defaults, isRule) && (value.next_after_seq === null || maybeNumber(value.next_after_seq));
