// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";
import { createScope } from "../../../core/kernel/scope.js";
import { createDockRefresh } from "../dock-refresh.js";
import replies from "../../../core/platform/tests/fixtures/terminal-responses.json" with { type: "json" };

const { document, window } = await dom("");
const scope = createScope();
let hidden = false;
Object.defineProperty(document, "hidden", { get: () => hidden });
let reads = 0;
let holdRead = false;
let transport;
globalThis.fetch = async (url, options) => {
  if (String(url).endsWith("/status")) return Response.json(replies.status);
  reads++;
  if (holdRead) {
    const signal = options?.signal;
    transport = signal;
    return new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason), { once: true }));
  }
  return Response.json({ terminals: [] });
};
const state = /** @type {import("../dock-types").DockState} */ ({ enabled: false, statusAt: 0, loaded: false });
const { refresh, refreshSoon } = createDockRefresh(state, { scope, listShown: () => !hidden, changed() {}, offNow() {} });
const visibility = (value) => { hidden = value; document.dispatchEvent(new window.Event("visibilitychange")); };
mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100 });
try {
  await refresh({ status: true });
  assert.equal(reads, 1);
  refreshSoon();
  visibility(true);
  mock.timers.tick(120_000);
  await new Promise(setImmediate);
  assert.equal(reads, 1, "hidden tabs cancel both the regular poll and the delayed refresh");
  visibility(false);
  await new Promise(setImmediate);
  assert.equal(reads, 2, "visibility resumes polling once");
  holdRead = true;
  const active = refresh();
  await new Promise(setImmediate);
  visibility(true);
  assert.equal(transport?.aborted, true, "hiding aborts the pending read");
  await active;
  assert.equal(reads, 3);
  scope.dispose();
  assert.equal(scope.size, 0);
  visibility(true);
  visibility(false);
  mock.timers.tick(120_000);
  await new Promise(setImmediate);
  assert.equal(reads, 3);
} finally {
  scope.dispose();
  mock.timers.reset();
}
