// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { ApiError } from "../../core/platform/http.js";
import { latest } from "../../core/platform/latest.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { RANGES, usageHtml } from "./view.js";

/** @import {UsageHost, UsagePart, UsageSource, UsageState} from "./types" */

const PAGE = "usage";

/** @param {unknown} error */
const aborted = (error) => error instanceof Error && error.name === "AbortError";

/** The Usage page: every runtime's usage, read again on open or a new period. @param {UsageHost} host @param {UsageSource} source */
export function createUsagePage(host, source) {
  const scope = createScope();
  const requestKey = Symbol(PAGE);
  /** @type {UsageState} */
  const state = { days: 30, parts: null, failed: [] };

  const render = () => { if (!scope.signal.aborted) host.paint(PAGE, usageHtml(state)); };

  /** @param {AbortSignal} signal */
  async function readAll(signal) {
    const names = await source.runtimes(signal);
    const answers = await Promise.allSettled(names.map((name) => source.usage(name, state.days, signal)));
    /** @type {UsagePart[]} */
    const parts = [];
    /** @type {UsageState["failed"]} */
    const failed = [];
    answers.forEach((answer, i) => {
      if (answer.status === "fulfilled") parts.push({ name: names[i], usage: answer.value });
      else if (!(answer.reason instanceof ApiError && answer.reason.code === "unsupported") && !aborted(answer.reason)) {
        failed.push({ name: names[i], message: requestFailureMessage(answer.reason, "It didn't answer.") });
      }
    });
    return { parts, failed };
  }

  async function load() {
    state.parts = null;
    render();
    try {
      await latest(requestKey, readAll, {
        signal: scope.signal,
        /** @param {{ parts: UsagePart[], failed: UsageState["failed"] }} reply */
        commit(reply) { Object.assign(state, reply); render(); },
      });
    } catch (error) {
      if (scope.signal.aborted || aborted(error)) return;
      state.parts = [];
      state.failed = [{ name: "XO", message: requestFailureMessage(error, "Couldn't read the runtimes.") }];
      render();
    }
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
