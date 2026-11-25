import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../../../platform/http.js";
import { installLoad } from "../load.js";
import { client } from "../client.js";
import { createScope } from "../../../kernel/scope.js";
import { resumeReadRetries, retryRead } from "../read-policy.js";

test("a ten-second outage recovers on the same scope with one report and capped delays", async (t) => {
  const delays = [], jobs = new Set(), errors = [];
  let now = 0, recovered = false;
  t.mock.method(console, "error", (error) => errors.push(error));
  const timers = { setTimeout(fn, ms) { jobs.add(fn); delays.push(ms); return fn; }, clearTimeout(fn) { jobs.delete(fn); } };
  const scope = createScope({ timers });
  const error = new ApiError(503, "network", "Unavailable");
  await retryRead(scope, async () => { if (now < 10000) throw error; recovered = true; });
  while (jobs.size && now < 61000) {
    now += delays.at(-1);
    [...jobs][0]();
    await Promise.resolve();
  }
  assert.deepEqual(delays.slice(0, 3), [1000, 2000, 4000]);
  assert.ok(delays.every((delay) => delay <= 60000));
  assert.ok(recovered);
  assert.equal(jobs.size, 0);
  assert.deepEqual(errors, [error]);
  scope.dispose();
});

test("a connectivity signal retries a pending read once and retirement cancels the next retry", async (t) => {
  const scope = createScope();
  t.after(scope.dispose);
  let attempts = 0;
  await retryRead(scope, async () => { attempts++; throw new ApiError(503, "offline", "Offline"); });
  resumeReadRetries(scope.signal);
  resumeReadRetries(scope.signal);
  await Promise.resolve();
  assert.equal(attempts, 2);
  scope.dispose();
  resumeReadRetries(scope.signal);
  assert.equal(attempts, 2);
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
