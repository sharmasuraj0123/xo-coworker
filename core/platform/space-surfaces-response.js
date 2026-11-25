// @ts-check
import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";

/** @typedef {{project?:string|null,shared?:boolean}} Repo */

/** @param {unknown} data @returns {data is {repos:Record<string, Repo>,cadence?:string}} */
function isSharing(data) {
  return isResponseObject(data) && isResponseObject(data.repos) && Object.values(data.repos).every(repo =>
    isResponseObject(repo) && (repo.project == null || typeof repo.project === "string")
    && (repo.shared === undefined || typeof repo.shared === "boolean"));
}

/** @typedef {{toolkit:string,display_name?:string|null,configured?:boolean,connected_here?:boolean}} Connection */

/** @param {unknown} data @returns {data is {connections:Connection[]}} */
function isConnections(data) {
  return isResponseObject(data) && Array.isArray(data.connections) && data.connections.every(c => isResponseObject(c)
    && typeof c.toolkit === "string" && (c.display_name == null || typeof c.display_name === "string")
    && [c.configured, c.connected_here].every(v => v === undefined || typeof v === "boolean"));
}
/** @param {AbortSignal} signal */
export const readSharing = signal => requestChecked("/project-sharing/status", isSharing, { signal });
/** @param {AbortSignal} signal */
export const readConnections = signal => requestChecked("/connections", isConnections, { signal });
