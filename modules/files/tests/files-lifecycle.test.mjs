// @ts-check

import assert from "node:assert/strict";
import { createScope } from "../../../core/kernel/scope.js";
import { dom } from "../../../tests/lib/dom.mjs";

const { document } = await dom('<aside></aside><section id="viewer"></section>');
const { createFiles } = await import("../files.js");
const observerLog = { read: () => {}, disconnected: 0 };
globalThis.ResizeObserver = class {
  constructor(/** @type {() => void} */ callback) { observerLog.read = callback; }
  observe() {}
  disconnect() { observerLog.disconnected++; }
};
const viewer = document.getElementById("viewer");
const host = document.querySelector("aside");
let width = 400;
let measures = 0;
host.getBoundingClientRect = () => { measures++; return { width }; };
const files = createFiles({
  world: { state: { projects: [], threads: [] }, thread: () => null },
  viewer: { hasFile: false }, isBusy: () => false, PROJ: String, go() {},
});
const scope = createScope();
const dispose = files.mount(host, scope);
files.show("home");
width = 800;
observerLog.read();
assert.equal(host.querySelector(".fl").classList.contains("is-wide"), true);
assert.equal(document.body.querySelectorAll(".fl-menu").length, 1);
const measuresAtUnmount = measures;
dispose();
assert.equal(scope.size, 0);
assert.equal(observerLog.disconnected, 1);
assert.equal(document.body.querySelector(".fl-menu") === null, true);
observerLog.read();
assert.equal(measures, measuresAtUnmount);
const disposeAgain = files.mount(host);
files.show("home");
assert.equal(host.querySelector(".fl-view #viewer") === viewer, true);
assert.equal(document.body.querySelectorAll(".fl-menu").length, 1);
disposeAgain();
