// @ts-check

import { isResponseObject } from "./http.js";

/** @import * as Project from "./project-response-types.d.ts" */

/** @param {unknown} value @returns {value is number} */
const isCount = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0;

/** @param {unknown} value */
const nullableText = (value) => value === null || typeof value === "string";

/** @param {unknown} value */
const strings = (value) => Array.isArray(value) && value.every((field) => typeof field === "string");

/** @param {unknown} value @returns {value is Project.TreeEntry} */
function isTreeEntry(value) {
  return isResponseObject(value) && typeof value.name === "string" && typeof value.relative_path === "string"
    && (value.is_dir === undefined || typeof value.is_dir === "boolean")
    && (value.modified_at == null || typeof value.modified_at === "string")
    && (value.size_bytes == null || isCount(value.size_bytes)) && (value.entries == null || isCount(value.entries));
}

/** @param {unknown} value @returns {value is Project.ProjectTree} */
export function isProjectTree(value) {
  return isResponseObject(value) && typeof value.project_id === "string" && typeof value.relative_path === "string"
    && (value.parent_relative_path == null || typeof value.parent_relative_path === "string")
    && Array.isArray(value.dirs) && value.dirs.every(isTreeEntry) && Array.isArray(value.files) && value.files.every(isTreeEntry);
}

/** @param {unknown} value @returns {value is Project.ProjectFile} */
export function isProjectFile(value) {
  return isResponseObject(value)
    && [value.project_id, value.relative_path, value.name, value.kind, value.content].every((field) => typeof field === "string")
    && isCount(value.size_bytes) && typeof value.truncated === "boolean"
    && [value.editable, value.bom].every((field) => field === undefined || typeof field === "boolean")
    && [value.modified_at, value.version, value.not_editable_reason, value.place, value.line_endings]
      .every((field) => field == null || typeof field === "string");
}

/** @param {unknown} value @returns {value is Project.SavedProjectFile} */
export function isSavedProjectFile(value) {
  return isResponseObject(value) && typeof value.relative_path === "string" && isCount(value.size_bytes)
    && [value.version, value.saved_at, value.edit_id].every(nullableText) && typeof value.unchanged === "boolean";
}

/** @param {unknown} value @returns {value is Project.ProjectVersion} */
function isVersion(value) {
  return isResponseObject(value) && [value.id, value.path, value.kind, value.at].every((field) => typeof field === "string")
    && [value.worktree, value.version, value.prev_version, value.old_path, value.restores].every(nullableText)
    && [value.n, value.size_bytes].every((field) => field === null || isCount(field))
    && typeof value.content_kept === "boolean" && typeof value.current === "boolean"
    && isResponseObject(value.by) && typeof value.by.kind === "string"
    && [value.by.thread_ts, value.by.session_id, value.by.turn_id, value.by.message_id]
      .every((field) => field === undefined || nullableText(field));
}

/** @param {unknown} value @returns {value is Project.ProjectVersions} */
export function isProjectVersions(value) {
  return isResponseObject(value) && typeof value.relative_path === "string" && typeof value.more === "boolean"
    && Array.isArray(value.versions) && value.versions.every(isVersion)
    && (value.head === null || (isResponseObject(value.head) && typeof value.head.commit === "string"
      && typeof value.head.version === "string"));
}

/** @param {unknown} value @returns {value is Project.ProjectPaths} */
export function isProjectPaths(value) {
  if (!isResponseObject(value) || typeof value.stamp !== "string") return false;
  if (value.unchanged === true) return true;
  return value.unchanged === undefined && typeof value.root === "string" && typeof value.truncated === "boolean"
    && strings(value.paths) && strings(value.dirs);
}

/** @param {unknown} value @returns {value is Project.ProjectMatch} */
function isMatch(value) {
  return isResponseObject(value) && typeof value.path === "string" && typeof value.text === "string"
    && isCount(value.line) && value.line > 0 && isCount(value.col) && value.col > 0
    && Array.isArray(value.ranges) && value.ranges.every((range) => Array.isArray(range) && range.length === 2
      && isCount(range[0]) && isCount(range[1]) && range[0] < range[1]);
}

/** @param {unknown} value @returns {value is Project.ProjectSearch} */
export function isProjectSearch(value) {
  return isResponseObject(value) && typeof value.root === "string" && typeof value.truncated === "boolean"
    && isCount(value.files) && isCount(value.took_ms) && Array.isArray(value.matches) && value.matches.every(isMatch);
}

/** @param {unknown} value @returns {value is Project.ProjectFolder} */
export const isProjectFolder = (value) => isResponseObject(value) && typeof value.relative_path === "string";

/** @param {unknown} value @returns {value is Project.ProjectRename} */
export function isProjectRename(value) {
  return isResponseObject(value) && [value.relative_path, value.old_relative_path, value.kind, value.edit_id]
    .every((field) => typeof field === "string") && nullableText(value.version);
}

/** @param {unknown} value @returns {value is Project.ProjectDelete} */
export const isProjectDelete = (value) => isResponseObject(value) && typeof value.edit_id === "string"
  && typeof value.kind === "string" && isCount(value.count);

/** @param {unknown} value @returns {value is Project.ProjectChange} */
function isChange(value) {
  return isResponseObject(value) && typeof value.path === "string" && typeof value.status === "string"
    && typeof value.binary === "boolean" && nullableText(value.version) && nullableText(value.patch)
    && [value.additions, value.deletions].every((field) => field === null || isCount(field))
    && [value.old_path, value.old_mode, value.new_mode, value.patch_omitted]
      .every((field) => field === undefined || typeof field === "string");
}

/** @param {unknown} value @returns {value is Project.ProjectChanges} */
export function isProjectChanges(value) {
  return isResponseObject(value) && [value.project_id, value.root, value.base_source, value.computed_at]
    .every((field) => typeof field === "string")
    && [value.worktree, value.base_ref, value.base_commit, value.head_commit].every(nullableText)
    && typeof value.truncated === "boolean" && isCount(value.total_files) && Array.isArray(value.files) && value.files.every(isChange);
}

/** @param {unknown} value @returns {value is Project.WorkspaceRootConfig} */
export const isWorkspaceRootConfig = (value) => isResponseObject(value) && typeof value.default === "string"
  && isResponseObject(value.roots) && Object.values(value.roots).every((root) => typeof root === "string");

/** @param {unknown} value @returns {value is Project.CreatedProject} */
export const isCreatedProject = (value) => isResponseObject(value) && typeof value.path === "string" && typeof value.name === "string"
  && strings(value.copied);

/** @param {unknown} value @returns {value is Project.ProjectClone} */
export function isProjectClone(value) {
  return isResponseObject(value) && [value.clone_id, value.project_id, value.phase, value.started_at]
    .every((field) => typeof field === "string") && ["cloning", "done", "failed", "cancelled"].some((state) => state === value.state)
    && [value.percent, value.received_bytes, value.idle_seconds].every(isCount)
    && (value.phase_percent === null || isCount(value.phase_percent)) && nullableText(value.warning) && nullableText(value.finished_at)
    && (value.error === null || (isResponseObject(value.error) && typeof value.error.code === "string"
      && typeof value.error.message === "string" && (value.error.detail === undefined || typeof value.error.detail === "string")));
}
