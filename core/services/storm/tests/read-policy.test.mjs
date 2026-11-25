import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../../../platform/http.js";
import { installLoad } from "../load.js";
import { client } from "../client.js";
import { retryRead } from "../read-policy.js";

test("transient reads back off, stop and report the terminal failure once", async (t) => {
  const delays = [], jobs = [], errors = [];
  t.mock.method(console, "error", (error) => errors.push(error));
  const scope = { signal: new AbortController().signal, timeout(fn, delay) { jobs.push(fn); delays.push(delay); } };
  const error = new ApiError(0, "network", "Unavailable");
  await retryRead(scope, async () => { throw error; });
  for (let n = 0; jobs.length && n < 8; n++) await jobs.shift()();
  assert.deepEqual(delays, [1000, 2000, 4000]);
  assert.deepEqual(errors, [error]);
});

test("chat recovery schedules transient failures and reports permanent failures without retrying", async (t) => {
  const ctx = { state: {}, reads: { signal: new AbortController().signal }, soon() {}, scheduleRecover() { return ++retries <= 1; } };
  let retries = 0, status = 403;
  const errors = [];
  t.mock.method(console, "error", (error) => errors.push(error.status));
  t.mock.method(client, "chats", async () => { throw new ApiError(status, "failed", "Could not load chats"); });
  installLoad(ctx);
  await ctx.loadChats();
  assert.equal(retries, 0);
  status = 503;
  await ctx.loadChats();
  assert.equal(retries, 1);
  assert.deepEqual(errors, [403]);
  await ctx.loadChats();
  assert.deepEqual(errors, [403, 503]);
});
