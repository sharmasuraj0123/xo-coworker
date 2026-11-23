// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";
import { createRowResolve } from "../row-resolve.js";

const { document } = await dom('<section id="all"><ul id="all-list"><li class="is-swiping is-armed"></li></ul></section>');
const allEl = document.querySelector("#all");
const row = allEl.querySelector("li");
/** @type {boolean[]} */
const requests = [];
/** @type {Set<() => void>} */
const commits = new Set();
const thread = { title: "Research", state: "working" };
let refused = true;
const resolveFromRow = createRowResolve({
  world: {
    thread: () => thread,
    subscribe(listener) { commits.add(listener); return () => { commits.delete(listener); }; },
  },
  async resolveThread(id, resolved, options) {
    assert.equal(id, "thread");
    assert.deepEqual(options, { undo: false, sayFail: false });
    requests.push(resolved);
    return refused ? { ok: false, why: "Connection lost" } : { ok: true };
  },
  allEl,
  allRender() {
    allEl.querySelector("#all-list").innerHTML = '<li><button data-go="t:thread">Research</button></li>';
  },
});

mock.timers.enable({ apis: ["setTimeout"] });
try {
  resolveFromRow("thread", true, row);
  const action = row.querySelector("[data-ar-undo]");
  assert.equal(row.classList.contains("is-swiping"), false);
  assert.equal(action.getAttribute("aria-busy"), "true");
  await Promise.resolve();
  assert.equal(action.textContent, "Retry");
  assert.equal(row.querySelector("span").title, "Connection lost");
  refused = false;
  action.click();
  await Promise.resolve();
  assert.equal(action.textContent, "Undo");
  assert.deepEqual(requests, [true, true]);
  thread.state = "resolved";
  action.focus();
  action.click();
  await Promise.resolve();
  assert.deepEqual(requests, [true, true, false]);
  assert.ok(row.isConnected, "Undo waits for the world commit before replacing the row");
  thread.state = "working";
  for (const listener of commits) listener();
  const restored = allEl.querySelector('[data-go="t:thread"]');
  assert.ok(restored && restored === document.activeElement, "focus moves from Undo to the restored row");
  assert.equal(commits.size, 0);
} finally {
  mock.timers.reset();
}
