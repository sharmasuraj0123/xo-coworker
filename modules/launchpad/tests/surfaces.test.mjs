import assert from "node:assert/strict";
import test from "node:test";
import { deferred, dom, same } from "../../../tests/lib/dom.mjs";
import { createLpPage } from "../page.js";
import { createLpWindow } from "../window.js";
import { createLaunchpad } from "../launchpad.js";
import { model } from "../model.js";

test("Launchpad filters the apps, then opens the selected project with its own action", async () => {
  const { document } = await dom("<main></main>");
  const el = document.querySelector("main");
  const requests = [];
  const names = ["Live", "Deploying", "Needs help"];
  const rows = names.map((name, index) => ({
    p: "app-" + index, name, kind: "app", tone: ["go", "work", "need"][index],
    words: name, steps: [],
    need: index === 2 ? { why: "Set the port", label: "Fix", act: "fix" } : null,
  }));
  const page = createLpPage({
    el, projects: () => rows.map(({ p }) => p), launch: { overview: () => rows },
    iconOf: () => "", open: (view, from) => requests.push([view, from.dataset.lppOpen]), press: (action) => requests.push(action),
  });
  page.render();
  const live = el.querySelector('[data-lpp-f="live"]');
  live.click();
  const liveRadio = el.querySelector('[data-lpp-f="live"]');
  same(document.activeElement, liveRadio, "focus follows the selected filter");
  assert.equal(liveRadio.getAttribute("aria-checked"), "true", "the selected filter is reflected on its radio");
  assert.deepEqual([...el.querySelectorAll("button.lqp-app")].map((row) => row.dataset.lppOpen), ["app-0"]);
  el.querySelector('[data-lpp-press="fix"]').click();
  assert.deepEqual(requests, [["p:app-2", "app-2"], "fix"], "the notice opens its project before applying its own action");
  page.dispose();
  el.querySelector('[data-lpp-press="fix"]').click();
  assert.equal(requests.length, 2, "a retained overview action is inert after disposal");
});

test("Launchpad scopes the production dialog mount and keeps live focus restoration", async () => {
  const { document, window } = await dom('<button data-lp-open>Launchpad</button><button id="second">Second</button>');
  const proto = Object.getPrototypeOf(document.createElement("dialog"));
  proto.showModal = function () { this.open = true; };
  proto.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event("close"));
  };
  const frames = new Map(), timers = new Map();
  let id = 0;
  const old = Object.fromEntries(["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "localStorage", "isSecureContext"]
    .map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, {
    localStorage: { getItem: () => null, setItem() {} },
    isSecureContext: true,
    requestAnimationFrame: (fn) => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: (key) => frames.delete(key),
    setTimeout: (fn) => { timers.set(++id, fn); return id; },
    clearTimeout: (key) => timers.delete(key),
  });
  const oldClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const copies = [];
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText(text) {
    const settled = deferred(); copies.push({ text, settled }); return settled.promise;
  } } });
  try {
    await checkMountedDialog(document, window, frames, timers, copies);
  } finally {
    if (oldClipboard) Object.defineProperty(navigator, "clipboard", oldClipboard);
    else delete navigator.clipboard;
    Object.assign(globalThis, old);
    delete proto.showModal;
    delete proto.close;
  }
});

