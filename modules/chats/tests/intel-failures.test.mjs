// @ts-check

import assert from "node:assert/strict";
import { deferred, dom } from "../../../tests/lib/dom.mjs";

const { document } = await dom('<div id="iq-pop" tabindex="-1" hidden></div><button id="anchor"></button>');
const reports = [], moves = [];
Object.assign(globalThis, {
  matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  reportError: (error) => reports.push(error),
});
const { createIntel } = await import("../intel.js");
const thread = { id: "one", project: "demo", chatId: "chat", session: { agent: "codex" } };
const pop = document.getElementById("iq-pop"), anchor = document.getElementById("anchor");
const runtimes = ["codex", "claude_code"].map((name) => ({ name, health: { installed: true, logged_in: true } }));
let detail = deferred();
let reads = 0;
const world = {
  state: { runtimes, policy: { effective: { allowed: ["codex", "claude_code"] } }, chatPolicy: {} },
  thread: () => thread, project: () => ({ chatId: "chat" }),
  act: { policyFor: () => null, loadChatPolicy() {}, fetchThread: () => { reads++; return detail.promise; } },
};
const pickerFor = () => createIntel({
  world, PROJ: String, record() {}, onChange() {}, onMoved: (...args) => moves.push(args),
});
let status = 503;
globalThis.fetch = async (url) => {
  const path = String(url);
  if (path.endsWith("/continue")) return Response.json({ thread_id: "continued", agent: "claude_code" });
  if (status === 200 || path.includes("/claude_code/")) return Response.json({ models: [] });
  return Response.json({ detail: "Catalog down" }, { status });
};
const flush = () => new Promise(setImmediate);

const picker = pickerFor();
await picker.open("t:one", anchor);
await flush();
assert.match(pop.textContent, /models can't be read right now/);
assert.deepEqual(reports, [], "the temporary catalog outage has an expected fallback");
picker.close({ apply: false });
status = 500;
await picker.open("t:one", anchor);
await flush();
assert.match(pop.textContent, /Catalog down/);
assert.equal(reports.length, 1, "report the unexpected catalog failure once");
picker.close({ apply: false });

status = 200;
await picker.open("t:one", anchor, { rt: "claude_code" });
await flush();
pop.querySelector("[data-mv-go]").click();
await flush();
assert.equal(reads, 1);
const detailError = new Error("Cannot hydrate continuation");
detail.reject(detailError);
await flush();
assert.equal(reports.at(-1), detailError, "a failed continuation read is reported");
assert.equal(reports.length, 2);
assert.deepEqual(moves, [[null, "claude_code"]], "the accepted move still completes when its detail is unavailable");
picker.dispose();

detail = deferred();
const retired = pickerFor();
await retired.open("t:one", anchor, { rt: "claude_code" });
await flush();
pop.querySelector("[data-mv-go]").click();
await flush();
assert.equal(reads, 2);
retired.dispose();
detail.reject(new Error("Late detail error"));
await flush();
assert.equal(reports.length, 2);
assert.equal(moves.length, 1, "the retired picker cannot publish a late continuation");
