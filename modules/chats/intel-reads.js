// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { api } from "../../core/platform/api.js";
import { latest } from "../../core/platform/latest.js";
import { ApiError, missingRoute } from "../../core/platform/http.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { rtName } from "../../core/services/runtimes.js";

/** @typedef {ReturnType<typeof import("./intel-catalog.js").createIntelCatalog>} Catalog */

/** @param {import("./intel-types").IntelState} state @param {Catalog} source @param {() => void} render @param {() => void} onChange */
export function createIntelReads(state, source, render, onChange) {
  const mainKey = Symbol();
  const moveKey = Symbol();
  const effects = createScope();
  let picker = createScope();
  let stopMove = () => {};
  let cancelHide = () => {};
  /** @type {Map<string, () => void>} */
  const active = new Map();
  effects.effect(() => () => { picker.dispose(); active.clear(); });

  /** @param {string[]} sessions */
  function activate(sessions) {
    if (effects.signal.aborted) return;
    const next = new Set(sessions.filter(source.live).map(source.runtimeOf));
    for (const [runtime, stop] of active) {
      if (next.has(runtime)) continue;
      active.delete(runtime);
      stop();
    }
    for (const runtime of next) {
      if (!runtime || active.has(runtime)) continue;
      const read = createScope();
      active.set(runtime, effects.effect(() => read.dispose));
      if (source.catalogs.has(runtime)) continue;
      void source.warm(runtime, read.signal).then(() => {
        if (!read.signal.aborted && source.catalogs.has(runtime)) onChange();
      }, (error) => {
        if (!read.signal.aborted) requestFailureMessage(error, "Couldn't read the models.");
      });
    }
  }

  /** @param {string} session */
  async function load(session) {
    state.err = null;
    const runtime = source.runtimeOf(session);
    const cached = source.catalogs.get(runtime);
    if (cached) { state.models = cached; render(); }
    const parent = picker.signal;
    /** @param {AbortSignal} signal */
    const applicable = (signal) => !signal.aborted && state.open && state.session === session && source.runtimeOf(session) === runtime;
    try {
      await latest(mainKey, async (signal) => {
        try {
          const [models, router] = await Promise.all([
            source.catalog(runtime, { fresh: true, signal }),
            source.kindOf(session) === "thread" ? null : routerCatalog(signal),
          ]);
          return { models, router, signal };
        } catch (error) {
          return { error, signal };
        }
      }, { signal: parent, commit(result) {
        if (!applicable(result.signal)) return;
        if ("error" in result) {
          const error = result.error;
          state.err = error instanceof ApiError && error.status === 503 ? "The models can't be read right now."
            : requestFailureMessage(error, "Couldn't read the models.");
        } else {
          state.models = result.models;
          if (result.router) state.dms = result.router;
        }
        render();
      } });
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "AbortError") throw error;
    }
  }

  /** @param {string | null} runtime */
  async function move(runtime) {
    stopMove();
    const target = state.mv;
    if (!target || target.models) return;
    const read = createScope();
    const stop = stopMove = picker.effect(() => read.dispose);
    try {
      await latest(moveKey, async (signal) => {
        try {
          return { models: await source.catalog(runtime, { signal }) };
        } catch (error) {
          const slow = error instanceof ApiError && error.code === "timeout";
          if (!signal.aborted) requestFailureMessage(error, "Couldn't read the models.");
          return { error: slow ? `${rtName(runtime)}'s models are slow to read; its default still works.`
            : `${rtName(runtime)}'s models can't be read now; its default still works.` };
        }
      }, { signal: read.signal, commit(result) {
        if (state.mv !== target) return;
        if (result.models) target.models = result.models;
        else target.modelsErr = result.error;
        render();
      } });
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "AbortError") throw error;
    } finally {
      stop();
    }
  }

  return {
    open() { cancelHide(); picker.dispose(); picker = createScope(); },
    close() { picker.dispose(); },
    load, move, activate, effects,
    /** @param {() => void} fn */
    hide(fn) { cancelHide(); cancelHide = effects.timeout(fn, 140); },
  };
}

/** @param {AbortSignal} signal */
async function routerCatalog(signal) {
  try {
    return (await api.routerModels({ signal })).models || [];
  } catch (error) {
    signal.throwIfAborted();
    if (!missingRoute(error)) requestFailureMessage(error, "Couldn't read the routing models.");
    return [];
  }
}
