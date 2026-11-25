// @ts-check

import { coderHeaders, isResponseObject as record } from "./http.js";
import { checkedResponse } from "./response.js";
import { readJsonEvents } from "./sse.js";

/** @import {Frame, Listener} from "./launchpad-stream-types.d.ts" */

/** @param {unknown} value */
const text = (value) => typeof value === "string";

/** @param {unknown} value */
const maybeText = (value) => value == null || text(value);

/** @param {unknown} value */
const maybeNumber = (value) => value == null || typeof value === "number" && Number.isFinite(value);

/** @param {unknown} value */
const strings = (value) => Array.isArray(value) && value.every(text);

/** @param {unknown} value */
const isOtherApp = (value) => record(value) && text(value.id) && [value.slug, value.workflow].every(maybeText);

/** @param {unknown} value */
function isData(value) {
  if (value == null) return true;
  return record(value) && [value.app_id, value.run_url, value.source, value.failed_step, value.kind].every(maybeText)
    && [value.repo, value.suggestion].every(maybeText)
    && [value.ready, value.desired, value.release, value.port].every(maybeNumber)
    && (value.app == null || record(value.app) && text(value.app.id))
    && (value.apps == null || Array.isArray(value.apps) && value.apps.every(isOtherApp))
    && (value.log_tail == null || strings(value.log_tail))
    && (value.exposed_ports == null || Array.isArray(value.exposed_ports) && value.exposed_ports.every(Number.isInteger));
}

/** @param {unknown} value */
const isOption = (value) => record(value) && text(value.id) && text(value.label);

/** @param {unknown} value */
const isRun = (value) => record(value) && text(value.run_id) && (value.kind === "deploy" || value.kind === "watch")
  && typeof value.attached === "boolean" && text(value.started_at);

/** @param {unknown} value */
const isApp = (value) => value == null || record(value) && [value.id, value.name, value.slug].every(maybeText);

/** @param {Record<string, unknown>} value */
function isStatus({ app, release, live }) {
  return isApp(app)
    && (release == null || record(release) && maybeNumber(release.number)
      && [release.id, release.rollout_status, release.created_at, release.finished_at].every(maybeText))
    && (live == null || record(live) && [live.state, live.reason, live.message].every(maybeText));
}

/** @param {unknown} value @returns {value is Frame} */
function isFrame(value) {
  if (!record(value) || !text(value.ts)) return false;
  if (value.run_id !== undefined && !text(value.run_id)) return false;
  if (value.seq !== undefined && !Number.isInteger(value.seq)) return false;
  switch (value.type) {
    case "run": return isRun(value) && (value.after === undefined || Number.isInteger(value.after));
    case "step": return text(value.step) && text(value.status) && maybeNumber(value.elapsed)
      && [value.message, value.title].every(maybeText);
    case "progress": return [value.step, value.message].every(maybeText) && isData(value.data);
    case "warning": return text(value.message) && maybeText(value.step);
    case "status": return isStatus(value);
    case "ping": return true;
    case "done": return [value.url, value.commit, value.repo, value.branch].every(maybeText)
      && [value.release, value.http_status].every(maybeNumber) && isApp(value.app)
      && (value.created == null || typeof value.created === "boolean");
    case "error": case "needs": return text(value.code) && text(value.message) && [value.step, value.fix, value.action].every(maybeText)
      && (value.options === undefined || Array.isArray(value.options) && value.options.every(isOption)) && isData(value.data);
    case "replaced": return record(value.by) && text(value.by.run_id) && value.by.kind === "deploy";
    default: return false;
  }
}

/** @param {Response} response */
async function readFailure(response) {
  /** @type {unknown} */
  let payload;
  try { payload = await response.json(); }
  catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  const detail = record(payload) && record(payload.detail) ? payload.detail : {};
  return {
    code: text(detail.code) && detail.code || `http_${response.status}`,
    message: text(detail.message) && detail.message || `Space answered ${response.status}.`,
    action: text(detail.action) && detail.action || "retry",
  };
}

/** @param {string} path @param {string} method @param {string | undefined} body @param {Listener} options */
async function readStream(path, method, body, { signal, on }) {
  signal.throwIfAborted();
  const headers = { Accept: "text/event-stream", ...(body ? { "Content-Type": "application/json" } : {}), ...coderHeaders() };
  const response = await fetch("api" + path, { method, body, signal, headers, cache: "no-store", redirect: "manual" });
  signal.throwIfAborted();
  if (response.status === 204) return { ended: true };
  if (!response.ok) return { ended: false, failure: await readFailure(response) };
  await readJsonEvents(response, (value) => on(checkedResponse(value, isFrame, `${method} ${path}`)), signal);
  return { ended: false };
}

/** @param {string} project @param {object} body @param {Listener} options */
export function launchpadDeploy(project, body, options) {
  return readStream(`/deploy/${encodeURIComponent(project)}`, "POST", JSON.stringify(body), options);
}

/** @param {string} project @param {Listener & {run?: string, after?: number}} options */
export function launchpadWatch(project, options) {
  const base = `/deploy/${encodeURIComponent(project)}/watch`;
  const path = options.run ? `${base}?run=${encodeURIComponent(options.run)}&after=${options.after ?? 0}` : base;
  return readStream(path, "GET", undefined, options);
}
