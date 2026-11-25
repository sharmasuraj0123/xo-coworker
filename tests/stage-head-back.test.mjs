import assert from "node:assert/strict";
import { dom, same } from "./lib/dom.mjs";

const { document, window } = await dom('<button id="outside">Outside the panel</button><div id="main"></div>');
globalThis.innerWidth = 1440;
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
globalThis.matchMedia = () => Object.assign(document.createElement("span"), { matches: true });
globalThis.cancelAnimationFrame = clearTimeout;
window.HTMLElement.prototype.getAnimations = () => [];

const { createKernel } = await import("../core/kernel/index.js");
const { definePlaces } = await import("../shell/places.js");
const { createStage } = await import("../shell/panel/panel.js");

const { places } = createKernel({ warn() {}, log() {} });
definePlaces({ places });
const map = { agents: () => [], mode: "graph", setMode() {}, show() {}, hide() {} };
places.contribute("panel.frame", { id: "map", title: "Map", mount() {} }, "test");
places.contribute("panel.frame", {
  id: "changes", title: "Changes",
  mount: () => ({ paint: () => false, head: () => null, wide: false }),
}, "test");

let view = "p:one";
let shellView;
let filesClosed = 0;
let runsBack = 0;
let threadControl;
let runsControl;
let runsReturnFocus = false;
let filesTitle = "Files";
const outside = document.getElementById("outside");
const panel = createStage({
  mapControls: () => map, files: { changes: () => [] }, viewer: {}, view: () => view,
  place: (id) => id.startsWith("p:"), go() {}, announce() {},
  at: () => ({ view }), places, shell: (on, host, where) => { if (on) shellView = where; },
});
panel.page("thread", {
  title: (key) => "Thread " + key,
  mount(host) { threadControl = document.createElement("button"); host.append(threadControl); },
  onShow(key, { focus }) { if (focus) threadControl.focus(); },
});
panel.page("files", { title: () => filesTitle, mount() {}, close: () => { filesClosed++; } });
panel.page("runs", {
  title: "Runs", over: true,
  mount(host) { runsControl = document.createElement("button"); host.append(runsControl); },
  close() { if (runsReturnFocus) outside.focus(); },
  up: () => { runsBack++; return true; },
  escape: () => { runsBack++; return true; },
});
const title = () => document.querySelector(".stg-t b")?.textContent ?? "";
const back = () => document.querySelector("[data-stg-sections]");
const stage = document.querySelector("#stage");
const press = (target, key) => {
  const event = new window.Event("keydown", { bubbles: true, cancelable: true });
  event.key = key;
  target.dispatchEvent(event);
};

panel.open();
assert.equal(title(), "");
const width = () => document.documentElement.style.getPropertyValue("--sw");
assert.equal(width(), "576px");
press(stage.querySelector(".stg-grip"), "ArrowLeft");
assert.equal(width(), "592px");
assert.equal(storage.get("xo-stage-w2"), "592");
panel.show("thread", "one");
assert.equal(title(), "Thread one");
assert.equal(stage.dataset.stgPage, "thread");
assert.equal(width(), "592px");
assert.equal(back().getAttribute("aria-label"), "Back to Threads, Changes and Map");
panel.show("thread", "two");
assert.equal(title(), "Thread two");
panel.show("runs", "two");
assert.equal(back().getAttribute("aria-label"), "Back to Thread two");
back().click();
press(stage, "Escape");
assert.equal(runsBack, 2);
assert.equal(title(), "Runs");
runsControl.focus();
panel.back();
same(document.activeElement, threadControl);
panel.show("runs", "two");
runsControl.focus();
runsReturnFocus = true;
panel.back();
same(document.activeElement, outside);
runsReturnFocus = false;
stage.querySelector("[data-stg-shell]").click();
assert.equal(shellView, "t:two");
panel.show("runs", "two");
assert.equal(back().getAttribute("aria-label"), "Back to Threads, Changes and Map");
panel.back();
assert.equal(title(), "");
assert.equal(stage.dataset.stgPage, undefined);

panel.show("thread", "two");
stage.querySelector("[data-stg-shell]").click();
back().click();
assert.equal(title(), "Thread two");
panel.back();
assert.equal(title(), "");

panel.show("files", "one");
assert.equal(title(), "Files");
document.querySelector("[data-stg-shell]").click();
assert.equal(title(), "Shell · Files");
assert.equal(back().getAttribute("aria-label"), "Back to Files");
const shellButton = stage.querySelector("[data-stg-shell]");
const backButton = back();
backButton.focus();
filesTitle = "Project files";
panel.repaint();
assert.equal(title(), "Shell · Project files");
assert.equal(shellButton.title, "Back to Project files");
assert.equal(back().getAttribute("aria-label"), "Back to Project files");
same(document.activeElement, backButton);
back().click();
assert.equal(title(), "Project files");
assert.equal(filesClosed, 0);
assert.equal(width(), "592px");
panel.leave();
assert.equal(title(), "");
assert.equal(filesClosed, 1);

panel.show("thread", "three");
view = "home";
panel.sync();
assert.equal(stage.hidden, true);
assert.equal(panel.button("home"), "");
assert.equal(panel.show("files"), false);
view = "p:two";
panel.sync();
assert.equal(stage.hidden, false);
assert.equal(width(), "592px");
assert.equal(title(), "");
assert.equal(back(), null);

const threadList = stage.querySelector('[data-fr="agents"] > .fr-b');
Object.defineProperties(threadList, { clientHeight: { value: 100 }, scrollHeight: { value: 200 } });
threadList.scrollTop = 20;
threadList.dispatchEvent(new window.Event("scroll", { bubbles: true }));
assert.equal(threadList.classList.contains("is-fade"), true);
threadList.scrollTop = 100;
threadList.dispatchEvent(new window.Event("scroll", { bubbles: true }));
assert.equal(threadList.classList.contains("is-fade"), false);
panel.disposeLayout();
threadList.scrollTop = 0;
threadList.dispatchEvent(new window.Event("scroll", { bubbles: true }));
assert.equal(threadList.classList.contains("is-fade"), false, "the retired Stage releases its scroll listener");
assert.equal(places.get("panel.page", "shell"), undefined);
assert.equal(stage.querySelectorAll(".stg-pg").length, 0, "retiring the Stage unmounts its pages");
console.log("stage head and Back follow the visible page");
