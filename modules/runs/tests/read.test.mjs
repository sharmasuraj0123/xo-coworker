// @ts-check
import assert from "node:assert/strict";
import { createRunsReads } from "../read.js";

/** @type {import("../read-types.d.ts").RunsReadDeps["RS"]} */
const RS = { open: true, session: "session", opening: 1, gen: 0, title: "Runs", view: "list", runId: null, returnTo: null,
  tree: [], counts: null, said: null, cmdsOpen: true, cmdsAll: false, run: null, anc: null, items: [], cursor: null,
  children: [], loading: false, error: null, gone: null, pollT: null };
const run = { id: "run", state: "done", kind: "subagent" };
const child = { ...run, id: "child" };
const stale = Promise.withResolvers();
let requests = 0, paints = 0, repaints = 0;
const cursors = [];
const reads = createRunsReads({ RS, world: { state: { runs: new Map([[run.id, run]]) }, act: {
  listRuns: () => ++requests === 1 ? stale.promise : Promise.resolve({ runs: [{ ...run, children: [child] }], counts: { done: 1 } }),
  async run() { return { ...run, title: "Review" }; },
  async transcript(_id, cursor) {
    cursors.push(cursor);
    return cursor === null ? { items: [{ id: "one", type: "text" }], next: "next" }
      : { items: [{ id: "one", type: "text" }, { id: "two", type: "text" }] };
  },
} }, STAGE: { repaint() { repaints++; } }, runsRender() { paints++; } });

const older = reads.readRunsList("session");
RS.opening++;
assert.equal(await reads.readRunsList("session"), true);
stale.resolve({ runs: [], counts: { done: 99 } });
assert.equal(await older, false);
assert.deepEqual(RS.counts, { done: 1 });
await reads.openRun("run");
assert.equal(RS.run?.title, "Review");
assert.deepEqual(RS.children, [child]);
assert.deepEqual(cursors, [null, "next"]);
assert.deepEqual(RS.items.map((item) => item.id), ["one", "two"]);
assert.equal(RS.pollT, null, "a completed run schedules no further requests");
assert.equal(paints, 3);
assert.equal(repaints, 2);
