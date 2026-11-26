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
    && (value.fire_at === undefined || textOrNull(value.fire_at)) && (value.already === undefined || typeof value.already === "boolean");
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
  const fire = value.fire;
  if (fire !== undefined && (!isResponseObject(fire) || typeof fire.at !== "string" || typeof fire.trigger !== "string")) return false;
  if (value.kind === "agent") return isAgentDefinition(value);
  return (value.kind === undefined || value.kind === "command") && isCommandDefinition(value);
}

/** @param {unknown} value @returns {value is ScheduleList} */
const isList = (value) => isResponseObject(value) && Array.isArray(value.jobs) && value.jobs.every(isJob);

/** @param {unknown} value @returns {value is ScheduleRuns} */
const isRuns = (value) => isResponseObject(value) && typeof value.job_id === "string" && typeof value.log_path === "string"
  && Array.isArray(value.runs) && value.runs.every(isRun);

/** @type {import("./schedule-response-types").ScheduleApi} */
export const scheduleApi = {
  schedules: () => requestChecked("/schedules", isList),
  schedule: (id) => requestChecked(`/schedules/${encodeURIComponent(id)}`, isJob),
  scheduleRuns: (id, query = {}) => requestChecked(`/schedules/${encodeURIComponent(id)}/runs`, isRuns, { query }),
};
