// @ts-check
import assert from "node:assert/strict";
import { deferred, dom } from "../../../tests/lib/dom.mjs";
import { createThreadEditing, threadTitleInput, threadLabelInput } from "../editing.js";
import { createThreadControls } from "../controls.js";

const { document } = await dom(`<header id="top-who"><button data-tmenu="thread">Actions</button>${threadTitleInput("Old & new", "")}</header><textarea id="say"></textarea><section id="scroll"></section><button id="resume">Pick back up</button>`);
const input = document.getElementById("tw-edit");
assert.equal(input.value, "Old & new");
assert.equal(input.getAttribute("maxlength"), "120");
assert.equal(input.getAttribute("aria-label"), "Thread name");
const sample = document.createElement("div");
sample.innerHTML = threadLabelInput("Notes", ' aria-busy="true" readonly');
assert.equal(sample.querySelector("#tw-edit").getAttribute("maxlength"), "32");
assert.equal(sample.querySelector("#tw-edit").getAttribute("aria-busy"), "true");
const opener = document.querySelector("[data-tmenu]");
input.select = () => {};
const controls = createThreadControls();
const pending = deferred();
const oldEdit = deferred();
const requests = [], notices = [];
/** @type {(() => HTMLElement)[]} */
let focusTargets = [];
const { startThreadEdit, saveThreadField, unfreeze, dispose } = createThreadEditing({
  controls, world: {
    thread: () => ({ id: "thread", title: "Old", label: "Notes" }),
    act: { editThread(id, change) {
      requests.push([id, change]);
      if (requests.length === 1) return pending.promise;
      if (requests.length === 4) return oldEdit.promise;
      return Promise.resolve();
    } },
  },
  render() {}, schedule() {}, announce() {}, heraldShow: (notice) => notices.push(notice.sub),
  composerAt: () => ({ say: document.getElementById("say"), conv: { scroller: document.getElementById("scroll") } }),
  requestFocus: (targets) => { focusTargets = targets; },
});
startThreadEdit("thread", "title");
assert.ok(document.activeElement === input);
const saving = saveThreadField("thread", "title", " New ");
await Promise.resolve();
assert.equal(input.getAttribute("aria-busy"), "true");
pending.reject(new Error("Connection lost"));
await saving;
assert.equal(controls.edit()?.value, " New ");
assert.equal(controls.edit()?.failed, " New ");
assert.equal(input.hasAttribute("aria-busy"), false);
assert.deepEqual(notices, ["Connection lost"]);
await saveThreadField("thread", "title", " New ");
assert.equal(controls.edit(), null);
assert.ok(document.activeElement === opener, "saving returns focus to the menu");
const resume = document.getElementById("resume");
resume.focus();
await unfreeze("thread", resume);
assert.deepEqual(requests, [["thread", { title: "New" }], ["thread", { title: "New" }], ["thread", { paused: false }]]);
assert.ok(focusTargets[0]?.() === document.getElementById("say"), "resuming requests the local composer first");
assert.ok(focusTargets[1]?.() === document.getElementById("scroll"));

startThreadEdit("thread", "title");
const stale = saveThreadField("thread", "title", "An older edit");
await Promise.resolve();
controls.clear();
startThreadEdit("thread", "title");
input.setAttribute("aria-busy", "true");
oldEdit.reject(new Error("Old request failed"));
await stale;
assert.equal(input.getAttribute("aria-busy"), "true", "a late rename cannot clear the replacement field's busy state");
assert.equal(controls.edit()?.value, "Old");
dispose();
