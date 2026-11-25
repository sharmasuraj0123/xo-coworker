// @ts-check

import { requestChecked } from "./response.js";
import * as shapes from "./project-response.js";

const enc = encodeURIComponent;

/** @type {import("./project-response-types").ProjectApi} */
export const projectApi = {
  projectFile: (project, relativePath, at, { purpose, version, signal } = {}) => requestChecked(
    `/xo-projects/${enc(project)}/file`, shapes.isProjectFile,
    { signal, query: { relative_path: relativePath, commit: at?.commit, commit_path: at?.path, purpose, version } },
  ),
  saveProjectFile: (project, relativePath, content, baseVersion, confirm, { restoreOf = null } = {}) =>
    requestChecked(`/xo-projects/${enc(project)}/file`, shapes.isSavedProjectFile, {
      method: "PUT",
      body: { relative_path: relativePath, content, base_version: baseVersion, ...(confirm ? { confirm } : {}) },
      headers: restoreOf ? { "X-XO-Restore-Of": restoreOf } : undefined,
    }),
  projectVersions: (project, relativePath, { limit = 50, before = null } = {}) =>
    requestChecked(`/xo-projects/${enc(project)}/versions`, shapes.isProjectVersions, {
      query: { relative_path: relativePath, limit, before },
    }),
  projectPaths: (project, { worktree = null, stamp = null, signal } = {}) =>
    requestChecked(`/coworker/xo-projects/${enc(project)}/paths`, shapes.isProjectPaths, { signal, query: { worktree, stamp } }),
  projectSearch: (project, { q, worktree = null, regex = false, case: cs = false, word = false, glob = null, limit = 500, signal } = {}) =>
    requestChecked(`/coworker/xo-projects/${enc(project)}/search`, shapes.isProjectSearch, {
      signal, query: { q, worktree, regex: String(!!regex), case: String(!!cs), word: String(!!word), glob, limit },
    }),
  renameProjectFile: (project, relativePath, newRelativePath, confirm) =>
    requestChecked(`/xo-projects/${enc(project)}/files/rename`, shapes.isProjectRename, {
      method: "POST", body: { relative_path: relativePath, new_relative_path: newRelativePath, ...(confirm ? { confirm } : {}) },
    }),
  deleteProjectFile: (project, relativePath, baseVersion, confirm) =>
    requestChecked(`/xo-projects/${enc(project)}/files/delete`, shapes.isProjectDelete, {
      method: "POST",
      body: { relative_path: relativePath, ...(baseVersion ? { base_version: baseVersion } : {}), ...(confirm ? { confirm } : {}) },
    }),
  mkdirProject: (project, relativePath) =>
    requestChecked(`/xo-projects/${enc(project)}/files/mkdir`, shapes.isProjectFolder, {
      method: "POST", body: { relative_path: relativePath },
    }),
  undoProjectEdit: (project, editId) =>
    requestChecked(`/xo-projects/${enc(project)}/edits/${enc(editId)}/undo`, shapes.isSavedProjectFile, { method: "POST", body: {} }),
  projectChanges: (project, { worktree, path } = {}) =>
    requestChecked(`/xo-projects/${enc(project)}/changes`, shapes.isProjectChanges, { query: { worktree, path } }),
  projectTree: (project, relativePath, signal) =>
    requestChecked(`/xo-projects/${enc(project)}/tree`, shapes.isProjectTree, {
      query: { relative_path: relativePath, hidden: "true" }, signal,
    }),
  workspaceConfig: ({ signal } = {}) => requestChecked("/config/workspace", shapes.isWorkspaceRootConfig, { signal }),
  createProject: ({ path, displayName, description }) => requestChecked("/files/mkdir", shapes.isCreatedProject, {
    method: "POST", body: { path, scaffold: true, display_name: displayName, ...(description ? { description } : {}) },
  }),
  cloneProject: ({ id, url, displayName, description }) => requestChecked("/xo-projects", shapes.isProjectClone, {
    method: "POST",
    body: { project_id: id, repository_url: url, display_name: displayName, ...(description ? { description } : {}), wait: false },
  }),
  cloneStatus: (cloneId, { signal } = {}) => requestChecked(`/xo-projects/clones/${enc(cloneId)}`, shapes.isProjectClone, { signal }),
  cancelClone: (cloneId) => requestChecked(`/xo-projects/clones/${enc(cloneId)}`, shapes.isProjectClone, { method: "DELETE" }),
};
