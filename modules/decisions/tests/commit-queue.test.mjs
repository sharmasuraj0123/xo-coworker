import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { createDecisionQueue } from "../queue.js";
import { COMMIT_MS } from "../kit.js";

function mount(t) {
  const window = new EventTarget();
  t.mock.method(window, "addEventListener");
  t.mock.method(window, "removeEventListener");
  globalThis.window = window;
  t.after(() => { delete globalThis.window; });
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  t.mock.method(globalThis, "clearTimeout");
  const held = Promise.withResolvers();
  const sends = [], changes = [];
  const ask = { id: "perm", kind: "permission", title: "Run npm test" };
  const thread = { id: "thread", state: "working", asks: [ask] };
  const part = { key: "ask", t: thread, ask, choice: "allow", note: "", entry: { status: "queued" } };
  const send = (...args) => { sends.push(args); return held.promise; };
  const queue = createDecisionQueue({
    world: { act: { decide: send, decideItem: send } },
    F: { open: false, status: new Map() },
    log: [], sentKeys: new Map(), stoppedDone: new Set(), noSecret: new Set(),
    show() {}, announce: (words) => changes.push(words), toastRender() {},
    render: () => changes.push("render"), onSent: () => changes.push("sent"),
  });
  t.after(queue.dispose);
  const hide = (persisted) => window.dispatchEvent(Object.assign(new Event("pagehide"), { persisted }));
  return { window, held, sends, changes, ask, thread, part, queue, hide };
}

test("persisted pagehide keeps Undo and settlement live", async (t) => {
  const { held, sends, changes, thread, part, queue, hide } = mount(t);
  const item = queue.push([part]);
  hide(true);
  assert.equal(queue.undo(item.id), item);
  t.mock.timers.tick(COMMIT_MS);
  await setImmediate();
  assert.deepEqual(sends, []);
  queue.push([part]);
  t.mock.timers.tick(COMMIT_MS - 1);
  assert.deepEqual(sends, []);
  t.mock.timers.tick(1);
  await setImmediate();
  assert.deepEqual(sends, [["perm", "allow", ""]]);
  held.resolve();
  await setImmediate();
  assert.equal(part.entry.status, "sent");
  assert.deepEqual(thread.asks, []);
  assert.equal(changes.filter((change) => change === "sent").length, 1);
});

test("permanent pagehide removes the listener and cancels an unissued decision", async (t) => {
  const { window, sends, part, queue, hide } = mount(t);
  queue.push([part]);
  hide(false);
  assert.equal(window.removeEventListener.mock.callCount(), 1);
  assert.equal(window.removeEventListener.mock.calls[0].arguments[1], window.addEventListener.mock.calls[0].arguments[1]);
  assert.equal(clearTimeout.mock.callCount(), 1);
  assert.equal(queue.queued.length, 0);
  assert.equal(queue.push([part]), null);
  t.mock.timers.tick(COMMIT_MS);
  await setImmediate();
  assert.deepEqual(sends, []);
});

test("permanent pagehide leaves the issued decision alone and retires its settlement", async (t) => {
  const { held, sends, changes, ask, thread, part, queue, hide } = mount(t);
  queue.push([part]);
  t.mock.timers.tick(COMMIT_MS);
  await setImmediate();
  assert.deepEqual(sends, [["perm", "allow", ""]]);
  assert.equal(queue.inflight.length, 1);
  hide(false);
  assert.equal(queue.inflight.length, 0);
  const before = [...changes];
  held.resolve();
  await setImmediate();
  assert.deepEqual(thread.asks, [ask]);
  assert.equal(part.entry.status, "sending");
  assert.deepEqual(changes, before);
});

test("retirement after the delay but before dispatch prevents the write", async (t) => {
  const { sends, part, queue, hide } = mount(t);
  queue.push([part]);
  t.mock.timers.tick(COMMIT_MS);
  assert.equal(part.entry.status, "sending");
  hide(false);
  await setImmediate();
  assert.deepEqual(sends, []);
});

test("a rejection carrying the same accepted decision is counted as sent", async (t) => {
  const { held, sends, changes, part, queue } = mount(t);
  const body = { decision: "approve", idempotency_key: "our-key" };
  const review = { ...part, ask: { ...part.ask, item: { id: "review" } }, choice: { storm: true, body } };
  queue.push([review]);
  t.mock.timers.tick(COMMIT_MS);
  await setImmediate();
  assert.deepEqual(sends, [["review", body]]);
  held.reject(Object.assign(new Error("Already decided"), { gone: "already_decided", item: { decision: body } }));
  await setImmediate();
  assert.equal(review.entry.status, "sent");
  assert.equal(changes.filter((change) => change === "sent").length, 1);
});
