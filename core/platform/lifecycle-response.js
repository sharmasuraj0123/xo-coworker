// @ts-check
import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";
import { isLifecycle } from "./runtime-responses.js";

/** @import { Job, JobAction, RemoteControl } from "./lifecycle-types.d.ts" */

const enc = encodeURIComponent;
/** @param {string} name */
const base = (name) => `/chat/runtimes/${enc(name)}`;
/** @type {Record<JobAction, string>} */
const PATH = { install: "install", update: "update", uninstall: "uninstall", sign_out: "sign-out" };

/** @param {unknown} value */
const text = (value) => typeof value === "string";
const STATUSES = ["running", "done", "failed"];
/** @param {unknown} value @returns {value is Job} */
const isJob = (value) => isResponseObject(value) && text(value.id) && text(value.runtime) && text(value.action)
  && typeof value.status === "string" && STATUSES.includes(value.status)
  && Array.isArray(value.log) && value.log.every(text) && (value.result == null || isResponseObject(value.result));
/** @param {unknown} value @returns {value is RemoteControl} */
const isRemote = (value) => isResponseObject(value) && (value.running === undefined || typeof value.running === "boolean")
  && [value.session_url, value.status, value.error, value.detail].every((v) => v == null || text(v));

export const lifecycleApi = {
  /** A runtime's state, version and the actions it offers. @param {string} name @param {{ signal?: AbortSignal }} [options] */
  lifecycle: (name, options) => requestChecked(`${base(name)}/lifecycle`, isLifecycle, options),
  /** Starts a job and returns it; force stops the sessions on it first. @param {string} name @param {JobAction} action */
  runtimeAction: (name, action, { force = false } = {}) =>
    requestChecked(`${base(name)}/${PATH[action]}`, isJob, { method: "POST", body: force ? { force: true } : {} }),
  /** @param {string} name @param {string} id @param {{ signal?: AbortSignal }} [options] */
  runtimeJob: (name, id, options) => requestChecked(`${base(name)}/jobs/${enc(id)}`, isJob, options),
  /** @param {string} name @param {{ signal?: AbortSignal }} [options] */
  remoteControl: (name, options) => requestChecked(`${base(name)}/remote-control/status`, isRemote, options),
  /** @param {string} name @param {boolean} on */
  setRemoteControl: (name, on) =>
    requestChecked(`${base(name)}/remote-control/${on ? "start" : "stop"}`, isRemote, { method: "POST", body: {} }),
};
