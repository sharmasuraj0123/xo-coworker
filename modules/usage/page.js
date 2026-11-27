// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { ApiError } from "../../core/platform/http.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { RANGES, usageHtml } from "./view.js";

/** @import {UsageHost, UsagePart, UsageSource, UsageState} from "./types" */

const PAGE = "usage";

/** @param {unknown} error */
const aborted = (error) => error instanceof Error && error.name === "AbortError";

/** The Usage page: every runtime's usage, read again on open or a new period. @param {UsageHost} host @param {UsageSource} source */
export function createUsagePage(host, source) {
  const scope = createScope();
  /** @type {UsageState} */
  const state = { days: 30, parts: null, failed: [], waiting: [], stale: [] };

  const render = () => { if (!scope.signal.aborted) host.paint(PAGE, usageHtml(state)); };

  /** @type {AbortController | null} */
  let reading = null;
  /** Each runtime's last answer for a period, kept for when a later read times out. @type {Map<string, UsagePart["usage"]>} */
  const last = new Map();

  /** @param {string} name @param {unknown} error */
  function noteFailure(name, error) {
    if (aborted(error) || (error instanceof ApiError && error.code === "unsupported")) return;
    state.failed.push({ name, message: requestFailureMessage(error, "It didn't answer.") });
  }

  /** Each runtime is drawn as soon as its own answer lands, so one slow runtime doesn't hold back the rest. */
  async function load() {
    reading?.abort();
    const ctl = reading = new AbortController(), signal = AbortSignal.any([scope.signal, ctl.signal]);
    Object.assign(state, { parts: null, failed: [], waiting: [], stale: [] });
    render();
    /** @type {string[]} */
    let names;
    try { names = await source.runtimes(signal); } catch (error) {
      if (signal.aborted || aborted(error)) return;
      state.parts = [];
      state.failed = [{ name: "XO", message: requestFailureMessage(error, "Couldn't read the runtimes.") }];
      render();
      return;
    }
    if (signal.aborted) return;
    state.waiting = [...names];
    /** @type {UsagePart[]} */
    const parts = [];
    const days = state.days;
    await Promise.all(names.map((name) => source.usage(name, days, signal).then(
      (usage) => { last.set(`${name}:${days}`, usage); parts.push({ name, usage }); },
      (error) => {
        if (signal.aborted) return;
        const kept = error instanceof ApiError && error.code === "timeout" ? last.get(`${name}:${days}`) : undefined;
        if (kept) { parts.push({ name, usage: kept }); state.stale.push(name); } else noteFailure(name, error);
      },
    ).finally(() => {
      if (signal.aborted) return;
      state.waiting = state.waiting.filter((n) => n !== name);
      if (parts.length || !state.waiting.length) state.parts = [...parts];
      render();
    })));
  }

  return {
    open: load,
    dispose: scope.dispose,
    /** @param {Element} target */
    click(target) {
      const days = Number(target.closest("[data-us-days]")?.getAttribute("data-us-days"));
      if (!RANGES.includes(days)) return false;
      if (days !== state.days) { state.days = days; void load(); }
      return true;
    },
  };
}
