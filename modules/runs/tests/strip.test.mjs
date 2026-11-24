// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createRunsStrip } from "../strip.js";

const { document } = await dom('<div id="strip"></div>');
const box = document.getElementById("strip");
assert.ok(box);
const reads = [];
let renders = 0, showCounts = true;
const runs = new Map([
  ["working", { id: "working", kind: "subagent", state: "running", title: "Planning", session: "s" }],
  ["waiting", { id: "waiting", kind: "subagent", state: "waiting", title: "Review", session: "s" }],
  ["nested", { id: "nested", kind: "subagent", state: "running", title: "Nested", depth: 2, session: "s" }],
  ["other", { id: "other", kind: "subagent", state: "running", title: "Other session", session: "other" }],
]);
const world = { state: { runs, liveRuns: { s: { running: 3, waiting: 1 } } },
  act: { async listRuns(sid) { reads.push(sid); } } };
const { runsStrip, workingRuns } = createRunsStrip({ world, SHAPE: { on: () => showCounts }, schedule: () => { renders++; } });
const thread = { sessionId: "s", runs: { running: 1, waiting: 1, total: 7 }, session: { live_runs: 3 } };
assert.equal(workingRuns(thread), 4, "use the highest known live count");
box.innerHTML = runsStrip(thread);
assert.equal(box.querySelector("[data-runs]")?.getAttribute("aria-label"), "2 sub-agents working, 1 waiting on you");
assert.deepEqual([...box.querySelectorAll("[data-run]")].map((chip) => chip.getAttribute("data-run")), ["working", "waiting"]);
runsStrip(thread);
await Promise.resolve();
assert.deepEqual(reads, ["s"], "a render with the same count does not repeat the read");
assert.equal(renders, 1);
showCounts = false;
box.innerHTML = runsStrip(thread);
assert.deepEqual([...box.querySelectorAll("[data-run]")].map((chip) => chip.getAttribute("data-run")), ["waiting"]);
showCounts = true;
runs.clear();
box.innerHTML = runsStrip(thread);
assert.equal(box.querySelector("[data-runs]")?.textContent, "7 sub-agents ran");
world.state.liveRuns.s.running++;
runsStrip(thread);
assert.deepEqual(reads, ["s", "s"], "a changed count refreshes the session");
