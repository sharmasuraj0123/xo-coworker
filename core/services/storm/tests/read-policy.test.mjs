import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../../../platform/http.js";
import { retryRead } from "../read-policy.js";

test("transient reads back off, stop and report the terminal failure once", async (t) => {
  const delays = [], jobs = [], errors = [];
  t.mock.method(console, "error", (error) => errors.push(error));
  const scope = { signal: new AbortController().signal, timeout(fn, delay) { jobs.push(fn); delays.push(delay); } };
  const error = new ApiError(503, "offline", "Unavailable");
  await retryRead(scope, async () => { throw error; });
  for (let n = 0; jobs.length && n < 8; n++) await jobs.shift()();
  assert.deepEqual(delays, [1000, 2000, 4000]);
  assert.deepEqual(errors, [error]);
});
