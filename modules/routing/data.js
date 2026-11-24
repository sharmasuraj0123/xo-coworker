// @ts-check

import { api } from "../../core/platform/api.js";
import { cancelLatest, latest } from "../../core/platform/latest.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @import {Router, RoutingState} from "./types" */

/** @param {RoutingState} state @param {AbortSignal} signal @param {() => void} render */
export function createRoutingData(state, signal, render) {
  const key = Symbol("routing");
  let tail = Promise.resolve();

  /** @template T @param {() => Promise<T>} work */
  function write(work) {
    const next = tail.then(() => signal.aborted ? undefined : work());
    tail = next.then(() => {}, () => {});
    return next;
  }

  /** @param {() => void} update */
  function commit(update) {
    if (signal.aborted) return false;
    cancelLatest(key);
    update();
    return true;
  }

  /** @param {boolean} all @param {(router: Router) => void} [onRouter] */
  async function refresh(all, onRouter) {
    try {
      await latest(key, (readSignal) => Promise.all([
        api.router({ signal: readSignal }),
        all ? api.routerModels({ signal: readSignal }) : null,
      ]), {
        signal,
        commit([router, models]) {
          state.router = router;
          onRouter?.(router);
          if (all) {
            state.models = models?.models || [];
            state.err.routing = null;
          }
        },
      });
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
      const message = requestFailureMessage(error, "Couldn't read the routing.");
      if (all) state.err.routing = message;
    }
    if (all) render();
  }

  /** @param {(router: Router) => void} accept */
  const refreshRouter = (accept) => refresh(false, accept);
  return { signal, write, commit, open: () => refresh(true), refreshRouter };
}
