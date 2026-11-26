// @ts-check
import { exchange, isResponseObject } from "./http.js";
import { checkedResponse, requestChecked } from "./response.js";

/** @typedef {{sessions:number,tokens:number,sessions_by_agent:Record<string,number>,tokens_by_agent:Record<string,number>}} Totals */

/** @param {unknown} value @returns {value is Record<string,number>} */
const counts = value => isResponseObject(value) && Object.values(value).every(n => Number.isInteger(n) && Number(n) >= 0);

/** @param {unknown} value @returns {value is {totals:Totals}} */
function usage(value) {
  const totals = isResponseObject(value) && value.totals;
  return isResponseObject(totals) && Number.isInteger(totals.sessions) && Number.isInteger(totals.tokens)
    && counts(totals.sessions_by_agent) && counts(totals.tokens_by_agent);
}

/** @param {unknown} value @returns {value is {items:{label:string,enabled:boolean}[]}} */
const sources = value => isResponseObject(value) && Array.isArray(value.items)
  && value.items.every(v => isResponseObject(v) && typeof v.label === "string" && typeof v.enabled === "boolean");

/** @param {AbortSignal} signal */
export async function readUsage(signal) {
  const value = await exchange("xo/sessions.json", "GET", undefined, signal);
  return checkedResponse(value, usage, "GET /xo/sessions.json").totals;
}
/** @param {AbortSignal} signal */
export const readSources = signal => requestChecked("/telemetry/sources", sources, { signal });
