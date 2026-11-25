import assert from "node:assert/strict";
import { test } from "node:test";
import { readJsonEvents, SSEStream } from "../sse.js";

const frame = (id, event, data) => `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const settle = () => new Promise(setImmediate);

test("malformed JSON is skipped and a consumer exception is reported before later events", async (t) => {
  const failure = new Error("consumer threw");
  const response = new Response('data: ping\n\ndata: {"type":"bad"}\n\ndata: {"type":"live"}\n\n');
  const seen = [], errors = [];
  t.mock.method(console, "error", (error) => errors.push(error));
  await readJsonEvents(response, (value) => {
    if (value.type === "bad") throw failure;
    seen.push(value);
  }, new AbortController().signal);
  assert.deepEqual(seen, [{ type: "live" }]);
  assert.deepEqual(errors, [failure]);
  assert.equal(response.body.locked, false);
});

test("a bad frame consumer is reported and a later frame in the same chunk arrives", async (t) => {
  const failure = new Error("frame consumer threw");
  const seen = [], reported = [];
  const stream = new SSEStream("/stream", {
    fetchImpl: async () => new Response(frame(1, "message", {}) + 'data: broken\n\n' + frame(2, "message", {})),
    onFrame(message) { if (message.id === "1") throw failure; seen.push(message.id); },
    onError: (error) => reported.push(error),
  }).start();
  t.after(() => stream.close());
  await settle();
  assert.deepEqual(seen, ["2"]);
  assert.deepEqual(reported, [failure]);
});

test("a rejected reset is reported once and resumes with the reset sequence", async (t) => {
  const failure = new Error("reset reload failed");
  const resume = Promise.withResolvers(), reported = [];
  const stream = new SSEStream("/stream", {
    fetchImpl: async (_, request) => {
      if (!request.headers["Last-Event-ID"]) return new Response(frame(1, "reset", { data: { reason: "retention", from_seq: 8 } }));
      resume.resolve(request.headers["Last-Event-ID"]);
      return new Response(null);
    },
    async onReset() { throw failure; },
    onError: (error) => reported.push(error),
  }).start();
  t.after(() => stream.close());
  assert.equal(await Promise.race([resume.promise, new Promise((resolve) => setTimeout(resolve, 200, null))]), "8");
  assert.deepEqual(reported, [failure]);
});

test("retiring from the connecting notification cancels the watchdog before dispatch", async (t) => {
  const set = globalThis.setTimeout, clear = globalThis.clearTimeout;
  const timers = new Set();
  t.mock.method(globalThis, "setTimeout", (fn, delay) => {
    const handle = set(fn, delay);
    timers.add(handle);
    return handle;
  });
  t.mock.method(globalThis, "clearTimeout", (handle) => { timers.delete(handle); clear(handle); });
  t.after(() => { for (const handle of timers) clear(handle); });
  let reads = 0;
  const stream = new SSEStream("/stream", {
    fetchImpl: async () => { reads++; return new Response(""); },
    onState(state) { if (state === "connecting") stream.close(); },
  });
  stream.start();
  await settle();
  assert.equal(reads, 0);
  assert.equal(timers.size, 0);
});
