import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";
import { sessionOrder } from "../modules/chats/session-order.js";

const order = sessionOrder();
const held = Promise.withResolvers();
const first = order("one", () => held.promise);
assert.equal(await order("two", () => "independent"), "independent");
const next = order("one", () => "next");
held.reject(new Error("refused"));
await assert.rejects(first, /refused/);
assert.equal(await next, "next");

const { window, document } = await dom('<div id="iq-pop" hidden></div><button id="anchor"></button>');
globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
const { createIntel } = await import("../modules/chats/intel.js");
const project = { chatId: "chat", pin: { agent: "codex" } };
const runtimes = ["codex", "claude_code"].map((name) => ({ name, health: { installed: true, logged_in: true } }));
const world = {
  state: { runtimes, policy: {}, chatPolicy: {} },
  project: () => project, thread: () => null,
  act: { loadChatPolicy() {}, refresh() {} },
};
const writes = [];
const modelWrite = Promise.withResolvers();
globalThis.fetch = async (_url, options) => {
  if (options?.method !== "PATCH") return Response.json({ models: [{ id: "picked", name: "Picked" }] });
  const body = JSON.parse(options.body);
  writes.push(body);
  if (body.model) await modelWrite.promise;
  return Response.json({});
};
const picker = createIntel({ world, PROJ: (name) => name, record() {}, onChange() {}, onMoved() {} });
const anchor = document.getElementById("anchor");
const click = (selector) => {
  const target = document.querySelector(selector);
  assert.ok(target, selector);
  target.dispatchEvent(new window.Event("click", { bubbles: true }));
};
try {
  await picker.open("p:work", anchor);
  click('[data-lpage="model"]');
  click('[data-dmodel="picked"]');
  picker.close();
  await picker.open("p:work", anchor);
  click('[data-lpage="rt"]');
  click('[data-lrt="claude_code"]');
  await new Promise(setImmediate);
  assert.equal(writes.length, 1, "the runtime changes after the model save settles");
  assert.equal(writes[0].model, "picked");
  modelWrite.resolve();
  await new Promise(setImmediate);
  assert.deepEqual(writes[1], { agent: "claude_code", model: null, effort: null });
} finally {
  modelWrite.resolve();
  picker.close({ apply: false });
}
