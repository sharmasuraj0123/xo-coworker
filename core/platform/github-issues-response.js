// @ts-check

import { optionalText } from "./response-fields.js";
import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";

/** @import {GithubIssuesResponse, Person, Pull, Detail} from "./github-issues-types.d.ts" */

/** @param {unknown} value */
const nullableText = (value) => value === null || typeof value === "string";

/** @param {unknown} value */
const isAssignee = (value) => isResponseObject(value) && typeof value.login === "string" && nullableText(value.avatar_url);

/** @param {unknown} value */
function isIssue(value) {
  return isResponseObject(value) && Number.isInteger(value.number) && typeof value.node_id === "string"
    && typeof value.title === "string" && typeof value.url === "string"
    && [value.state, value.state_reason, value.updated_at, value.workitem_id].every(nullableText)
    && (value.labels === null || Array.isArray(value.labels) && value.labels.every((label) => typeof label === "string"))
    && Array.isArray(value.assignees) && value.assignees.every(isAssignee)
    && typeof value.adopted === "boolean" && typeof value.in_progress === "boolean";
}

/** @param {unknown} value */
const isMirrorError = (value) => isResponseObject(value) && typeof value.kind === "string"
  && typeof value.message === "string" && nullableText(value.at);

/** @param {unknown} value @returns {value is GithubIssuesResponse} */
function isIssues(value) {
  return isResponseObject(value) && typeof value.project_id === "string" && [value.repo, value.fetched_at].every(nullableText)
    && (value.error === null || isMirrorError(value.error)) && Array.isArray(value.issues) && value.issues.every(isIssue)
    && Number.isInteger(value.untracked) && Number.isInteger(value.tracked) && typeof value.state === "string"
    && ["ok", "empty", "never_polled", "issues_disabled", "no_remote", "error"].includes(value.state);
}

/** @param {string} project @param {boolean} [refresh] @param {{signal?: AbortSignal}} [options] */
export function githubIssues(project, refresh = false, { signal } = {}) {
  const path = `/xo-projects/${encodeURIComponent(project)}/github/issues`;
  return requestChecked(path, isIssues, { query: refresh ? { refresh: "true" } : undefined, signal });
}

/** @param {unknown} value @returns {value is Person} */
function isPerson(value) {
  return nullableText(value) || isResponseObject(value) && optionalText(value.login)
    && (value.avatar_url === null || optionalText(value.avatar_url)) && optionalText(value.avatarUrl);
}

/** @param {unknown} value */
function isCount(value) {
  return value === undefined || value === null || Number.isInteger(value)
    || isResponseObject(value) && (value.total_count === undefined || Number.isInteger(value.total_count));
}

/** @param {unknown} value @returns {value is Pull} */
function isPull(value) {
  if (!isResponseObject(value) || !Number.isInteger(value.number)) return false;
  const names = [value.title, value.url, value.updatedAt, value.head, value.head_ref, value.headRefName, value.base, value.base_ref,
    value.baseRefName, value.checks, value.check_state, value.statusCheckRollup,
    value.review_decision, value.reviewDecision, value.mergeable];
  const flags = [value.merged, value.is_draft, value.isDraft, value.draft, value.in_progress];
  const counts = [value.comments, value.comment_count, value.additions, value.deletions, value.changed_files, value.changedFiles];
  return names.every(optionalText) && [value.state, value.updated_at].every((part) => part === undefined || nullableText(part))
    && flags.every((part) => part === undefined || typeof part === "boolean") && counts.every(isCount)
    && (value.author === undefined || isPerson(value.author))
    && (value.assignees === undefined || Array.isArray(value.assignees) && value.assignees.every(isPerson))
    && (value.labels == null || Array.isArray(value.labels));
}

/** @param {unknown} value */
const isCheck = (value) => isResponseObject(value) && [value.state, value.conclusion, value.name].every(optionalText);

/** @param {unknown} value */
const isComment = (value) => isResponseObject(value) && [value.body, value.created_at].every(optionalText)
  && (value.author === undefined || isPerson(value.author));

/** @param {unknown} value @returns {value is Detail} */
function isDetail(value) {
  if (!isResponseObject(value) || !optionalText(value.body)) return false;
  return (value.conflicts === undefined || Array.isArray(value.conflicts) && value.conflicts.every((part) => typeof part === "string"))
    && (value.checks === undefined || Array.isArray(value.checks) && value.checks.every(isCheck))
    && (value.comments === undefined || Array.isArray(value.comments) && value.comments.every(isComment));
}

/** @param {unknown} value @returns {value is {pulls: Pull[]}} */
const isPulls = (value) => isResponseObject(value) && Array.isArray(value.pulls) && value.pulls.every(isPull);

/** @param {string} project @param {{signal?: AbortSignal}} [options] */
export function githubPulls(project, { signal } = {}) {
  return requestChecked(`/xo-projects/${encodeURIComponent(project)}/github/pulls`, isPulls, { signal });
}

/** @param {string} project @param {string | number} number @param {AbortSignal} [signal] */
export function githubIssue(project, number, signal) {
  return requestChecked(`/xo-projects/${encodeURIComponent(project)}/github/issues/${encodeURIComponent(number)}`, isDetail, { signal });
}

/** @param {string} project @param {string | number} number @param {AbortSignal} [signal] */
export function githubPull(project, number, signal) {
  return requestChecked(`/xo-projects/${encodeURIComponent(project)}/github/pulls/${encodeURIComponent(number)}`, isDetail, { signal });
}
