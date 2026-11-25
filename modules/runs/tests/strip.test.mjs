// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createRunsStrip } from "../strip.js";

const { document } = await dom('<div id="strip"></div>');
const box = document.getElementById("strip");
assert.ok(box);
const reads = [];
let showCounts = true;
const runs = new Map([
  ["working", { id: "working", kind: "subagent", state: "running", title: "Planning", session: "s" }],
  ["waiting", { id: "waiting", kind: "subagent", state: "waiting", title: "Review", session: "s" }],
  ["nested", { id: "nested", kind: "subagent", state: "running", title: "Nested", depth: 2, session: "s" }],
  ["other", { id: "other", kind: "subagent", state: "running", title: "Other session", session: "other" }],
]);
const world = { state: { runs, liveRuns: { s: { running: 3, waiting: 1 } } },
  act: { listRuns(sid) { reads.push(sid); throw new Error("render initiated a read"); } } };
const { runsStrip, workingRuns } = createRunsStrip({ world, SHAPE: { on: () => showCounts } });
const thread = { sessionId: "s", runs: { running: 1, waiting: 1, total: 7 }, session: { live_runs: 3 } };
assert.equal(workingRuns(thread), 4, "use the highest known live count");
box.innerHTML = runsStrip(thread);
assert.equal(box.querySelector("[data-runs]")?.getAttribute("aria-label"), "2 sub-agents working, 1 waiting on you");
assert.deepEqual([...box.querySelectorAll("[data-run]")].map((chip) => chip.getAttribute("data-run")), ["working", "waiting"]);
runsStrip(thread);
await new Promise(setImmediate);
assert.deepEqual(reads, [], "rendering reads only the current World state");
showCounts = false;
box.innerHTML = runsStrip(thread);
assert.deepEqual([...box.querySelectorAll("[data-run]")].map((chip) => chip.getAttribute("data-run")), ["waiting"]);
showCounts = true;
runs.clear();
box.innerHTML = runsStrip(thread);
assert.equal(box.querySelector("[data-runs]")?.textContent, "7 sub-agents ran");
box.innerHTML = runsStrip({ ...thread, runs: { total: 1 } });
assert.equal(box.querySelector("[data-runs]")?.textContent, "1 sub-agent ran");
