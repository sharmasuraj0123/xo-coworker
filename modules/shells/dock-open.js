// @ts-check

import { api, chatActivityApi } from "../../core/platform/api.js";
import { ApiError } from "../../core/platform/http.js";
import { reportFailure, requestFailureMessage } from "../../core/services/notices/failures.js";
import { isRunning, nameFor, runningOf } from "./model.js";

/** @import { DockOpenOptions, ShellThread, ShellWorktree } from "./dock-open-types.d.ts" */

/** @param {import("./dock-types.d.ts").DockState} state @param {DockOpenOptions} options */
export function createShellOpeners(state, {
  requests, wanted, render, attach, upsert, focusNew, showList, projectName, refresh, notify, announce, claimView,
}) {
  /** @param {{project?: string, name: string | null, path?: string}} body @param {string} where */
  function open(body, where) {
    if (!requests.active() || !state.enabled || !wanted() || state.opening) return;
    claimView();
    state.opening = true;
    render();
    return requests.write(() => api.openTerminal(body), (result) => {
      state.opening = false;
      if (result.ok) {
        const { terminal, ticket } = result.value;
        upsert(terminal);
        attach(terminal.id, { ticket });
        announce(`Shell open in ${where}`);
        return;
      }
      focusNew();
      const { error } = result;
      const disabled = error instanceof ApiError && error.code === "terminal_disabled";
      const message = disabled ? error.message : requestFailureMessage(error, "Couldn't open a shell.");
      notify({ kind: "stopped", text: "Couldn't open a shell", sub: message });
      announce(`Couldn't open a shell: ${message}`);
      if (disabled) void refresh({ status: true });
    });
  }

  /** @param {string} project */
  function openProject(project, { fresh = false } = {}) {
    if (!requests.active()) return;
    if (!fresh && runningOf(state.list, project).length) return showList(project);
    return open({ project, name: nameFor(projectName(project)) }, projectName(project));
  }

  function openWorkspace({ fresh = false } = {}) {
    if (!requests.active()) return;
    if (!fresh && state.list.some((terminal) => isRunning(terminal) && terminal.scope === "workspace")) return showList("workspace");
    return open({ name: "Workspace" }, "the workspace");
  }

  /** @param {ShellThread} thread */
  function openThread({ project, chatId, ts, title }) {
    if (!requests.active() || !state.enabled || !wanted() || state.opening) return;
    if (!project || project === "workspace") return open({ name: nameFor(title) || "Workspace" }, "the workspace");
    claimView();
    return requests.read((signal) => chatActivityApi.worktrees(chatId, signal), (result) => {
      let path = null;
      if (result.ok) {
        const found = (result.value.worktrees || []).find((/** @type {ShellWorktree} */ tree) =>
          tree.thread_ts === ts && tree.exists !== false && !tree.error);
        path = found?.path || null;
      } else if (!(result.error instanceof ApiError && result.error.status === 404)) reportFailure(result.error);
      const there = path && state.list.find((terminal) =>
        isRunning(terminal) && terminal.project === project && (terminal.path === path || terminal.cwd === path));
      if (there) { attach(there.id); return; }
      const name = projectName(project);
      return open({ project, ...(path ? { path } : {}), name: nameFor(title) || nameFor(name) }, path ? "the thread's worktree" : name);
    });
  }

  return { openProject, openWorkspace, openThread };
}