async function checkMountedDialog(document, window, frames, timers, copies) {
  const projectOf = (view) => view?.slice(2) ?? null;
  const check = async (p) => ({
    state: "linked", name: p, blockers: [], env: [], github: { connected: true, workflow: true },
    app: { id: p, name: p, host: p + ".example", url: "https://" + p + ".example", status: "live" },
  });
  let changes = 0, allApps = 0;
  const launch = createLaunchpad({ api: { check }, projectOf, announce() {}, onChange: () => panel.sync() });
  const panel = createLpWindow({
    launch, projectOf, nameOf: (p) => p, iconOf: () => "", onChange: () => changes++, allApps: () => allApps++,
  });
  const dialog = document.querySelector("dialog");
  const body = dialog.querySelector(".lq-body");
  const fallback = document.querySelector("[data-lp-open]");
  const opener = document.querySelector("#second");
  for (const p of ["first", "second"]) launch.ensure("p:" + p);
  await Promise.resolve();
  panel.open("p:first", fallback);
  assert.equal(panel.isOpen, true);
  assert.equal(dialog.querySelector(".lq-me b").textContent, "first");
  same(document.activeElement, body);
  panel.open("p:second", opener);
  panel.sync();
  assert.equal(dialog.querySelector(".lq-me b").textContent, "second");
  dialog.querySelector("[data-lq-close]").click();
  same(document.activeElement, opener, "the latest opener gets focus when the dialog closes");
  panel.open("p:second", opener);
  opener.remove();
  panel.close();
  same(document.activeElement, fallback, "a replaced opener falls back to the published Launchpad button");
  panel.open("p:second", fallback);

  const flush = (pending) => { for (const fn of [...pending.values()]) fn(); };
  const menuButton = () => body.querySelector('[data-lp="menu"]');
  const keydown = (node, key) => node.dispatchEvent(Object.assign(new window.Event("keydown", { bubbles: true, cancelable: true }), { key }));
  const point = (node) => node.dispatchEvent(new window.Event("pointermove", { bubbles: true }));
  Object.defineProperties(body, { clientHeight: { value: 10 }, scrollHeight: { value: 50 }, scrollTop: { value: 0, writable: true } });
  window.dispatchEvent(new window.Event("resize"));
  assert.equal(body.classList.contains("is-over"), true, "live resize measures the Launchpad body");
  body.scrollTop = 45;
  body.dispatchEvent(new window.Event("scroll"));
  assert.equal(body.classList.contains("is-over"), false, "live scrolling updates the Launchpad fade");
  panel.press("menu");
  flush(frames);
  assert.equal(menuButton().getAttribute("aria-expanded"), "true", "the queued action reaches the live menu");
  menuButton().focus();
  const item = body.querySelector(".lp-mn [role=menuitem]");
  point(item);
  same(document.activeElement, item, "live pointer tracking focuses the menu item");
  assert.equal(keydown(item, "Escape"), false, "live Escape closes the menu before the dialog");
  assert.equal(menuButton().getAttribute("aria-expanded"), "false");
  assert.equal(panel.isOpen, true);
  menuButton().click();
  menuButton().focus();
  fallback.focus();
  const liveFocusout = timers.size;
  assert.ok(liveFocusout > 0, "leaving the menu queues a delayed close");
  flush(timers);
  assert.equal(menuButton().getAttribute("aria-expanded"), "false", "the delayed close runs while mounted");
  menuButton().click();
  menuButton().focus();
  fallback.focus();
  panel.press("edit");
  assert.ok(timers.size > 0, "a focusout is held at disposal");
  assert.ok(frames.size > 0, "a frame is held at disposal");
  body.insertAdjacentHTML("beforeend", '<button data-lp="cmd-copy" data-v="gh auth refresh">Copy the command</button>');
  const command = body.querySelector('[data-lp="cmd-copy"]');
  command.click();
  assert.equal(copies[0].text, "gh auth refresh");
  copies[0].settled.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(command.title, "Copied");
  assert.ok(timers.size >= 3, "the command and redraw timers are held with focusout");
  command.click();

  let resizeRemovals = 0, escapeRemovals = 0, scrollRemovals = 0;
  const resizeRemove = window.removeEventListener, escapeRemove = document.removeEventListener;
  const scrollRemove = body.removeEventListener;
  body.removeEventListener = function (type, ...args) {
    if (type === "scroll") scrollRemovals++;
    return scrollRemove.call(this, type, ...args);
  };
  window.removeEventListener = function (type, ...args) {
    if (type === "resize") resizeRemovals++;
    return resizeRemove.call(this, type, ...args);
  };
  document.removeEventListener = function (type, ...args) {
    if (type === "keydown" && args[1] === true) escapeRemovals++;
    return escapeRemove.call(this, type, ...args);
  };
  try { panel.dispose(); } finally {
    window.removeEventListener = resizeRemove;
    document.removeEventListener = escapeRemove;
    body.removeEventListener = scrollRemove;
  }
  assert.equal(resizeRemovals, 1, "disposal removes the window resize listener");
  assert.equal(escapeRemovals, 1, "disposal removes the document capture listener");
  assert.equal(scrollRemovals, 1, "disposal removes the body scroll listener");
  assert.equal(timers.size, 0, "disposal cancels the delayed focusout");
  assert.equal(frames.size, 0, "disposal cancels the queued action and queued paint frames");
  assert.equal(dialog.isConnected, false, "disposal removes the mounted dialog");
  assert.equal(dialog.open, false, "disposal closes the mounted dialog");
  const lastChange = changes;
  panel.open("p:first", fallback);
  panel.press("edit");
  panel.sync();
  dialog.dispatchEvent(new window.Event("close"));
  dialog.querySelector("[data-lq-all]").click();
  assert.equal(changes, lastChange, "retained close events and entry calls are inert");
  assert.equal(allApps, 0, "the retained dialog action is inert");
  assert.equal(frames.size, 0, "press after disposal cannot queue a frame");
  body.scrollTop = 0;
  window.dispatchEvent(new window.Event("resize"));
  body.dispatchEvent(new window.Event("scroll"));
  assert.equal(body.classList.contains("is-over"), false, "retired resize and scroll cannot update the body");

  document.body.append(dialog);
  command.title = "Copy the command";
  copies[1].settled.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(command.title, "Copy the command", "a clipboard result cannot revive the retired command feedback");
  const retainedItem = body.querySelector(".lp-mn [role=menuitem]");
  menuButton().focus();
  point(retainedItem);
  same(document.activeElement, menuButton(), "retained pointer tracking cannot move focus");
  assert.equal(keydown(retainedItem, "Escape"), true, "Escape on the retained body no longer has a handler");
  menuButton().click();
  fallback.focus();
  assert.equal(timers.size, 0, "retained focusout cannot schedule work");
  dialog.remove();
}

