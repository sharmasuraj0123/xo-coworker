// @ts-check

import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";

/** @import * as Terminal from "./terminal-response-types.d.ts" */

/** @param {unknown} value */
const count = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0;

/** @param {unknown} value */
const textOrNull = (value) => value === null || typeof value === "string";

/** @param {unknown} value @returns {value is Terminal.Terminal} */
function isTerminal(value) {
  return isResponseObject(value) && [value.id, value.name, value.cwd, value.created_at].every((part) => typeof part === "string")
    && (value.scope === "workspace" && value.project === null || value.scope === "project" && typeof value.project === "string")
    && (value.status === "running" || value.status === "exited")
    && (value.exit_code === null || Number.isInteger(value.exit_code)) && count(value.viewers)
    && isResponseObject(value.size) && count(value.size.rows) && count(value.size.cols)
    && [value.path, value.ended_reason, value.foreground, value.last_attached_at, value.last_output_at,
      value.detached_since, value.closes_at, value.ended_at].every(textOrNull);
}

/** @param {unknown} value @returns {value is Terminal.TerminalStatus} */
function isStatus(value) {
  return isResponseObject(value) && typeof value.enabled === "boolean" && textOrNull(value.reason)
    && [value.max_sessions, value.detached_ttl_seconds, value.running, value.attached].every(count);
}

/** @param {unknown} value @returns {value is Terminal.TerminalList} */
const isList = (value) => isResponseObject(value) && Array.isArray(value.terminals) && value.terminals.every(isTerminal);

/** @param {unknown} value @returns {value is Terminal.TerminalDetail} */
const isDetail = (value) => isResponseObject(value) && isTerminal(value.terminal);

/** @param {unknown} value @returns {value is Terminal.TerminalTicket} */
const isTicket = (value) => isResponseObject(value) && typeof value.ticket === "string" && count(value.ticket_expires_in);

/** @param {unknown} value @returns {value is Terminal.CreatedTerminal} */
const isCreated = (value) => isDetail(value) && isTicket(value);

/** @param {unknown} value @returns {value is Terminal.ClosedTerminal} */
const isClosed = (value) => isResponseObject(value) && value.ok === true && typeof value.closed === "string";

const enc = encodeURIComponent;

/** @type {Terminal.TerminalApi} */
export const terminalApi = {
  terminalStatus: ({ signal } = {}) => requestChecked("/terminal/status", isStatus, { signal }),
  terminals: (query = {}, { signal } = {}) => requestChecked("/terminal/sessions", isList, { query, signal }),
  terminal: (id, { signal } = {}) => requestChecked(`/terminal/sessions/${enc(id)}`, isDetail, { signal }),
  openTerminal: (body) => requestChecked("/terminal/sessions", isCreated, { method: "POST", body }),
  attachTerminal: (id, { signal } = {}) =>
    requestChecked(`/terminal/sessions/${enc(id)}/attach`, isTicket, { method: "POST", signal }),
  renameTerminal: (id, name) => requestChecked(`/terminal/sessions/${enc(id)}`, isDetail, { method: "PATCH", body: { name } }),
  closeTerminal: (id) => requestChecked(`/terminal/sessions/${enc(id)}`, isClosed, { method: "DELETE" }),
};
