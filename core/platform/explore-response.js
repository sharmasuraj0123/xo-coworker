// @ts-check
import { exchange, isResponseObject } from "./http.js";
import { checkedResponse } from "./response.js";

/** @typedef {{id:string,label:string}} Node */

/** @param {unknown} row @returns {row is Node} */
const node = row => isResponseObject(row) && typeof row.id === "string" && typeof row.label === "string";

/** @param {unknown} value @returns {value is import("./explore-types").SpaceMap} */
function isMap(value) {
  return isResponseObject(value) && Array.isArray(value.groups) && value.groups.every(node)
    && Array.isArray(value.leaves) && value.leaves.every(v => isResponseObject(v) && typeof v.group === "string" && node(v))
    && Array.isArray(value.ties) && value.ties.every(v => isResponseObject(v) && [v.s,v.t,v.label].every(s => typeof s === "string"))
    && Array.isArray(value.milestones)
    && value.milestones.every(v => isResponseObject(v) && typeof v.d === "string" && typeof v.t === "string");
}

/** @param {AbortSignal} signal */
export async function readSpaceMap(signal) {
  const value = await exchange("xo/space.json", "GET", undefined, signal);
  return checkedResponse(value, isMap, "GET /xo/space.json");
}
