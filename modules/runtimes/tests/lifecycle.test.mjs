// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createScope } from "../../../core/kernel/scope.js";
import { ApiError } from "../../../core/platform/http.js";
import { createLifecycle } from "../lifecycle.js";
import { rowHtml } from "../rows.js";

/** @import { Runtime } from "../../../core/services/runtime-types" */

/** @import { SignInEvent } from "../../../core/platform/sign-in-types" */

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

/** @param {string} name @param {Partial<NonNullable<Runtime["lifecycle"]>>} lc @returns {Runtime} */
const rt = (name, lc) => ({ name, health: {}, lifecycle: { name, state: "ready", installed: true, signed_in: true, actions: [], ...lc } });
/** @param {string} html */
const words = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
/** @param {ReturnType<typeof createLifecycle>} life @param {Runtime} r */
const row = (life, r) => words(rowHtml(r, { flow: life.flow(r.name), job: life.job(r.name), settling: life.settling(r.name) }));

test("a sign-in that ends holds the row until the Space's runtimes show it signed in", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  /** @type {SignInEvent[]} */
  const frames = [{ type: "auth_url", url: "https://cursor.com/login" }, { type: "done", returncode: 0 }];
  const { scope, life, said } = setup({ signInStream: async (_n, o) => { for (const ev of frames) o.on(ev); } });
  t.after(() => scope.dispose());
  await life.signIn("cursor");
  assert.deepEqual(said, ["Cursor signed in."]);
  const stale = rt("cursor", { signed_in: false, actions: ["sign_in"] });
  life.sync([stale]);
  assert.doesNotMatch(row(life, stale), /Not signed in/, "the read taken before the Space recorded the sign-in");
  assert.match(row(life, stale), /Finishing the sign-in…/);
  const now = rt("cursor", { actions: ["sign_in", "sign_out"] });
  life.sync([now]);
  assert.equal(life.settling("cursor"), "");
  assert.match(row(life, now), /Signed in\./);
});

test("a finished job reads as running until the runtimes show it; past the wait, the Space's word stands", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const answers = [job("done")];
  const { scope, life } = setup({ runtimeAction: async () => job("running"), runtimeJob: async () => answers.shift() });
  t.after(() => scope.dispose());
  await life.run("codex", "update");
  t.mock.timers.tick(1000); await flush();
  const stale = rt("codex", { needs_update: true, update: "0.9", actions: ["update"] });
  life.sync([stale]);
  assert.match(row(life, stale), /Updating to 0\.9…/);
  assert.doesNotMatch(row(life, stale), /Update to 0\.9/);
  t.mock.timers.tick(15000); await flush();
  assert.equal(life.settling("codex"), "");
  assert.match(row(life, stale), /Update to 0\.9/);
});
