import assert from "node:assert/strict";
import { createScope } from "../core/kernel/scope.js";
import { createChecklistRenderer } from "../modules/conversation/checklist.js";
import { dom, same } from "./lib/dom.mjs";

const { document } = await dom('<header id="thead"></header>');
const head = document.getElementById("thead");
const scope = createScope();
const thread = { id: "thread", state: "working", checklist: { total: 0, done: 0, items: [] } };
let runs = "";
const checklist = createChecklistRenderer({
  view: () => "t:thread", scope, SHAPE: { on: () => false },
  convThread: () => thread, runsStrip: () => runs, schedule() {},
});

checklist.render([], head);
assert.equal(head.hidden, true);
assert.equal(head.querySelector("[data-ck]") !== null, false);
assert.doesNotMatch(head.textContent, /0 of 0|All 0/);

runs = '<button type="button">Sub-agents</button>';
checklist.render([], head);
assert.equal(head.hidden, false);
const entry = head.querySelector("button");
entry.focus();
checklist.render([], head);
same(document.activeElement, entry);
assert.equal(head.querySelector("[data-ck]") !== null, false, "an unplanned thread may still have runs");

thread.checklist = { total: 1, done: 1, items: [{ state: "done", text: "Validate the result" }] };
checklist.render([], head);
assert.match(head.textContent, /1 of 1/);
assert.match(head.textContent, /All 1 steps done/);
assert.equal(head.querySelector("[data-ck]").getAttribute("aria-expanded"), "false");
checklist.toggle(thread.id);
checklist.render([], head);
assert.equal(head.querySelector("[data-ck]").getAttribute("aria-expanded"), "true");
scope.dispose();
