// @ts-check
import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";

/** @typedef {{members:{can_revoke:boolean}[],blockers:{message:string}[]}} ProjectMembers */

/** @typedef {ProjectMembers & {project_id:string,can_remove:boolean,repo:string|null,peers:unknown[]}} ProjectAccess */

/** @param {unknown} data @returns {data is ProjectAccess} */
function access(data) {
  return isResponseObject(data) && typeof data.project_id === "string" && typeof data.can_remove === "boolean"
    && (data.repo === null || typeof data.repo === "string") && Array.isArray(data.peers)
    && Array.isArray(data.members) && data.members.every(m => isResponseObject(m) && typeof m.can_revoke === "boolean")
    && Array.isArray(data.blockers) && data.blockers.every(b => isResponseObject(b) && typeof b.message === "string");
}

/** @param {string} id @param {AbortSignal} signal */
export const projectAccess = (id, signal) => requestChecked(`/xo-projects/${encodeURIComponent(id)}/removal`, access, { signal });

/** @param {string} id @param {string} workspace @param {AbortSignal} signal */
export function shareProject(id, workspace, signal) {
  /** @param {unknown} value @returns {value is {ok:true,repo:string}} */
  const shared = value => isResponseObject(value) && value.ok === true && typeof value.repo === "string";
  return requestChecked(`/xo-projects/${encodeURIComponent(id)}/share`, shared,
    { method: "POST", body: { workspace_id: workspace }, signal });
}

/** @param {string} id @param {AbortSignal} signal */
export function projectSync(id, signal) {
  /** @param {unknown} data @returns {data is {project_id:string,branch:string,path:string,behind:number|null}} */
  const current = data => isResponseObject(data) && data.project_id === id && typeof data.branch === "string"
    && typeof data.path === "string" && (data.behind === null || Number.isInteger(data.behind));
  return requestChecked(`/xo-projects/${encodeURIComponent(id)}/commits`, current, { query: { limit: 1 }, signal });
}

/** @param {string} id @param {AbortSignal} signal */
export function applySharedCommits(id, signal) {
  /** @param {unknown} data @returns {data is {project_id:string,applied:number}} */
  const applied = data => isResponseObject(data) && data.project_id === id && Number.isInteger(data.applied);
  return requestChecked(`/xo-projects/${encodeURIComponent(id)}/apply`, applied, { method: "POST", signal });
}

/** @param {string} id @param {AbortSignal} signal */
export function removeProject(id, signal) {
  /** @param {unknown} data @returns {data is {project_id:string,removed:true}} */
  const confirmed = data => isResponseObject(data) && data.project_id === id && data.removed === true;
  return requestChecked(`/xo-projects/${encodeURIComponent(id)}`, confirmed,
    { method: "DELETE", body: { confirm_project_id: id }, signal });
}
