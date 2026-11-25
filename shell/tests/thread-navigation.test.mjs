// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../tests/lib/dom.mjs";
import { createPanelThreadOpener } from "../panel/thread-navigation.js";

const { document } = await dom('<button data-go="t:thread" data-go-msg="message"><b>Open thread</b></button>');
const target = document.querySelector("b");
let view = "p:p";
const calls = [];
const panel = { view: "thread" };
const go = createPanelThreadOpener({
  view: () => view, world: { thread: (id) => id === "thread" ? { id } : null },
  panelConversation: () => panel,
  go: (...args) => calls.push(["go", ...args]), showMsg: (...args) => calls.push(["message", ...args]),
});
const open = (destination, event) => go(destination, event, (...args) => calls.push(["page", ...args]));
open("t:thread", { target, pointerType: "touch", detail: 1 });
assert.deepEqual(calls.splice(0), [["page", "thread", "thread", { focus: true, input: "touch" }], ["message", "message", panel]]);
open("t:thread", { target, ctrlKey: true });
assert.deepEqual(calls.splice(0), [["go", "t:thread", { panel: true }], ["message", "message"]]);
open("t:missing");
assert.deepEqual(calls.splice(0), [["go", "t:missing", { panel: true }]]);
view = "t:another";
open("t:thread", { target });
assert.deepEqual(calls.splice(0), [["go", "t:thread", { panel: true }], ["message", "message"]]);
