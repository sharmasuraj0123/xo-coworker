// @ts-check

import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";

/** @import {ScheduledJob, ScheduleResult, ScheduleRun, ScheduleList, ScheduleRuns} from "./schedule-response-types.d.ts" */

/** @param {unknown} value */
const textOrNull = (value) => value === null || typeof value === "string";

/** @param {unknown} value @returns {value is ScheduleResult} */
function isResult(value) {
  return isResponseObject(value) && typeof value.started_at === "string" && typeof value.finished_at === "string"
    && typeof value.status === "string" && textOrNull(value.trigger)
    && (value.returncode == null || Number.isInteger(value.returncode))
    && (value.duration_seconds == null || Number.isFinite(value.duration_seconds))
    && [value.chat_id, value.thread_ts, value.reason, value.code, value.output_tail]
      .every((field) => field === undefined || typeof field === "string")
    && (value.fire_at === undefined || textOrNull(value.fire_at)) && (value.already === undefined || typeof value.already === "boolean")
    && (value.found === undefined || typeof value.found === "boolean")
    && (value.summary === undefined || typeof value.summary === "string");
}

/** @param {unknown} value @returns {value is ScheduleRun} */
function isRun(value) {
  return isResponseObject(value) && value.type === "job.run" && typeof value.ts === "string" && typeof value.job_id === "string"
    && isResult(value);
}

/** @param {Record<string, unknown>} value */
function isAgentDefinition(value) {
  return typeof value.chat === "string" && typeof value.prompt === "string" && typeof value.utc_offset === "string"
    && [value.agent, value.model, value.effort].every(textOrNull)
    && (value.created_by === undefined || (isResponseObject(value.created_by) && typeof value.created_by.kind === "string"))
    && (value.approved_by == null || (isResponseObject(value.approved_by) && typeof value.approved_by.review_id === "string"));
}

/** @param {Record<string, unknown>} value */
function isCommandDefinition(value) {
  const { command } = value;
  return textOrNull(value.project_id) && isResponseObject(command) && Number.isFinite(command.timeout)
    && Array.isArray(command.argv) && command.argv.every((arg) => typeof arg === "string")
    && (command.cwd === undefined || typeof command.cwd === "string")
    && (command.env === undefined || (isResponseObject(command.env) && Object.values(command.env).every((v) => typeof v === "string")));
}

/** @param {unknown} value @returns {value is ScheduledJob} */
function isJob(value) {
  if (!isResponseObject(value) || typeof value.id !== "string" || typeof value.name !== "string"
    || typeof value.enabled !== "boolean" || typeof value.running !== "boolean"
    || ![value.description, value.next_run, value.last_run, value.running_since].every(textOrNull)
    || (value.first_run_at !== undefined && !textOrNull(value.first_run_at))
    || (value.every_seconds !== null && !Number.isInteger(value.every_seconds))
    || ![value.created_at, value.updated_at].every((field) => field === undefined || typeof field === "string")
    || (value.last_result !== null && !isResult(value.last_result))) return false;
  const { fire, disabled_by: by } = value;
  if (by !== undefined && (!isResponseObject(by) || typeof by.kind !== "string"
    || ![by.reason, by.at].every((field) => field === undefined || typeof field === "string"))) return false;
  if (value.icon !== undefined && typeof value.icon !== "string") return false;
  if (fire !== undefined && (!isResponseObject(fire) || typeof fire.at !== "string" || typeof fire.trigger !== "string")) return false;
  if (value.kind === "agent") return isAgentDefinition(value);
  return (value.kind === undefined || value.kind === "command") && isCommandDefinition(value);
}

/** @param {unknown} value @returns {value is ScheduleList} */
const isList = (value) => isResponseObject(value) && Array.isArray(value.jobs) && value.jobs.every(isJob);

/** @param {unknown} value @returns {value is ScheduleRuns} */
const isRuns = (value) => isResponseObject(value) && typeof value.job_id === "string" && typeof value.log_path === "string"
  && Array.isArray(value.runs) && value.runs.every(isRun);

/** @param {unknown} value @returns {value is import("./schedule-response-types").ScheduleStarted} */
const isStarted = (value) => isResponseObject(value) && value.ok === true && typeof value.started === "boolean" && isJob(value.job);

/** @param {unknown} value @returns {value is { ok: true, deleted: string }} */
const isDeleted = (value) => isResponseObject(value) && value.ok === true && typeof value.deleted === "string";

const at = (/** @type {string} */ id) => `/schedules/${encodeURIComponent(id)}`;

/** @type {import("./schedule-response-types").ScheduleApi} */
export const scheduleApi = {
  schedules: (signal) => requestChecked("/schedules", isList, { signal }),
  schedule: (id) => requestChecked(at(id), isJob),
  scheduleRuns: (id, query = {}, signal) => requestChecked(`${at(id)}/runs`, isRuns, { query, signal }),
  createSchedule: (body) => requestChecked("/schedules", isJob, { method: "POST", body }),
  updateSchedule: (id, body) => requestChecked(at(id), isJob, { method: "PUT", body }),
  deleteSchedule: (id) => requestChecked(at(id), isDeleted, { method: "DELETE" }),
  runSchedule: (id) => requestChecked(`${at(id)}/run`, isStarted, { method: "POST", body: {} }),
};
