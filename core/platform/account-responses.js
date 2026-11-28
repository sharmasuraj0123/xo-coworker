// @ts-check
import { isResponseObject } from "./http.js";

/** @import {AccountFacts, AccountIntents, Advisory, Intent, PaidPool, PaidReceipt} from "./account-response-types" */

/** @param {unknown} value */
const text = (value) => typeof value === "string";
/** @param {unknown} value */
const bool = (value) => typeof value === "boolean";
/** @param {unknown} value */
const number = (value) => typeof value === "number" && Number.isFinite(value);
/** @param {unknown} value @param {(value: unknown) => boolean} test */
const optional = (value, test) => value === undefined || test(value);
/** @param {unknown} value @param {(value: unknown) => boolean} test */
const nullable = (value, test) => value == null || test(value);

/** @param {unknown} fact @param {(value: unknown) => boolean} valueType */
function isFact(fact, valueType) {
  return isResponseObject(fact) && bool(fact.known) && (fact.value === null || valueType(fact.value))
    && optional(fact.source, text) && nullable(fact.observed_at, text) && nullable(fact.age_s, number);
}

/** @param {unknown} value */
const isWindow = (value) => isResponseObject(value)
  && optional(value.utilization, (f) => isFact(f, number))
  && optional(value.resets_at, (f) => isFact(f, text)) && optional(value.status, (f) => isFact(f, text));

/** @param {unknown} paid */
const isPaid = (paid) => isResponseObject(paid) && optional(paid.possible, (f) => isFact(f, bool))
  && optional(paid.in_use, (f) => isFact(f, bool)) && optional(paid.credits, (f) => isFact(f, number))
  && optional(paid.status, (f) => isFact(f, text)) && optional(paid.disabled_reason, (f) => isFact(f, text));

/** @param {unknown} value @returns {value is AccountFacts} */
const isAccount = (value) => isResponseObject(value) && text(value.agent) && nullable(value.account, text)
  && optional(value.plan, (f) => isFact(f, text)) && optional(value.paid, isPaid)
  && optional(value.windows, (windows) => isResponseObject(windows) && Object.values(windows).every(isWindow));

/** @param {unknown} value @returns {value is Advisory} */
export const isAdvisory = (value) => isResponseObject(value) && Array.isArray(value.accounts) && value.accounts.every(isAccount)
  && optional(value.version, number) && optional(value.as_of, text) && optional(value.served_at, text);

/** @param {unknown} value @returns {value is Intent} */
const isIntent = (value) => isResponseObject(value) && [value.scope, value.scope_id, value.key, value.value].every(text)
  && nullable(value.until, text) && nullable(value.cites, text) && optional(value.set_at, text);

/** @param {unknown} value @returns {value is PaidPool} */
const isPool = (value) => isResponseObject(value) && [value.pool, value.mode, value.state].every(text)
  && [value.agent, value.source].every((field) => optional(field, text))
  && [value.resets_at, value.reason].every((field) => nullable(field, text));

/** @param {unknown} value @returns {value is AccountIntents} */
export const isAccountIntents = (value) => isResponseObject(value) && Array.isArray(value.intents) && value.intents.every(isIntent)
  && Array.isArray(value.pools) && value.pools.every(isPool);

/** @param {unknown} value */
const isHalted = (value) => isResponseObject(value) && text(value.session_id) && (value.turn_id === null || text(value.turn_id))
  && bool(value.interrupted) && bool(value.released) && number(value.ms);

/** @param {unknown} value @returns {value is PaidReceipt} */
export const isPaidReceipt = (value) => isResponseObject(value) && (value.intent === null || isIntent(value.intent))
  && Array.isArray(value.halted) && value.halted.every(isHalted);
