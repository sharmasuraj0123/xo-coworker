// @ts-check
import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";

/** @param {unknown} data @returns {data is {items:{key:string}[]}} */
const keys = data => isResponseObject(data) && Array.isArray(data.items)
  && data.items.every(item => isResponseObject(item) && typeof item.key === "string");

/** @param {AbortSignal} signal */
export async function readSecretKeys(signal) {
  const { items } = await requestChecked("/secrets", keys, { signal });
  return items.map(item => item.key);
}

/** @param {string} key @param {string|null} value @param {AbortSignal} signal */
export function changeSecret(key, value, signal) {
  /** @param {unknown} data @returns {data is {key:string}} */
  const receipt = data => isResponseObject(data) && data.key === key && (value !== null || typeof data.deleted === "boolean");
  return requestChecked("/secrets/" + encodeURIComponent(key), receipt,
    { method: value === null ? "DELETE" : "PATCH", body: value === null ? undefined : { value }, signal });
}

/** @typedef {{id:string,error?:string|null,findings?:{level:string,observed:string}[]}} DoctorCheck */

/** @param {unknown} data @returns {data is {checks:DoctorCheck[]}} */
function doctor(data) {
  return isResponseObject(data) && Array.isArray(data.checks) && data.checks.every(c => isResponseObject(c)
    && typeof c.id === "string" && (c.error == null || typeof c.error === "string")
    && (c.findings === undefined || (Array.isArray(c.findings) && c.findings.every(f => isResponseObject(f)
      && typeof f.level === "string" && typeof f.observed === "string"))));
}

/** @param {AbortSignal} signal */
export const readDoctor = signal => requestChecked("/doctor", doctor, { signal });
