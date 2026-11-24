// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { api } from "../../core/platform/api.js";
import { ApiError } from "../../core/platform/http.js";
import { latest } from "../../core/platform/latest.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
/** @import { DockState } from "./dock-types.js" */

const POLL_LIST = 15000;
const POLL_IDLE = 60000;
const CHANGE_DELAY = 600;

/** @typedef {ReturnType<typeof import("../../core/kernel/scope.js").createScope>} Scope */

/** @typedef {(reason: string | null) => void} Off */

/** @typedef {{ scope: Scope, offNow: Off, changed: () => void, listShown: () => boolean }} DockRefreshOptions */

/** @param {DockState} R @param {DockRefreshOptions} options */
export function createDockRefresh(R, { scope, offNow, changed, listShown }) {
  const key = Symbol();
  let foreground = createScope();
  scope.effect(() => () => foreground.dispose());
  let cancelPoll = () => {};
  let cancelSoon = () => {};

  async function refresh({ status = false } = {}) {
    cancelPoll();
    cancelSoon();
    if (scope.signal.aborted || foreground.signal.aborted || (document.hidden && !status)) return;
    try {
      await latest(key, async (signal) => {
        let info, terminals, problem;
        try {
          if (status || !R.statusAt || Date.now() - R.statusAt > POLL_IDLE - 1000) {
            info = await api.terminalStatus({ signal });
            signal.throwIfAborted();
          }
          if (info ? info.enabled : R.enabled) terminals = (await api.terminals(undefined, { signal })).terminals || [];
        } catch (error) {
          signal.throwIfAborted();
          problem = { error };
        }
        return { info, terminals, problem };
      }, { signal: foreground.signal, commit({ info, terminals, problem }) {
        if (info) {
          R.statusAt = Date.now();
          const was = R.enabled;
          R.enabled = !!info.enabled;
          R.reason = info.reason || null;
          if (was && !R.enabled) offNow(R.reason);
        }
        if (terminals) {
          R.list = terminals;
          R.loaded = true;
          R.err = null;
        }
        if (problem) {
          const { error } = problem;
          if (error instanceof ApiError && error.status === 404 && !R.loaded) R.enabled = false;
          else R.err = requestFailureMessage(error, "Couldn't read the shells.");
        }
        changed();
        if (!document.hidden) cancelPoll = scope.timeout(refresh, listShown() ? POLL_LIST : POLL_IDLE);
      } });
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "AbortError") throw error;
    }
  }

  scope.listen(document, "visibilitychange", () => {
    if (document.hidden) {
      foreground.dispose();
      cancelPoll();
      cancelSoon();
    } else {
      if (foreground.signal.aborted) foreground = createScope();
      void refresh();
    }
  });

  return { refresh, refreshSoon() {
    cancelSoon();
    if (!document.hidden) cancelSoon = scope.timeout(refresh, CHANGE_DELAY);
  } };
}
