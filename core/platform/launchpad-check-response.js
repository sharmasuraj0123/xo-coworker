// @ts-check

import { isResponseObject as record } from "./http.js";
import { requestChecked } from "./response.js";

/** @import {Check, Preflight} from "./launchpad-check-types.d.ts" */

/** @param {unknown} value */
const text = (value) => typeof value === "string";

/** @param {unknown} value */
const number = (value) => typeof value === "number" && Number.isFinite(value);

/** @param {unknown} value */
const bool = (value) => typeof value === "boolean";

/** @param {unknown} value */
const strings = (value) => Array.isArray(value) && value.every(text);

/** @param {unknown} value @param {(value: unknown) => boolean} check */
const optional = (value, check) => value === undefined || check(value);

/** @param {unknown} value */
const maybeText = (value) => value == null || text(value);

/** @param {unknown} value */
const maybeFlag = (value) => value == null || bool(value);

/** @param {unknown} value */
const maybeNumber = (value) => value == null || number(value);

/** @param {unknown} value */
const disk = (value) => value === null || record(value) && maybeText(value.path) && maybeNumber(value.size_gb);

/** @param {unknown} value */
const repo = (value) => record(value) && [value.full_name, value.origin, value.branch, value.new_repo_name].every(maybeText)
  && maybeFlag(value.own);

/** @param {unknown} value @param {(value: unknown) => boolean} check @param {(value: unknown) => boolean} [source] */
const field = (value, check, source = text) => value === undefined || record(value) && source(value.source) && check(value.value);

/** @param {unknown} value */
const env = (value) => Array.isArray(value) && value.every((row) => record(row) && text(row.name)
  && bool(row.sensitive) && text(row.source) && optional(row.default, text));

/** @param {unknown} value */
function fields(value) {
  if (!record(value)) return false;
  const port = value.port;
  return field(value.name, text) && field(port, maybeNumber, (source) => source === null || text(source))
    && (!record(port) || optional(port.confident, bool))
    && field(value.health_path, maybeText) && field(value.size, maybeText) && field(value.storage, disk)
    && optional(value.env, env) && optional(value.repo, repo);
}

/** @param {unknown} value */
const config = (value) => value === null || record(value)
  && [value.app_id, value.name, value.url, value.size].every(maybeText) && optional(value.storage, disk);

/** @param {unknown} value */
const running = (value) => value === null || record(value) && text(value.run_id) && (value.kind === "deploy" || value.kind === "watch");

/** @param {unknown} value */
const reasons = (value) => Array.isArray(value) && value.every((row) => text(row) || record(row)
  && [row.what, row.why, row.message].every((part) => optional(part, text)));

/** @param {unknown} value @returns {value is Check} */
function isCheck(value) {
  if (!record(value) || !text(value.project) || !text(value.state) || !(value.schema === undefined || value.schema === 1)) return false;
  const { git, prerequisites } = value;
  return optional(value.summary, text) && optional(value.reasons, reasons) && optional(value.warnings, strings)
    && optional(value.blockers, strings) && optional(value.config, config) && optional(value.fields, fields)
    && (git === undefined || record(git) && [git.branch, git.head, git.deployed_head].every(maybeText))
    && (prerequisites === undefined || record(prerequisites) && bool(prerequisites.github_connected)
      && maybeText(prerequisites.github_source)) && optional(value.running, running);
}

/** @param {unknown} value */
function app(value) {
  return value === null || record(value)
    && [value.id, value.name, value.url, value.status, value.size, value.size_label, value.last_deploy_at].every(maybeText)
    && [value.ready, value.desired, value.release].every(maybeNumber) && optional(value.exists, bool)
    && (value.storage == null || record(value.storage) && maybeText(value.storage.path) && maybeText(value.storage.size));
}

/** @param {unknown} value */
function sizes(value) {
  return value === null || record(value) && [value.default, value.source, value.error].every(maybeText)
    && optional(value.allowed, strings) && optional(value.fixed_after_create, bool) && Array.isArray(value.tiers)
    && value.tiers.every((tier) => record(tier) && text(tier.name) && optional(tier.label, text)
      && number(tier.cpu) && number(tier.memory_gb));
}

/** @param {unknown} value @returns {value is Preflight} */
function isPreflight(value) {
  if (!record(value) || !text(value.state)) return false;
  const { github, repo: target, launchpad } = value;
  return record(github) && optional(github.connected, bool) && maybeFlag(github.workflow_scope)
    && [github.login, github.source, github.error, github.fix].every(maybeText)
    && record(target) && repo(target) && [target.mode, target.reason].every(maybeText) && maybeFlag(target.exists)
    && record(launchpad) && optional(launchpad.app, app) && optional(launchpad.sizes, sizes)
    && (launchpad.same_name == null || record(launchpad.same_name) && app(launchpad.same_name)
      && optional(launchpad.same_name.linkable, bool)) && optional(launchpad.name_free, bool)
    && (launchpad.env_set === undefined || record(launchpad.env_set) && Object.values(launchpad.env_set).every(bool));
}

/** @param {string} project */
export const launchpadCheck = (project) => requestChecked(`/deploy/${encodeURIComponent(project)}/check`, isCheck);

/** @param {string} project @param {string} [name] */
export const launchpadPreflight = (project, name) =>
  requestChecked(`/deploy/${encodeURIComponent(project)}/preflight`, isPreflight, { query: { name } });
