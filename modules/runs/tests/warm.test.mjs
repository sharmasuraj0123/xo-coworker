// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { createScope } from "../../../core/kernel/scope.js";
import { ApiError } from "../../../core/platform/http.js";
import { installWatchedRuns } from "../../../core/services/storm/watched-runs.js";

function fixture(listRuns) {
  const reads = createScope();
  const watched = { thread: "a", side: null };
  const threads = ["a", "b"].map((id) => ({ id, sessionId: id, runs: { running: 1 } }));
  const ctx = { reads, watched, state: { threads, liveRuns: {}, runs: new Map() } };
  installWatchedRuns(ctx, listRuns);
  return ctx;
}

test("reads follow both watched threads, deduplicate counts and retire with the cycle", () => {
  const calls = [];
  const ctx = fixture(async (session, { signal }) => { calls.push({ session, signal }); });
  ctx.syncWatchedRuns();
  ctx.watched.side = "a";
  ctx.syncWatchedRuns();
  ctx.watched.side = "b";
  ctx.syncWatchedRuns();
  assert.deepEqual(calls.map((call) => call.session), ["a", "b"]);
  ctx.watched.thread = null;
  ctx.syncWatchedRuns();
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(calls[1].signal.aborted, false);
  ctx.reads.dispose();
  assert.equal(calls[1].signal.aborted, true);
});

test("world updates during backoff do not dispatch another read", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let attempts = 0;
  const ctx = fixture(async () => { attempts++; throw new ApiError(503, "unavailable", "Unavailable"); });
  ctx.syncWatchedRuns();
  await new Promise(setImmediate);
  for (let i = 0; i < 10; i++) ctx.syncWatchedRuns();
  assert.equal(attempts, 1);
  t.mock.timers.tick(999);
  assert.equal(attempts, 1);
  t.mock.timers.tick(1);
  assert.equal(attempts, 2);
  await new Promise(setImmediate);
  ctx.reads.dispose();
  t.mock.timers.tick(10000);
  assert.equal(attempts, 2);
});
