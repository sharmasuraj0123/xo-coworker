// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createConversationPaging } from "../paging.js";

const { document } = await dom('<section tabindex="-1"><div><button data-older>Earlier messages</button></div></section>');
const scroller = document.querySelector("section");
const msgs = scroller?.querySelector("div");
assert.ok(scroller && msgs);
const button = msgs.querySelector("[data-older]");
assert.ok(button instanceof HTMLElement);
/** @type {string[]} */
const calls = [];
let top = 601;
/** @type {Array<() => void>} */
const finishes = [];
const MAIN = { view: "t:thread-1", rendered: "t:thread-1", scroller, msgs, follow: { fromTop: () => top } };
const history = { loaded: true, all: false, before: 50, olderError: null };
const { loadAhead, loadOlderNow } = createConversationPaging({
  MAIN, CH: { isChats: () => false },
  world: {
    state: { hist: {}, threadHist: { "thread-1": history } },
    act: {
      loadOlder: async () => assert.fail("thread history must use the thread route"),
      loadOlderThread: (id) => {
        calls.push(id);
        return new Promise((resolve) => { finishes.push(() => resolve(undefined)); });
      },
    },
  },
  convThread: () => ({ id: "thread-1" }), chatOf: () => null,
  render() { msgs.innerHTML = "<button data-older>More earlier messages</button>"; },
});

Object.defineProperty(scroller, "clientHeight", { value: 500 });
loadAhead();
assert.deepEqual(calls, [], "a distant viewport leaves history alone");
top = 600;
loadAhead();
assert.deepEqual(calls, ["thread-1"], "history is read before it reaches the top");
finishes.shift()?.();

history.olderError = "Temporarily unavailable";
button.focus();
loadOlderNow();
assert.equal(history.olderError, null);
assert.ok(document.activeElement === scroller, "Retry keeps focus in the conversation while reading");
assert.deepEqual(calls, ["thread-1", "thread-1"]);
finishes.shift()?.();
await Promise.resolve();
assert.ok(document.activeElement === msgs.querySelector("[data-older]"), "the new history control receives focus");
