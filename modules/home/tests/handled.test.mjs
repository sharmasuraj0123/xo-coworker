// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";

const { document } = await dom('<div id="hm-end"></div>');
Object.assign(globalThis, { matchMedia: () => ({ matches: true }) });
const { createHandled } = await import("../handled.js");

const working = [{ project: "project", id: "thread", title: "Thread", checklist: { items: [{ state: "doing", text: "Checking the change" }], done: 1, total: 2 } }];
const parts = { held: [{ key: "waiting", t: { project: "project" }, heldWhy: "Waiting for memory" }] };
const { endRender, setHandled } = createHandled({
  S: { handledOpen: false },
  world: { state: { threads: working } },
  homeParts: () => parts,
  isBusy: () => true,
  num: () => "One",
  PROJ: () => "Project",
  threadMark: () => "",
  askTitle: () => "Review",
});

endRender(parts, working);
const button = document.querySelector("[data-handled]");
const body = document.querySelector("#hd-b");
assert.equal(button.getAttribute("aria-expanded"), "false");
assert.equal(body.hidden, true);
assert.match(button.textContent, /one working · one can wait/);

setHandled(true);
assert.equal(button.getAttribute("aria-expanded"), "true");
assert.equal(body.hidden, false);
const row = body.querySelector('[data-go="t:thread"]');
assert.equal(row.querySelector(".hd-now").textContent, "Checking the change");
assert.equal(row.querySelector(".mini").getAttribute("aria-label"), "1 of 2");
assert.equal(body.querySelector('[data-bring-in="waiting"]').textContent, "Bring in");
endRender(parts, working);
assert.ok(body.querySelector('[data-go="t:thread"]') === row, "a live render keeps the row in place");
setHandled(false);
assert.equal(button.getAttribute("aria-expanded"), "false");
assert.equal(body.hidden, true);
