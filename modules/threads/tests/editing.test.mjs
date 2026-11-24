// @ts-check
import assert from "node:assert/strict";
import { deferred, dom } from "../../../tests/lib/dom.mjs";
import { createThreadEditing, threadTitleInput, threadLabelInput } from "../editing.js";

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
/** @type {import("../editing-types.d.ts").EditDeps["S"]} */
const S = { tMenu: null, tMenuIn: null, tEdit: null };
const pending = deferred();
const requests = [], notices = [];
const { startThreadEdit, saveThreadField, unfreeze } = createThreadEditing({
  S, world: {
    thread: () => ({ id: "thread", title: "Old", label: "Notes" }),
    act: { editThread(id, change) { requests.push([id, change]); return requests.length === 1 ? pending.promise : Promise.resolve(); } },
  },
  render() {}, schedule() {}, announce() {}, heraldShow: (notice) => notices.push(notice.sub),
  composerAt: () => ({ say: document.getElementById("say"), conv: { scroller: document.getElementById("scroll") } }),
});
startThreadEdit("thread", "title");
assert.ok(document.activeElement === input);
const saving = saveThreadField("thread", "title", " New ");
await Promise.resolve();
assert.equal(input.getAttribute("aria-busy"), "true");
pending.reject(new Error("Connection lost"));
await saving;
assert.equal(S.tEdit?.value, " New ");
assert.equal(S.tEdit?.failed, " New ");
assert.equal(input.hasAttribute("aria-busy"), false);
assert.deepEqual(notices, ["Connection lost"]);
await saveThreadField("thread", "title", " New ");
assert.equal(S.tEdit, null);
assert.ok(document.activeElement === opener, "saving returns focus to the menu");
const resume = document.getElementById("resume");
resume.focus();
await unfreeze("thread", resume);
assert.deepEqual(requests, [["thread", { title: "New" }], ["thread", { title: "New" }], ["thread", { paused: false }]]);
assert.ok(S.focusNext?.[0]() === document.getElementById("say"), "resuming sends focus to the local composer");
assert.ok(S.focusNext?.[1]() === document.getElementById("scroll"));