test("Launchpad availability storage falls back and reports unexpected failures", async () => {
  const oldStorage = globalThis.localStorage;
  const oldReport = globalThis.reportError;
  const reported = [];
  globalThis.reportError = (error) => reported.push(error.message);
  const projectOf = (view) => view?.slice(2) ?? null;
  const api = { check: async () => ({ state: "not-deployable" }) };
  const launch = () => createLaunchpad({ api, projectOf, announce() {} });
  const probe = async (storage) => {
    globalThis.localStorage = storage;
    const pad = launch();
    assert.equal(pad.has("p:unavailable"), true, "missing availability still offers the readiness check");
    pad.ensure("p:unavailable");
    await Promise.resolve();
    assert.equal(pad.has("p:unavailable"), false, "the live answer wins even when saving fails");
  };
  const fail = (error) => () => { throw error; };
  try {
    await probe({ getItem: () => "{broken", setItem: fail(new DOMException("Storage full", "QuotaExceededError")) });
    await probe({ getItem: fail(new DOMException("Storage denied", "SecurityError")), setItem() {} });
    assert.deepEqual(reported, [], "known cache failures keep the fallback quiet");
    await probe({ getItem: fail(new Error("Failed to read the storage backend")), setItem() {} });
    assert.deepEqual(reported, ["Failed to read the storage backend"], "an unexpected cache read reports once");
    await probe({ getItem: () => null, setItem: fail(new Error("Failed to write the storage backend")) });
    assert.deepEqual(reported, ["Failed to read the storage backend", "Failed to write the storage backend"], "an unexpected cache write reports once");
  } finally {
    globalThis.localStorage = oldStorage;
    globalThis.reportError = oldReport;
  }
});

test("Launchpad redraw preserves focus when the destination cannot select text", async () => {
  const { document } = await dom('<section><div class="fr-b"></div></section>');
  const section = document.querySelector("section");
  const projectOf = (view) => view?.slice(2) ?? null;
  const launch = createLaunchpad({
    api: { check: async (p) => model({ project: p, state: "ready" }) },
    projectOf, announce() {},
  });
  const inputPrototype = Object.getPrototypeOf(document.createElement("input"));
  const selectionError = new Error("Unexpected selection failure");
  let canSelect = false, restored = 0;
  Object.defineProperties(inputPrototype, {
    selectionStart: { configurable: true, get() { return this.hasAttribute("data-old") || canSelect ? 1 : null; } },
    selectionEnd: { configurable: true, get() { return this.hasAttribute("data-old") || canSelect ? 2 : null; } },
    setSelectionRange: { configurable: true, value() { restored++; throw selectionError; } },
  });
  const cancel = globalThis.cancelAnimationFrame;
  globalThis.cancelAnimationFrame = clearTimeout;
  const dispose = launch.mount(section, { open() {}, hide() {} });
  try {
    for (const p of ["first", "second"]) launch.ensure("p:" + p);
    await Promise.resolve();
    launch.paint("p:first", true);
    const field = () => section.querySelector('input[data-lp-f="name"]');
    const previous = field();
    previous.setAttribute("data-old", "");
    previous.focus();
    launch.paint("p:second", true);
    same(document.activeElement, field(), "the replacement field receives focus even when it cannot select text");
    assert.equal(restored, 0, "the unsupported selection setter is never called");
    canSelect = true;
    assert.throws(() => launch.paint("p:first", true), selectionError, "unexpected caret failures reach the caller");
  } finally {
    dispose();
    globalThis.cancelAnimationFrame = cancel;
    delete inputPrototype.selectionStart;
    delete inputPrototype.selectionEnd;
    delete inputPrototype.setSelectionRange;
  }
});
