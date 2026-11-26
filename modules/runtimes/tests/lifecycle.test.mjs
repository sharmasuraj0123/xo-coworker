// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createScope } from "../../../core/kernel/scope.js";
import { ApiError } from "../../../core/platform/http.js";
import { createLifecycle } from "../lifecycle.js";

/** @param {Record<string, Function>} calls */
function setup(calls) {
  const scope = createScope(), said = [], refreshed = [];
  const api = /** @type {import("../lifecycle-types").LifecycleApi} */ (/** @type {unknown} */ (calls));
  const life = createLifecycle({ api, scope, refresh: () => refreshed.push(1), announce: (w) => said.push(w) });
  return { scope, life, said, refreshed };
}
const job = (status, log = []) => ({ id: "j1", runtime: "codex", action: "update", status, log, result: null });
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("a job is read once a second until it ends, then the runtimes are read again", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const answers = [job("running", ["a"]), job("done", ["a", "b"])];
  const { scope, life, said, refreshed } = setup({ runtimeAction: async () => job("running"), runtimeJob: async () => answers.shift() });
  t.after(() => scope.dispose());
  await life.run("codex", "update");
  assert.equal(life.job("codex")?.status, "running");
  t.mock.timers.tick(1000); await flush();
  assert.deepEqual(life.job("codex")?.log, ["a"]);
  t.mock.timers.tick(1000); await flush();
  assert.equal(life.job("codex")?.status, "done");
  assert.deepEqual(said, ["Codex updated."]);
  assert.ok(refreshed.length >= 2);
  t.mock.timers.tick(5000); await flush();
  assert.equal(answers.length, 0, "no read after the job ended");
});

test("an uninstall threads run on hands back their sessions; a running job is followed instead", async (t) => {
  const inUse = new ApiError(409, "runtime_in_use", "in use", { sessions: ["s1", "s2"] });
  const running = new ApiError(409, "job_running", "busy", { job: "j9" });
  let first = true;
  const { scope, life } = setup({
    runtimeAction: async () => { if (first) { first = false; throw inUse; } throw running; },
    runtimeJob: async () => ({ ...job("failed"), id: "j9", action: "install", result: { message: "npm failed." } }),
  });
  t.after(() => scope.dispose());
  assert.deepEqual(await life.run("codex", "uninstall"), { inUse: ["s1", "s2"] });
  assert.equal(life.job("codex"), null, "nothing ran");
  assert.equal(await life.run("codex", "install"), null);
  await flush();
  assert.equal(life.job("codex")?.id, "j9");
  assert.equal(life.job("codex")?.error, "npm failed.");
});

test("a job the Space forgot in a restart reads as lost", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { scope, life } = setup({
    runtimeAction: async () => job("running"),
    runtimeJob: async () => { throw new ApiError(404, "unknown_job", "gone"); },
  });
  t.after(() => scope.dispose());
  await life.run("codex", "update");
  t.mock.timers.tick(1000); await flush();
  assert.equal(life.job("codex")?.status, "failed");
  assert.equal(life.job("codex")?.lost, true);
});
