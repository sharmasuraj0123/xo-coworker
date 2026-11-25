import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate, setInterval, setTimeout } from "node:timers";
import { dom } from "./lib/dom.mjs";
globalThis.matchMedia = (query) => ({ matches: query === "(max-width: 760px)", addEventListener() {}, removeEventListener() {} });
const { createPanelThreadOpener } = await import("../shell/panel/thread-navigation.js");
const { prepareStageNavigation } = await import("../shell/panel/navigation.js");
const { createNavigation } = await import("../shell/navigation.js");
const { createNavigationState } = await import("../shell/navigation-state.js");
const connectorReplies = JSON.parse(readFileSync(new URL("../core/platform/tests/fixtures/connector-responses.json", import.meta.url)));

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const { document } = await dom('<div id="panel"></div><div id="column"><div id="scroller" tabindex="-1"></div><textarea id="say"></textarea></div><div id="tdock"></div>');
for (const focus of [true, false]) {
  t(`navigation closes the phone panel before focusing the ${focus ? "composer" : "scroller"}`, () => {
    const say = document.querySelector("#say"), scroller = document.querySelector("#scroller");
    const calls = [];
    const target = focus ? say : scroller;
    const onFocus = () => calls.push("focus");
    target.addEventListener("focus", onFocus, { once: true });
    const { go } = createNavigation({
      location: createNavigationState(),
      bus: { emit(topic, change) {
        if (topic === "app:view-preparing") {
          prepareStageNavigation({ isOpen: true, leave() {}, close: (options) => calls.push(options) }, true, change);
        }
      } },
      say, scroller, pageEl: () => null, convThread: () => null,
    });
    go("ws", { panel: true, focus });
    assert.deepEqual(calls, [{ restore: false, quiet: true }, "focus"]);
    assert.ok(document.activeElement === target, "focus reaches the requested destination");
  });
}
t("Back uses a thread’s recorded parent and leaves the place trail untouched", () => {
  const location = createNavigationState();
  location.visit("ws", {});
  location.visit("t:thread", {});
  let confirmLeave;
  const viewer = { editing: true, leave(next) { confirmLeave = next; } };
  const navigation = createNavigation({
    location, bus: { emit() {} }, say: document.querySelector("#say"), scroller: document.querySelector("#scroller"),
    pageEl: () => null, convThread: () => ({ project: "project" }),
  });
  navigation.beforeLeave((resume) => { if (!viewer.editing) return true; viewer.leave(resume); return false; });
  navigation.back();
  assert.equal(location.view(), "t:thread", "Back waits for the open editor's confirmation");
  viewer.editing = false;
  confirmLeave();
  assert.equal(location.view(), "ws");
  assert.equal(location.previousPlace(() => true), "home", "a deferred Back leaves the place trail untouched");
  assert.equal(location.hasTrail(), false);
});
t("a panel route opens a thread beside its chat or hands off to global navigation", () => {
  const state = { view: "p:demo" };
  const calls = [];
  const open = createPanelThreadOpener({
    view: () => state.view, world: { thread: (id) => id === "thread" }, panelConversation: () => null,
    go: (...args) => calls.push(args),
  });
  open("t:thread", undefined, (page, id, options) => calls.push([page, id, options]));
  state.view = "home";
  open("t:thread", undefined, (page, id, options) => calls.push([page, id, options]));
  assert.deepEqual(calls, [["thread", "thread", { focus: true, input: "keyboard" }], ["t:thread", { panel: true }]]);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);

const markup = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const { document: app, window } = await dom(markup, { wholeDocument: true });
const frames = [];
const storage = new Map();
const encoder = new TextEncoder();
let stream;
const body = new ReadableStream({ start(controller) {
  stream = controller;
  stream.enqueue(encoder.encode("event: heartbeat\ndata: {}\n\n"));
} });
let sequence = 0;
function addThread(ts, title) {
  const seq = ++sequence;
  const data = { ts, title, chat_id: "project-chat", state: "open", session_id: ts + "-session" };
  stream.enqueue(encoder.encode(`id: ${seq}\nevent: thread\ndata: ${JSON.stringify({ type: "thread", seq, data })}\n\n`));
}
Object.assign(globalThis, {
  location: new URL("http://localhost/"),
  innerWidth: 390,
  history: { replaceState() {}, pushState() {} },
  localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  MutationObserver: window.MutationObserver,
  ResizeObserver: class { observe() {} disconnect() {} },
  customElements: window.customElements,
  addEventListener: window.addEventListener.bind(window),
  removeEventListener: window.removeEventListener.bind(window),
  requestAnimationFrame: (callback) => frames.push(callback),
  cancelAnimationFrame() {},
  setInterval: (callback, ms) => setInterval(callback, ms).unref(),
  setTimeout: (callback, ms) => setTimeout(callback, ms).unref(),
  async fetch(input) {
    const path = new URL(input, location.href).pathname;
    if (path === "/api/chat/stream") return new Response(body);
    if (path === "/api/deploy/demo/check") return Response.json({ ...connectorReplies.check, state: "needs-agent" });
    if (path === "/api/terminal/status") return Response.json({
      enabled: false, reason: "off in tests", max_sessions: 0, detached_ttl_seconds: 0, running: 0, attached: 0,
    });
    if (path === "/api/chat/chats") return Response.json({ chats: [
      { id: "workspace-chat", kind: "workspace" },
      { id: "project-chat", kind: "project", project: "demo", name: "Demo" },
    ] });
    return Response.json({});
  },
});
const matches = window.Element.prototype.matches;
window.Element.prototype.matches = function (selector) {
  if (selector === ":focus-within") return this.contains(app.activeElement);
  if (selector === ":focus-visible") return this === app.activeElement;
  return matches.call(this, selector);
};
window.HTMLElement.prototype.scrollTo = function () {};
window.HTMLElement.prototype.getAnimations = function () { return []; };
window.HTMLElement.prototype.animate = function () { return { finished: Promise.resolve(), cancel() {} }; };
const dialogPrototype = Object.getPrototypeOf(app.createElement("dialog"));
dialogPrototype.showModal = function () { this.open = true; };
dialogPrototype.close = function () {
  this.open = false;
  this.dispatchEvent(new window.Event("close"));
};
await import("../boot.js");

function press(selector) {
  const target = app.querySelector(selector);
  assert.ok(target, selector);
  target.focus();
  target.click();
}
async function paint() {
  await new Promise((resolve) => setImmediate(resolve));
  for (const callback of frames.splice(0)) callback(performance.now());
}
async function until(selector) {
  for (let attempt = 0; attempt < 100; attempt++) {
    await paint();
    if (app.querySelector(selector)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`Expected mounted control ${selector}`);
}
const stage = app.querySelector("#stage");
const scroller = app.querySelector("#scroller");
function handoff(selector, name) {
  assert.equal(stage.hidden, false, `${name} starts with the Stage open`);
  const cover = scroller.closest("[data-stage-inert]");
  assert.ok(cover?.inert, `${name} starts with the covered conversation inert`);
  const seen = [];
  scroller.addEventListener("focus", () => seen.push([stage.hidden, cover.inert]), { once: true });
  press(selector);
  assert.deepEqual(seen, [[true, false]], `${name} closes the Stage and clears its cover before focus`);
  assert.ok(app.activeElement === scroller, `${name} focuses the main conversation`);
}

await until("#side [data-go='p:demo']");
press("#nv-ws");
await paint();
press("[data-stage-toggle]");
press("[data-map-mode='tree']");
const mapProject = '#fr-body-map [data-node="p:demo"]';
await until(mapProject);
handoff(mapProject, "the Map project action");
await paint();

addThread("first", "First thread");
addThread("second", "Second thread");
press("[data-stage-toggle]");
press("#nv-ws");
assert.equal(stage.hidden, false, "navigation from outside the Stage keeps it open");
press("#side [data-go='p:demo']");
const first = '#stage .tg-box [data-go="t:first"]';
const second = '#stage .tg-box [data-go="t:second"]';
await until(first);
press(first);
assert.equal(stage.hidden, false, "a Stage thread row opens beside the project chat");
await until('#stage [data-tp-main="first"]');
press('#stage [data-tp-main="first"]');
await paint();
press("[data-stage-toggle]");
await until(second);
handoff(second, "the Stage row from a thread");

addThread("deploy-thread", "Deploy to Launchpad");
press("#side [data-go='p:demo']");
await until("[data-lp-open]");
press("[data-lp-open]");
const launchpadThread = '#lq [data-lp="thread"][data-go="t:deploy-thread"]';
await until(launchpadThread);
const launchpad = app.querySelector("#lq");
assert.equal(launchpad.open, true, "the project Launchpad opens");
const launchpadHandoff = [];
launchpad.addEventListener("click", () => {
  launchpadHandoff.push([launchpad.open, app.querySelector("#app").dataset.conv, app.activeElement === scroller]);
}, { once: true });
press(launchpadThread);
assert.deepEqual(launchpadHandoff, [[false, "t:deploy-thread", true]],
  "the Launchpad thread action closes its dialog, opens the requested conversation, and focuses it synchronously");
stream.close();
