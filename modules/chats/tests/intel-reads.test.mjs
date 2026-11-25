// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";

const { document } = await dom('<div id="iq-pop" tabindex="-1" hidden></div><button id="anchor"></button>');
globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
const { createIntel } = await import("../intel.js");
const thread = { id: "one", project: "demo", chatId: "chat", session: { agent: "codex", model: "current" } };
const project = { chatId: "chat", pin: { agent: "codex" } };
const runtimes = ["codex", "claude_code"].map((name) => ({ name, health: { installed: true, logged_in: true } }));
const world = {
  state: { runtimes, policy: { effective: { allowed: ["codex", "claude_code"] } }, chatPolicy: {} },
  thread: () => thread, project: () => project,
  act: { policyFor: () => null, loadChatPolicy() {} },
};
let changes = 0;
const picker = createIntel({ world, PROJ: (name) => name, record() {}, onChange() { changes++; }, onMoved() {} });
const pop = document.getElementById("iq-pop");
const anchor = document.getElementById("anchor");
const requests = [];
const pending = [];
globalThis.fetch = async (url, options) => {
  const path = String(url);
  requests.push(path);
  if (!path.includes("/claude_code/")) return Response.json({ models: [{ id: "current", name: "Current model" }] });
  const { promise, resolve, reject } = Promise.withResolvers();
  const signal = options?.signal;
  pending.push({ resolve, signal });
  signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  return promise;
};

mock.timers.enable({ apis: ["setTimeout", "Date"] });
try {
  picker.chipHtml("t:one");
  await new Promise(setImmediate);
  assert.equal(requests.length, 0, "rendering the chip does not start a catalog read");
  picker.activate(["t:one", "t:one"]);
  picker.activate(["t:one"]);
  await new Promise(setImmediate);
  assert.equal(requests.length, 1, "two active composers share a runtime catalog read");
  assert.match(picker.chipHtml("t:one"), /Current model/);
  assert.equal(changes, 1);
  assert.equal(pop.hidden, true);
  await picker.open("t:one", anchor, { rt: "claude_code" });
  assert.equal(pop.classList.contains("is-sheet"), true);
  assert.equal(pending.length, 1);
  pending[0].resolve(Response.json({ models: [
    { id: "move", name: "Move model" }, { id: "unnamed-model", name: null, description: null },
  ] }));
  await new Promise(setImmediate);
  assert.equal(pop.querySelector('[data-mvm="move"]')?.textContent, "Move model");
  assert.equal(pop.querySelector('[data-mvm="unnamed-model"]')?.textContent, "unnamed-model");
  mock.timers.tick(30_000);
  assert.doesNotMatch(pop.textContent, /models are slow/);
  picker.close({ apply: false });
  picker.dispose();

  const second = createIntel({ world, PROJ: (name) => name, record() {}, onChange() {}, onMoved() {} });
  await second.open("t:one", anchor, { rt: "claude_code" });
  assert.equal(pending.length, 2);
  mock.timers.tick(20_000);
  await new Promise(setImmediate);
  assert.doesNotMatch(pop.textContent, /models are slow/, "only the HTTP request owns a timeout");
  mock.timers.tick(10_000);
  await new Promise(setImmediate);
  assert.match(pop.textContent, /models are slow to read; its default still works/);
  assert.equal(pending[1].signal.aborted, true);
  second.close({ apply: false });

  await second.open("t:one", anchor, { rt: "claude_code" });
  assert.equal(pending.length, 3);
  second.close({ apply: false });
  await new Promise(setImmediate);
  assert.equal(pending[2].signal.aborted, true, "closing cancels outstanding catalog reads");
  thread.session.agent = "claude_code";
  second.activate(["t:one"]);
  await new Promise(setImmediate);
  assert.equal(pending.length, 4);
  second.dispose();
  assert.equal(pending[3].signal.aborted, true, "unloading cancels active composer reads");
} finally {
  mock.timers.reset();
}
