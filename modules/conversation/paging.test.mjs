import assert from "node:assert/strict";
import { dom } from "../../tests/lib/dom.mjs";
import { createConversationPaging } from "./paging.js";

const { document } = await dom('<section tabindex="-1"><div><button data-older>Earlier messages</button></div></section>');
const scroller = document.querySelector("section");
const msgs = scroller.firstElementChild;
const button = msgs.querySelector("[data-older]");
const calls = [];
let top = 601;
let finish;
const MAIN = { view: "t:thread-1", rendered: "t:thread-1", scroller, msgs, follow: { fromTop: () => top } };
const history = { loaded: true, all: false, before: 50, olderError: null };
const { loadAhead, loadOlderNow } = createConversationPaging({
  MAIN, CH: { isChats: () => false },
  world: {
    state: { hist: {}, threadHist: { "thread-1": history } },
    act: { loadOlderThread: (id) => {
      calls.push(id);
      return new Promise((resolve) => { finish = resolve; });
    } },
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
finish();

history.olderError = "Temporarily unavailable";
button.focus();
loadOlderNow();
assert.equal(history.olderError, null);
assert.ok(document.activeElement === scroller, "Retry keeps focus in the conversation while reading");
assert.deepEqual(calls, ["thread-1", "thread-1"]);
finish();
await Promise.resolve();
assert.ok(document.activeElement === msgs.querySelector("[data-older]"), "the new history control receives focus");
