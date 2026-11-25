// @ts-check

import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createThreadMenuNavigation } from "../menu-navigation.js";

const { document } = await dom(`
  <button data-tgo="t:other"><span>Next</span></button>
  <button data-tgo="t:disabled" aria-disabled="true">Unavailable</button>
  <button data-tside="thread">Open at the side</button>`);
const calls = [];
let stage = true;
const navigate = createThreadMenuNavigation({
  thread: (id) => ({ id, project: "project" }),
  go: (view) => calls.push(["go", view]),
  showThread: (id, input) => calls.push(["show", id, input]),
  inStage: () => stage,
  closeMenu: () => calls.push(["close"]),
});
const touch = { pointerType: "touch", detail: 1 };
const keys = { detail: 0 };
assert.equal(navigate(document.querySelector("span"), touch), true);
assert.deepEqual(calls.splice(0), [["close"], ["show", "other", "touch"]]);
stage = false;
assert.equal(navigate(document.querySelector("span"), keys), true);
assert.deepEqual(calls.splice(0), [["close"], ["go", "t:other"]]);
assert.equal(navigate(document.querySelector("[aria-disabled]"), keys), true);
assert.deepEqual(calls, []);
assert.equal(navigate(document.querySelector("[data-tside]"), keys), true);
assert.deepEqual(calls.splice(0), [["close"], ["go", "p:project"], ["show", "thread", "keyboard"]]);
assert.equal(navigate(document.body, keys), false);
