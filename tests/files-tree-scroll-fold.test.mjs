// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "../core/platform/api.js";
import { createFiles } from "../modules/files/files.js";
import { resolveValue, valuesFor } from "./lib/css-snapshot.mjs";
import { dom, settle } from "./lib/dom.mjs";

test("Files keeps scroll position and the fold state for each project", async (context) => {
  const { window, document } = await dom('<aside id="files"></aside>');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new Map();
  const broken = new Error("Files folds storage failed");
  let writeError;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key) => storage.get(key), setItem: (key, value) => {
      if (writeError) throw writeError;
      storage.set(key, value);
    } },
  });
  context.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  context.mock.method(api, "projectTree", async () => ({ files: [{ name: "a.md", relative_path: "a.md" }] }));

  const files = createFiles({
    world: { state: { threads: [] } },
    viewer: { hasFile: false },
    changes: {
      of: () => ({ state: "ok", files: new Map([["a.md", { path: "a.md", binary: true }]]) }),
      activity: () => ({ live: new Set() }),
    },
    isBusy: () => false,
    PROJ: (id) => id,
    go() {},
  });
  const host = document.querySelector("#files");
  host.getBoundingClientRect = () => ({ width: 400 });
  context.after(files.mount(host));
  files.show("p:one");
  await settle();

  const click = (selector) => host.querySelector(selector).dispatchEvent(new window.Event("click", { bubbles: true }));
  const changed = '[data-fl-sec="changed"]';
  const all = '[data-fl-sec="all"]';
  const expanded = (selector) => host.querySelector(selector).getAttribute("aria-expanded");

  assert.equal(host.querySelector(changed).tagName, "BUTTON");
  assert.equal(host.querySelector(all).tagName, "BUTTON");
  assert.match(host.querySelector(changed).textContent, /Changed here/);
  assert.match(host.querySelector(all).textContent, /All files/);

  const list = host.querySelector(".fl-list");
  Object.defineProperties(list, { scrollHeight: { value: 714 }, clientHeight: { value: 400 } });
  list.scrollTop = 314;
  list.dispatchEvent(new window.Event("scroll", { bubbles: true }));
  list.dispatchEvent(new window.Event("scrollend", { bubbles: true }));
  await settle();
  assert.equal(list.scrollTop, 314);

  click(changed);
  assert.equal(expanded(changed), "false");
  assert.ok(!host.querySelector("[data-fl-change]"), "the removed change action is absent");
  click('[data-fl-rail="changes"]');
  assert.equal(expanded(changed), "true");
  assert.ok(host.querySelector("[data-fl-change]"));

  click(all);
  assert.equal(expanded(all), "false");
  assert.equal(host.querySelector(".fl-list > .fl-g").hidden, true);
  assert.deepEqual(JSON.parse(storage.get("xo-files-secs")), { one: { all: true } });
  files.show("p:two");
  await settle();
  assert.equal(expanded(all), "true");
  files.show("p:one");
  assert.equal(expanded(all), "false");
  click('[data-fl-rail="all"]');
  assert.equal(expanded(all), "true");
  assert.equal(host.querySelector(".fl-list > .fl-g").hidden, false);

  const reporter = Object.getOwnPropertyDescriptor(globalThis, "reportError");
  const reports = [];
  Object.defineProperty(globalThis, "reportError", { configurable: true, value: (error) => reports.push(error) });
  context.after(() => {
    if (reporter) Object.defineProperty(globalThis, "reportError", reporter);
    else Reflect.deleteProperty(globalThis, "reportError");
  });
  writeError = broken;
  click(all);
  assert.equal(expanded(all), "false");
  assert.deepEqual(JSON.parse(storage.get("xo-files-secs")), {});
  assert.deepEqual(reports, [broken]);
});

test("the Files section heading uses the panel's control size, chevron, ring and hover ink", () => {
  assert.deepEqual(valuesFor('.fl-sec[aria-expanded="true"] .fl-c svg', "transform"), ["rotate(90deg)"]);
  assert.deepEqual(valuesFor(".fl-sec", "box-sizing"), ["border-box"]);
  assert.deepEqual(valuesFor(".fl-sec", "height"), [resolveValue("var(--h-ctl)")]);
  const ringed = (selector) => selector.startsWith(":is(.fl-r,.fl-sec,") && selector.endsWith(":focus-visible");
  assert.deepEqual(valuesFor(ringed, "outline-color"), [resolveValue("var(--ring-in,var(--focus))")]);
  assert.deepEqual(valuesFor("button.fl-sec:hover", "color"), [resolveValue("var(--ink-2)")]);
});
