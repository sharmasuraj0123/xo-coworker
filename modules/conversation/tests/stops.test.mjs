// @ts-check

import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { deferred } from "../../../tests/lib/dom.mjs";
import { createConversationStops } from "../stops.js";
import { createPendingRunStops } from "../../../core/services/run-stops.js";

test("conversation Stop owns its undo window and ignores a write settling after disposal", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const commitMs = 100;
  const result = deferred();
  const writes = [];
  const notices = [];
  const stop = createConversationStops({
    world: { act: {
      turnOf: () => "turn",
      stop: (session) => { writes.push(session); return result.promise; },
    } },
    Kit: { COMMIT_MS: commitMs },
    PROJ: () => "Project",
    announce() {},
    schedule() {},
    chatOf: () => null,
    pendingStops: createPendingRunStops(),
    heraldShow: (notice) => notices.push(notice.text),
    dismissStops() {},
    inUse: () => () => null,
    running: (view) => ({ kind: "chat", session: view ?? "a" }),
    workingRuns: () => 0,
  });
  try {
    stop.stopRun();
    assert.equal(stop.isStopping("a"), true);
    mock.timers.tick(commitMs);
    assert.deepEqual(writes, ["a"]);
    stop.stopRun("b");
    assert.equal(stop.isStopping("b"), true);
    stop.dispose();
    assert.equal(stop.isStopping("a") || stop.isStopping("b"), false);
    mock.timers.tick(commitMs);
    result.resolve({ stopped: true });
    await new Promise(setImmediate);
    assert.deepEqual(writes, ["a"], "the second Stop never outlives its undo window's owner");
    assert.deepEqual(notices, ["Stopping", "Stopping"], "the late write does not publish a receipt");
  } finally {
    stop.dispose();
    mock.timers.reset();
  }
});

test("Interrupt on a plain chat's waiting message stops its turn, with the same undo window as a thread", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const writes = [], notices = [];
  const stop = createConversationStops({
    world: { act: { turnOf: () => "turn", stop: (session) => { writes.push(session); return Promise.resolve({ stopped: true }); } } },
    Kit: { COMMIT_MS: 100 }, PROJ: () => "Project", announce() {}, schedule() {}, chatOf: () => null,
    pendingStops: createPendingRunStops(), heraldShow: (notice) => notices.push(notice.text), dismissStops() {}, inUse: () => () => null,
    running: (view) => ({ kind: "chat", session: String(view).slice(2) }), workingRuns: () => 0,
  });
  try {
    stop.interruptRun("c:s1");
    assert.deepEqual(notices, ["Interrupting"]);
    mock.timers.tick(100);
    assert.deepEqual(writes, ["s1"]);
  } finally {
    stop.dispose();
    mock.timers.reset();
  }
});
