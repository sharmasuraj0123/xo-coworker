// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { createScope } from "../../../core/kernel/scope.js";
import { createAct } from "../../../core/services/storm/act.js";
import { dom } from "../../../tests/lib/dom.mjs";
import { createRunsStrip } from "../strip.js";

const { document } = await dom('<div id="strip"></div>');
const box = document.getElementById("strip");
assert.ok(box);
const reads = [];
let renders = 0, showCounts = true;
let response = Promise.withResolvers();
const runs = new Map([
  ["working", { id: "working", kind: "subagent", state: "running", title: "Planning", session: "s" }],
  ["waiting", { id: "waiting", kind: "subagent", state: "waiting", title: "Review", session: "s" }],
  ["nested", { id: "nested", kind: "subagent", state: "running", title: "Nested", depth: 2, session: "s" }],
  ["other", { id: "other", kind: "subagent", state: "running", title: "Other session", session: "other" }],
]);
const world = { state: { runs, liveRuns: { s: { running: 3, waiting: 1 } } },
  act: { listRuns(sid) { reads.push(sid); return response.promise; } } };
const { runsStrip, workingRuns } = createRunsStrip({ world, SHAPE: { on: () => showCounts }, schedule: () => { renders++; } });
const thread = { sessionId: "s", runs: { running: 1, waiting: 1, total: 7 }, session: { live_runs: 3 } };
assert.equal(workingRuns(thread), 4, "use the highest known live count");
box.innerHTML = runsStrip(thread);
assert.equal(box.querySelector("[data-runs]")?.getAttribute("aria-label"), "2 sub-agents working, 1 waiting on you");
assert.deepEqual([...box.querySelectorAll("[data-run]")].map((chip) => chip.getAttribute("data-run")), ["working", "waiting"]);
runsStrip(thread);
response.resolve();
await new Promise(setImmediate);
assert.deepEqual(reads, ["s"], "a render with the same count does not repeat the read");
assert.equal(renders, 1);
showCounts = false;
box.innerHTML = runsStrip(thread);
assert.deepEqual([...box.querySelectorAll("[data-run]")].map((chip) => chip.getAttribute("data-run")), ["waiting"]);
showCounts = true;
runs.clear();
box.innerHTML = runsStrip(thread);
assert.equal(box.querySelector("[data-runs]")?.textContent, "7 sub-agents ran");
box.innerHTML = runsStrip({ ...thread, runs: { total: 1 } });
assert.equal(box.querySelector("[data-runs]")?.textContent, "1 sub-agent ran");
world.state.liveRuns.s.running++;
response = Promise.withResolvers();
runsStrip(thread);
await Promise.resolve();
assert.deepEqual(reads, ["s", "s"], "a changed count refreshes the session");

const logged = mock.method(console, "error", () => {});
try {
  runsStrip(thread);
  response.reject(new Error("Read failed"));
  await new Promise(setImmediate);
  assert.equal(logged.mock.calls.length, 1);
  assert.equal(renders, 1);
  response = Promise.withResolvers();
  runsStrip(thread);
  runsStrip(thread);
  response.resolve();
  await new Promise(setImmediate);
  assert.deepEqual(reads, ["s", "s", "s"], "the same count retries a failed read once per flight");
  assert.equal(renders, 2);
} finally {
  logged.mock.restore();
}

const pending = Promise.withResolvers();
const request = Promise.withResolvers();
const scope = createScope();
const fetch = mock.method(globalThis, "fetch", (url, init) => {
  request.resolve({ url: new URL(url, "https://xo.test"), signal: init.signal });
  return pending.promise;
});
try {
  const state = { runs: new Map() };
  let changes = 0;
  const act = createAct({ state, scope, sentAt: () => ({ at: Date.now(), seq: null }), soon: () => { changes++; } });
  const strip = createRunsStrip({ world: { state, act }, SHAPE: { on: () => true }, schedule: () => { changes++; } });
  box.innerHTML = strip.runsStrip({ sessionId: "cancelled-session", runs: { running: 1 } });
  const { url, signal } = await request.promise;
  assert.equal(url.pathname, "/api/chat/sessions/cancelled-session/runs");
  assert.equal(url.searchParams.get("tree"), "true");
  strip.dispose();
  assert.equal(signal.aborted, true, "the mounted strip owns the transport it started");
  pending.resolve(Response.json({ runs: [{ id: "late", state: "running" }] }));
  await new Promise(setImmediate);
  assert.equal(state.runs.has("late"), false, "a retired read cannot update the world");
  assert.equal(changes, 0);
} finally {
  scope.dispose();
  fetch.mock.restore();
}
