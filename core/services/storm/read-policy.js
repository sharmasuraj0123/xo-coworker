// @ts-check
import { ApiError } from "../../platform/http.js";
import { reportReadFailure } from "./client.js";

/** @type {WeakMap<AbortSignal, Set<() => void>>} */
const waits = new WeakMap();

/** @param {unknown} error */
export const retryableRead = (error) => error instanceof ApiError && (error.status >= 500 || [0, 408, 429].includes(error.status));

/** @param {number} attempt */
export const retryStep = (attempt) => ({
  delay: Math.min(60000, 1000 * 2 ** Math.min(attempt, 6)) * (attempt < 3 ? 1 : 0.9 + Math.random() * 0.1),
  report: attempt === 3,
});

/** @param {AbortSignal} signal */
export function resumeReadRetries(signal) {
  for (const run of [...(waits.get(signal) ?? [])]) run();
}

/** @param {import("./types").Ctx["scope"]} scope @param {number} delay @param {() => void} run */
export function scheduleReadRetry(scope, delay, run) {
  const { signal } = scope;
  const pending = waits.get(signal) ?? new Set();
  waits.set(signal, pending);
  const resume = () => {
    if (!pending.delete(resume)) return;
    cancelTimer();
    clear();
    if (!signal.aborted) run();
  };
  const clear = scope.effect(() => () => { pending.delete(resume); });
  const cancelTimer = scope.timeout(resume, delay);
  pending.add(resume);
}

/** @param {import("./types").Ctx["scope"]} scope @param {(signal: AbortSignal) => Promise<void>} read */
export async function retryRead(scope, read) {
  let attempt = 0;
  async function run() {
    if (scope.signal.aborted) return;
    try { await read(scope.signal); }
    catch (error) {
      if (scope.signal.aborted) return;
      if (!retryableRead(error)) { reportReadFailure(error, scope.signal, true); return; }
      const step = retryStep(attempt++);
      if (step.report) reportReadFailure(error, scope.signal, true);
      scheduleReadRetry(scope, step.delay, run);
    }
  }
  await run();
}
