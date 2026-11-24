// @ts-check
import assert from "node:assert/strict";
import { createRunsStrip } from "../strip.js";

const reads = [];
const act = { listRuns(session, { signal }) {
  const { promise, resolve } = Promise.withResolvers();
  reads.push({ session, signal, resolve });
  return promise;
} };
function createRunsWarm(schedule) {
  const strip = createRunsStrip({ world: { state: { runs: new Map() }, act }, SHAPE: { on: () => true }, schedule });
  return { warm: (sessionId, running) => strip.runsStrip({ sessionId, runs: { running } }), dispose: strip.dispose };
}
let firstRenders = 0, secondRenders = 0;
const first = createRunsWarm(() => { firstRenders++; });
first.warm("same-session", 1);
await new Promise(setImmediate);
assert.equal(reads.length, 1);
first.dispose();
assert.equal(reads[0].signal.aborted, true);

const second = createRunsWarm(() => { secondRenders++; });
second.warm("same-session", 1);
second.warm("same-session", 1);
await new Promise(setImmediate);
assert.equal(reads.length, 2, "a new mount owns a separate request even while the first transport is unresolved");
reads[0].resolve();
await new Promise(setImmediate);
assert.deepEqual([firstRenders, secondRenders], [0, 0]);
reads[1].resolve();
await new Promise(setImmediate);
assert.deepEqual([firstRenders, secondRenders], [0, 1]);
second.warm("same-session", 1);
await new Promise(setImmediate);
assert.equal(reads.length, 2, "the new mount remembers its own successful result");
second.dispose();

const bounded = createRunsWarm(() => {});
bounded.warm("oldest", 1);
await new Promise(setImmediate);
const oldest = reads.at(-1);
for (let i = 0; i < 100; i++) bounded.warm(String(i), 1);
await new Promise(setImmediate);
assert.equal(oldest.signal.aborted, true, "eviction aborts a pending transport");
bounded.dispose();
assert.equal(reads.every(({ signal }) => signal.aborted), true);
for (const read of reads) read.resolve();
