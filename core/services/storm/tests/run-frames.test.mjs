import assert from "node:assert/strict";
import test from "node:test";
import { runs } from "../reducers/runs.js";

test("a malformed run frame keeps invalid identifiers and counters out of the store", () => {
  const ctx = { state: { rejectedFrames: new Map(), runs: new Map(), liveRuns: {} }, soon() {} };
  const env = { session_id: "s", seq: 1 };
  runs["run.started"](ctx, env, { run_id: { id: "r" } });
  assert.equal(ctx.state.runs.size, 0);
  runs["run.started"](ctx, env, { run_id: "r", info: { title: [], depth: "3" } });
  const row = ctx.state.runs.get("r");
  assert.equal(row.title, "Sub-agent");
  assert.equal(row.depth, 1);
  runs.runs(ctx, env, { session: "s", running: "3", waiting: 2 });
  assert.equal(ctx.state.liveRuns.s.running, 0);
  assert.equal(ctx.state.liveRuns.s.waiting, 2);
});
