// @ts-check

import { optionalText } from "./response-fields.js";
import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";

/** @import * as GitHub from "./github-auth-types.d.ts" */

/** @param {unknown} value @returns {value is GitHub.Connected} */
function isConnected(value) {
  return isResponseObject(value) && value.status === "connected" && typeof value.username === "string"
    && [value.avatar_url, value.scopes, value.auth_method].every(optionalText)
    && (value.name === null || optionalText(value.name))
    && (value.imported === undefined || typeof value.imported === "boolean");
}

/** @param {unknown} value */
function isLocalLogin(value) {
  return isResponseObject(value) && typeof value.logged_in === "boolean" && typeof value.usable === "boolean"
    && [value.username, value.scopes, value.error].every(optionalText)
    && (value.missing === undefined || Array.isArray(value.missing) && value.missing.every((scope) => typeof scope === "string"));
}

/** @param {unknown} value @returns {value is GitHub.Status} */
function isStatus(value) {
  if (!isResponseObject(value) || !(value.valid === undefined || typeof value.valid === "boolean")) return false;
  if (value.status === "connected") return isConnected(value);
  return (value.status === "failed" || value.status === "needs_auth") && optionalText(value.error)
    && optionalText(value.auth_method) && (value.gh_login === undefined || isLocalLogin(value.gh_login));
}

/** @param {unknown} value @returns {value is GitHub.Start} */
function isStart(value) {
  return isResponseObject(value) && typeof value.session_id === "string" && typeof value.user_code === "string"
    && typeof value.verification_uri === "string" && Number.isInteger(value.expires_in)
    && (value.status === undefined || isConnected(value));
}

/** @param {unknown} value @returns {value is GitHub.Poll} */
const isPoll = (value) => isConnected(value) || isResponseObject(value) && value.status === "pending"
  && typeof value.user_code === "string" && typeof value.verification_uri === "string";

/** @param {unknown} value @returns {value is GitHub.Cancel} */
const isCancel = (value) => isResponseObject(value) && (value.status === "cancelled" || value.status === "not_found");

/** @param {unknown} value @returns {value is GitHub.Disconnect} */
const isDisconnect = (value) => isResponseObject(value) && value.status === "needs_auth";

/** @type {GitHub.AuthApi} */
export const githubAuthApi = {
  githubStatus: ({ signal } = {}) => requestChecked("/connectors/github/status", isStatus, { signal }),
  githubConnect: (fresh = false, { signal, body } = {}) => requestChecked("/connectors/github/cli/start", isStart, {
    method: "POST", query: fresh ? { fresh: true } : undefined, signal, body,
  }),
  githubConnectPoll: (sessionId, { signal } = {}) =>
    requestChecked("/connectors/github/cli/poll", isPoll, { method: "POST", body: { session_id: sessionId }, signal }),
  githubConnectCancel: (sessionId) =>
    requestChecked("/connectors/github/cli/cancel", isCancel, { method: "POST", body: { session_id: sessionId } }),
  githubDisconnect: ({ signal } = {}) =>
    requestChecked("/connectors/github/disconnect", isDisconnect, { method: "POST", body: {}, signal }),
};
