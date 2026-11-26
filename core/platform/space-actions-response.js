// @ts-check
import { requestChecked } from "./response.js";
import { isResponseObject } from "./http.js";

/** @param {unknown} value @returns {value is {ok:true}} */
const ok = value => isResponseObject(value) && value.ok === true;

/** @param {string} id @param {AbortSignal} signal */
export async function runJob(id, signal) {
  await requestChecked("/schedules/" + encodeURIComponent(id) + "/run", ok, { method: "POST", signal });
  return "Run requested.";
}

/** @param {AbortSignal} signal */
export async function checkSharing(signal) {
  await requestChecked("/project-sharing/check", ok, { method: "POST", signal });
  return "Sharing check requested.";
}

/** @param {unknown} value @returns {value is {toolkit:string,new_events:number,error?:string|null,skipped?:string|null}} */
const pollResult = value => isResponseObject(value) && typeof value.toolkit === "string" && Number.isInteger(value.new_events)
  && [value.error, value.skipped].every(v => v == null || typeof v === "string");

/** @param {string} id @param {AbortSignal} signal */
export async function pollConnection(id, signal) {
  const result = await requestChecked("/connections/" + encodeURIComponent(id) + "/poll", pollResult, { method: "POST", signal });
  return result.error || result.skipped || `New events: ${result.new_events}`;
}
