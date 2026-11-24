import assert from "node:assert/strict";
import { dom, same, settle } from "./lib/dom.mjs";
import { createConversationFiles } from "../modules/files/conversation-files.js";
import { createThreadControls } from "../modules/threads/controls.js";

const { document, window } = await dom(`<div id="tphead"></div><div id="tmsgs">Outside the panel</div>
<input id="att-input" accept="text/plain"><aside><header></header><div id="thread"></div></aside>`);
Object.assign(globalThis, {
  MutationObserver: window.MutationObserver, cancelAnimationFrame: clearTimeout,
  ResizeObserver: class { observe() {} disconnect() {} },
  getComputedStyle: window.getComputedStyle,
});
const { createThreadPage } = await import("../modules/conversation/thread-page.js");
const outside = document.querySelector("#tmsgs");
const box = document.querySelector("#thread");
document.querySelector("#att-input").accept = "text/plain";
const threadControls = createThreadControls();
const calls = [];
let threadExists = true;
const STAGE = { slot: document.querySelector("aside header"), pageShown: { name: "thread" },
  closePage: (key) => calls.push(["close", key]) };
const needs = [];
const page = createThreadPage({
  STAGE, threadControls, world: { act: { watchSideThread: (key) => calls.push(["watch", key]) } },
  D: { needItems: () => needs },
  createDock: (mount) => {
    same(mount.el, box.querySelector(".tdock"));
    return { reset: () => calls.push(["reset"]), render: (items) => calls.push(["dock", items]) };
  },
  wireComposer: (composer) => calls.push(["composer", composer]),
  wireTray: (composer) => calls.push(["tray", composer]),
  closeThreadMenu() {}, addFiles: (files, composer) => calls.push(["files", files, composer]),
  toggleIq: (session, chip) => calls.push(["model", session, chip]),
  sessionOf: String, convProject: () => null, watchDock: () => new ResizeObserver(),
  toastLine() {}, loadAhead() {}, returnPill: (target) => calls.push(["return", target]),
  saveDraft: () => calls.push(["save"]), loadDraft: () => calls.push(["draft"]),
  convThread: () => threadExists ? { id: "t1", title: "Panel thread" } : null,
  stOf: () => "working", glyphOf: () => "working", isHeld: () => false, wordOf: () => "Working",
  rtTag: () => "", threadMenuHtml: () => '<button data-run>View runs</button>',
  checklistRender: (items, head) => { same(head, box.querySelector(".tp-thead")); same(items, needs); },
  drawConv: (conv, items) => { same(conv.msgs, box.querySelector(".msgs")); same(items, needs); calls.push(["draw"]); },
  updateComposer() {}, sendRender() {}, targetLineRender() {},
});
const unmount = page.tpMount(box);
const { TP } = page;
same(TP.C.msgs, box.querySelector(".msgs"));
same(TP.K.form, box.querySelector("form"));
assert.deepEqual(calls.splice(0).map(([kind]) => kind), ["composer", "tray"]);
assert.equal(TP.K.input.getAttribute("accept"), "text/plain");
page.tpShow("t1");
page.tpFocus(null, "keyboard");
await settle();
assert.equal(outside.textContent, "Outside the panel");
same(document.activeElement, TP.K.say);
assert.deepEqual(calls.splice(0).map(([kind]) => kind), ["return", "reset", "watch", "draft", "draw", "dock"]);
assert.equal(box.querySelector("[data-tp-main]").dataset.tpMain, "t1");

threadControls.toggleMenu("t1", "page");
page.drawThreadPage(needs);
const menu = STAGE.slot.querySelector("[data-tmenu]");
assert.equal(menu.getAttribute("aria-expanded"), "true");
assert.ok(STAGE.slot.querySelector("[data-run]"));
TP.K.input.dispatchEvent(new window.Event("change"));
TP.K.iq.dispatchEvent(new window.Event("click"));
assert.deepEqual(calls.splice(0).map(([kind]) => kind), ["draw", "dock", "files", "model"]);
page.tpShow("t2");
await settle();
assert.deepEqual(calls.splice(0).map(([kind]) => kind), ["return", "save", "reset", "watch", "draft", "draw", "dock"]);
threadExists = false;
page.drawThreadPage(needs);
assert.deepEqual(calls.splice(0), [["close", "thread"]]);
page.tpClose();
assert.deepEqual(calls.splice(0), [["save"], ["watch", null]]);
unmount();
assert.equal(TP.follow === null && TP.K === null, true);

const opened = [];
const { fileRoute, openSharedFile } = createConversationFiles({
  currentView: () => "p:p", convAt: () => ({ view: "t:x" }),
  convThread: (view) => view === "t:x" ? { project: "p", worktree: "/srv/p/.xo/worktrees/x" } : null,
  CHG: { scope: () => null }, VW: { open: (file, from) => opened.push([file, from]) },
});
const chip = { dataset: { file: "a.md", fileName: "a.md", fileType: "text/markdown" } };
openSharedFile(chip);
assert.deepEqual(opened[0][0], { path: "a.md", name: "a.md", type: "text/markdown", bytes: null, project: "p", rel: ".xo/worktrees/x/a.md" });
same(opened[0][1], chip);
assert.deepEqual(fileRoute("a.md"), { project: "p", rel: "a.md" });
