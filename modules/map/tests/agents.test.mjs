// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";

await dom('<div id="panel"></div>');
const { createMapAgents } = await import("../agents.js");
const at = "2026-11-23T18:00:00Z";
const turns = [
  { session: "worker", status: "running", at },
  { session: "coordinator", status: "running", at },
];
const threads = [
  { id: "worker", title: "Worker", project: "project", cwd: "/srv/project", state: "working", sessionId: "worker" },
  { id: "paused", title: "Paused", project: "project", state: "working", held: { for: "memory" } },
];
const world = {
  state: {
    projects: [{ id: "project" }], threads,
    turns: {
      list: (/** @type {(turn: typeof turns[number]) => boolean} */ select) => turns.filter(select),
      blocksOf: (/** @type {typeof turns[number]} */ turn) => [{ type: "activity", rows: [turn.session === "worker"
        ? { kind: "edit_file", status: "running", target: "/srv/project/source/file.js" }
        : { kind: "command", status: "running", waiting: true }] }],
    },
  },
  act: { coordinatorBusy: (/** @type {string} */ project) => project === "project" ? "coordinator" : null },
  thread: (/** @type {string} */ id) => threads.find((thread) => thread.id === id),
};
const map = createMapAgents({ world, isBusy: (/** @type {typeof threads[number]} */ thread) => thread.id === "worker", stepLineHtml: () => "" });

const [coordinator, worker] = map.agents("p:project");
assert.deepEqual([coordinator.id, coordinator.go, coordinator.doing], ["coord:project", "p:project", "waiting for you"]);
assert.deepEqual([worker.id, worker.go, worker.doing, worker.since], ["worker", "t:worker", "editing file.js", Date.parse(at)]);
assert.equal(map.agents("p:project").length, 2);
assert.equal(map.agents("t:paused")[0].doing, "waiting");
