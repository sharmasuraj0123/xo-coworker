// @ts-check

import { api, chatActivityApi } from "../../core/platform/api.js";
import { createScope } from "../../core/kernel/scope.js";
import { ApiError } from "../../core/platform/http.js";
import { reportFailure, requestFailureMessage } from "../../core/services/notices/failures.js";
import { isRunning, nameFor, runningOf } from "./model.js";

/** @import { DockOpenOptions, OpenIntent, ShellThread } from "./dock-open-types.d.ts" */

/** @param {import("./dock-types.d.ts").DockState} state @param {DockOpenOptions} options */
export function createShellOpeners(state, {
  requests, wanted, render, attach, upsert, focusNew, showList, projectName, refresh, notify, announce, claimView,
}) {
  /** @param {{project?: string, name: string | null, path?: string}} body @param {string} where @param {AbortSignal} [intent] */
  function open(body, where, intent) {
    if (!requests.active(intent) || !state.enabled || !wanted() || state.opening) return;
    const lifetime = createScope();
    claimView();
    state.opening = true;
    function finish() {
      state.opening = false;
      lifetime.dispose();
    }
    if (intent) lifetime.listen(intent, "abort", () => {
      finish();
      if (requests.active()) render();
    }, { once: true });
    render();
    return requests.write(() => api.openTerminal(body), (result) => {
      finish();
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
    }, intent).finally(lifetime.dispose);
  }

  /** @param {string} project @param {OpenIntent} [options] */
  function openProject(project, { fresh = false, signal } = {}) {
    if (!requests.active(signal)) return;
    if (!fresh && runningOf(state.list, project).length) return showList(project);
    return open({ project, name: nameFor(projectName(project)) }, projectName(project), signal);
  }

  /** @param {OpenIntent} [options] */
  function openWorkspace({ fresh = false, signal } = {}) {
    if (!requests.active(signal)) return;
    if (!fresh && state.list.some((terminal) => isRunning(terminal) && terminal.scope === "workspace")) return showList("workspace");
    return open({ name: "Workspace" }, "the workspace", signal);
  }

  /** @param {ShellThread} thread @param {Pick<OpenIntent, "signal">} [options] */
  function openThread({ project, chatId, ts, title }, { signal } = {}) {
    if (!requests.active(signal) || !state.enabled || !wanted() || state.opening) return;
    if (!project || project === "workspace") return open({ name: nameFor(title) || "Workspace" }, "the workspace", signal);
    claimView();
    return requests.read((readSignal) => chatActivityApi.worktrees(chatId, readSignal), (result) => {
      let path = null;
      if (result.ok) {
        const found = result.value.worktrees.find((tree) =>
          tree.thread_ts === ts && tree.exists !== false && !tree.error);
        path = found?.path || null;
      } else if (!(result.error instanceof ApiError && result.error.status === 404)) reportFailure(result.error);
      const there = path && state.list.find((terminal) =>
        isRunning(terminal) && terminal.project === project && (terminal.path === path || terminal.cwd === path));
      if (there) { attach(there.id); return; }
      const name = projectName(project);
      const body = { project, ...(path ? { path } : {}), name: nameFor(title) || nameFor(name) };
      return open(body, path ? "the thread's worktree" : name, signal);
    }, signal);
  }

  return { openProject, openWorkspace, openThread };
}
