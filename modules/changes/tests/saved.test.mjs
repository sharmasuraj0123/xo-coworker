// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { createScope } from "../../../core/kernel/scope.js";
import { createChangeData } from "../data.js";
import { createKernel } from "../../../core/kernel/kernel.js";

test("saving again restarts only that file's quiet interval", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  /** @type {string[][]} */
  const refreshed = [];
  const scope = createScope();
  const kernel = createKernel();
  kernel.register(createChangeData({}, () => {}).module);
  let savedSoon;
  kernel.register({ manifest: { id: "xo.save-test", version: "1.0.0", kernel: "^1.1.0", needs: ["changeData"] },
    activate(ctx) { savedSoon = ctx.use("changeData").save({ saved: (project, rel) => refreshed.push([project, rel]) }, scope); },
  });
  await kernel.start();
  const first = { project: "one", rel: "notes.md" };
  const second = { project: "two", rel: "notes.md" };
  savedSoon(first);
  savedSoon(second);
  t.mock.timers.tick(1000);
  savedSoon(first);
  t.mock.timers.tick(1499);
  assert.deepEqual(refreshed, []);
  t.mock.timers.tick(1);
  assert.deepEqual(refreshed, [["two", "notes.md"]]);
  t.mock.timers.tick(999);
  assert.deepEqual(refreshed, [["two", "notes.md"]]);
  t.mock.timers.tick(1);
  assert.deepEqual(refreshed, [["two", "notes.md"], ["one", "notes.md"]]);
  savedSoon(first);
  scope.dispose();
  t.mock.timers.tick(3000);
  assert.equal(refreshed.length, 2, "Files retirement cancels its pending save refresh");
});
