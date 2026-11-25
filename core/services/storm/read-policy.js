// @ts-check
import { ApiError } from "../../platform/http.js";
import { reportReadFailure } from "./client.js";

const delays = [1000, 2000, 4000];

/** @param {number} attempt */
export const retryDelay = (attempt) => delays[attempt];

/** @param {import("./types").Ctx["scope"]} scope @param {(signal: AbortSignal) => Promise<void>} read */
export async function retryRead(scope, read) {
  let attempt = 0;
  async function run() {
    if (scope.signal.aborted) return;
    try { await read(scope.signal); }
    catch (error) {
      if (scope.signal.aborted) return;
      const transient = error instanceof ApiError && (error.status >= 500 || [0, 408, 429].includes(error.status));
      const delay = retryDelay(attempt++);
      if (transient && delay !== undefined) scope.timeout(run, delay);
      else reportReadFailure(error, scope.signal, true);
    }
  }
  await run();
}
