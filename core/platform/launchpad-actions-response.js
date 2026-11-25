// @ts-check

import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";

/** @import * as Reply from "./launchpad-actions-types.d.ts" */

/** @param {unknown} value */
const nullableText = (value) => value === null || typeof value === "string";

/** @param {unknown} value @returns {value is Reply.App} */
function isApp(value) {
  return isResponseObject(value) && typeof value.id === "string" && typeof value.name === "string"
    && [value.slug, value.source, value.status, value.url, value.repo, value.branch].every(nullableText)
    && (value.port === null || Number.isInteger(value.port));
}

/** @param {unknown} value @returns {value is Reply.Apps} */
function isApps(value) {
  return isResponseObject(value) && nullableText(value.linked) && typeof value.name === "string"
    && Array.isArray(value.apps) && value.apps.every((app) => isResponseObject(app) && isApp(app)
      && typeof app.linkable === "boolean" && Array.isArray(app.match)
      && app.match.every((part) => part === "name" || part === "repo"));
}

/** @param {unknown} value @returns {value is Reply.Link} */
function isLink(value) {
  if (!isResponseObject(value) || !isResponseObject(value.config) || !nullableText(value.commit) || !isApp(value.app)) return false;
  return typeof value.config.app_id === "string" && typeof value.config.name === "string" && nullableText(value.config.url);
}

/** @param {unknown} value @returns {value is Reply.Unlink} */
function isUnlink(value) {
  return isResponseObject(value) && typeof value.forgot === "boolean" && nullableText(value.commit)
    && isResponseObject(value.unlinked) && nullableText(value.unlinked.app_id) && nullableText(value.unlinked.name);
}

/** @param {unknown} value @returns {value is Reply.Stop} */
const isStop = (value) => isResponseObject(value)
  && (value.stopped === false || value.stopped === true && typeof value.run_id === "string");

/** @param {unknown} value @returns {value is Reply.AskAgent} */
const isAskAgent = (value) => isResponseObject(value) && typeof value.chat_id === "string" && typeof value.thread_ts === "string"
  && (value.already === true || value.already === false && typeof value.state === "string");

/** @type {Reply.ActionsApi} */
export const launchpadActionsApi = {
  launchpadApps: (project, signal) => requestChecked(`/deploy/${encodeURIComponent(project)}/apps`, isApps, { signal }),
  launchpadLink: (project, app) => requestChecked(`/deploy/${encodeURIComponent(project)}/link`, isLink, {
    method: "POST", body: { app },
  }),
  launchpadUnlink: (project) => requestChecked(`/deploy/${encodeURIComponent(project)}/link`, isUnlink, { method: "DELETE" }),
  launchpadStop: (project) => requestChecked(`/deploy/${encodeURIComponent(project)}`, isStop, { method: "DELETE" }),
  launchpadAskAgent: (project, note) =>
    requestChecked(`/deploy/${encodeURIComponent(project)}/agent`, isAskAgent, { method: "POST", body: note ? { note } : {} }),
};
