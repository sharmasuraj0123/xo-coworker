// @ts-check

import { ApiError } from "../../core/platform/http.js";

const PREVIEW_CONCURRENCY = 3;

/** @typedef {ReturnType<typeof import("../../core/kernel/scope.js").createScope>} Scope */

/** @param {Scope} scope @param {(key: string) => number | null} distance @param {(key: string) => void} fail */
export function createPreviewQueue(scope, distance, fail) {
  /** @type {{key: string, run: () => Promise<void>, done: () => void}[]} */
  const waiting = [];
  const { signal } = scope;
  let running = 0;
  scope.effect(() => () => { for (const job of waiting.splice(0)) job.done(); });

  /** @param {string} key @param {() => Promise<void>} run @returns {Promise<void>} */
  function enqueue(key, run) {
    if (signal.aborted) return Promise.resolve();
    return new Promise((resolve) => { waiting.push({ key, run, done: () => resolve() }); pump(); });
  }

  function pump() {
    while (!signal.aborted && running < PREVIEW_CONCURRENCY && waiting.length) {
      let first = 0;
      let best = Infinity;
      for (const [i, job] of waiting.entries()) {
        const next = distance(job.key);
        if (next != null && next < best) { first = i; best = next; }
      }
      const [job] = waiting.splice(first, 1);
      running++;
      void Promise.resolve().then(() => { if (!signal.aborted) return job.run(); }).catch((error) => {
        if (signal.aborted) return;
        fail(job.key);
        if (!(error instanceof ApiError || error instanceof DOMException)) console.error(error);
      }).finally(() => { running--; job.done(); pump(); });
    }
  }

  return enqueue;
}
