// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { createScope } from "../core/kernel/scope.js";
import { valuesFor } from "./lib/css-snapshot.mjs";
import { dom } from "./lib/dom.mjs";

const { window, document } = await dom('<div id="tree"></div><div id="graph"></div><button id="outside">Outside</button>');
const frames = new Map();
let frameId = 0, mode = "tree", boxWidth = 100, phone = false;
let target = "/home/coder/project/one.js";
const dimensions = { clientWidth: 520, clientHeight: 400, clientLeft: 0, clientTop: 0, offsetWidth: 100, offsetHeight: 32, offsetLeft: 0, offsetTop: 0 };
for (const [key, value] of Object.entries(dimensions)) {
  Object.defineProperty(window.HTMLElement.prototype, key, {
    configurable: true,
    get() { return key === "offsetWidth" && this.classList.contains("dg-n") ? boxWidth : value; },
  });
}
Object.defineProperty(document, "fonts", { value: new window.EventTarget() });
Object.assign(globalThis, {
  removeEventListener: (...args) => window.removeEventListener(...args),
  localStorage: { getItem: () => mode, setItem: () => {} },
  getComputedStyle: window.getComputedStyle,
  matchMedia: () => ({ get matches() { return phone; }, addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
  cancelAnimationFrame(id) { frames.delete(id); },
  fetch: async () => Response.json({ project_id: "project", relative_path: "", dirs: [],
    files: ["one.js", "two.js", "three.js"].map((name) => ({ name, relative_path: name })) }),
});
Object.defineProperty(globalThis, "performance", { value: { now: () => Date.now() } });
const { createMap } = await import("../modules/map/map.js");
const thread = { id: "worker", title: "Worker", project: "project", cwd: "/home/coder/project", state: "working", sessionId: "worker" };
const turn = { session: "worker", status: "running", at: "2026-11-24T05:00:00Z" };
const world = {
  act: {},
  state: { projects: [{ id: "project" }], threads: [thread], turns: {
    list: (select) => [turn].filter(select),
    blocksOf: () => [{ type: "activity", rows: [{ kind: "edit_file", status: "running", target }] }],
  } },
  thread: (id) => id === thread.id ? thread : null,
  project: () => ({ name: "Project" }),
};

function withFrame() {
  for (const [id, callback] of [...frames]) {
    frames.delete(id);
    callback(performance.now());
  }
}

/** @param {Element} node @param {string} type @param {object} properties */
function input(node, type, properties) {
  const event = Object.assign(new window.Event(type, { bubbles: true, cancelable: true }), properties);
  node.dispatchEvent(event);
  return event.defaultPrevented;
}

/** @param {Element} viewport */
const wheel = (viewport) => input(viewport, "wheel", { deltaX: 25, deltaY: 0, ctrlKey: false, metaKey: false });

/** @param {Element} viewport */
const changeMode = (viewport) => input(viewport, "keydown", { key: "g" });

/** @param {Element} viewport @param {string} type @param {number} clientX */
const pointer = (viewport, type, clientX) => input(viewport, type, {
  pointerId: 1, pointerType: "mouse", button: 0, clientX, clientY: 50,
});

mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1 });
try {
  assert.deepEqual(valuesFor(".dg", "overflow"), ["clip"], "the camera alone can move the drawing");
  for (const view of ["tree", "graph"]) {
    mode = view;
    target = "/home/coder/project/one.js";
    const host = document.getElementById(view);
    const spoken = [], opened = [];
    const map = createMap({ world, go: (place) => opened.push(place), announce: (text) => spoken.push(text), isBusy: () => true, openFile() {}, stepLineHtml: () => "" });
    map.render("t:worker");
    const mountScope = createScope();
    map.mount(host, mountScope);
    withFrame();
    mock.timers.tick(120);
    await new Promise(setImmediate);
    withFrame();
    const canvas = host.querySelector(".dg-world");
    assert.ok(canvas);
    assert.equal(map.mode, view);
    const press = (tool) => host.querySelector(`[data-dg="${tool}"]`)
      .dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    const scale = () => Number(canvas.style.getPropertyValue("--dg-s"));
    for (let n = 0; n < 6; n++) press("in");
    const zoomed = scale();
    assert.ok(zoomed > 1.1, `${view} zoom controls are active`);
    const follow = host.querySelector('[data-dg="follow"]');
    if (follow.getAttribute("aria-pressed") === "true") press("follow");
    const beforeFollow = canvas.style.transform;
    press("follow");
    assert.equal(follow.getAttribute("aria-pressed"), "true");
    assert.equal(spoken.at(-1), "Following the agent.");
    assert.notEqual(canvas.style.transform, beforeFollow, `${view} pans to the agent`);
    assert.equal(scale(), zoomed, `${view} retains the user's zoom when Follow starts`);
    const viewport = host.querySelector(".dg");
    const tag = host.querySelector(".dg-tag");
    viewport.getBoundingClientRect = () => ({ left: 0, right: 520, top: 0, bottom: 400 });
    tag.getBoundingClientRect = () => ({ left: -1200, right: -1100, top: 60, bottom: 92, width: 100, height: 32 });
    const centered = canvas.style.transform;
    tag.focus();
    assert.notEqual(canvas.style.transform, centered, "focus reveals an offscreen tag at once");
    assert.equal(canvas.classList.contains("is-glide"), false);
    assert.equal(follow.getAttribute("aria-pressed"), "true");
    const revealed = canvas.style.transform;
    follow.focus();
    assert.notEqual(canvas.style.transform, revealed, "leaving the drawing restores Follow");
    {
      const node = canvas.querySelector("button[data-node], button[data-mp-go]");
      assert.ok(node, `${view} has a keyboard target in the drawing`);
      node.getBoundingClientRect = () => ({ left: 2500, top: 60, width: 90, height: 28 });
      const following = canvas.style.transform;
      node.focus();
      const nodePosition = canvas.style.transform;
      assert.notEqual(nodePosition, following, `${view} brings a distant focused node into view immediately`);
      assert.equal(canvas.classList.contains("is-glide"), false);
      assert.equal(follow.getAttribute("aria-pressed"), "true");
      document.getElementById("outside").focus();
      assert.notEqual(canvas.style.transform, nodePosition, `${view} brings the agent back when focus leaves the drawing`);
      assert.equal(follow.getAttribute("aria-pressed"), "true");
    }
    target = "/home/coder/project/two.js";
    map.render("t:worker");
    for (let n = 0; n < 40; n++) { mock.timers.tick(16); withFrame(); }
    assert.equal(scale(), zoomed, `${view} retains the zoom on a live update`);
    press("follow");
    assert.equal(spoken.at(-1), "Not following.");
    assert.equal(scale(), zoomed);
    press("fit");
    assert.ok(scale() < zoomed, `${view} zooms out when Fit is explicitly requested`);
    if (view === "tree") {
      const fitted = scale();
      boxWidth = 800;
      press("fit");
      assert.equal(scale(), fitted, "Fit reuses the unchanged drawing measurement");
      document.fonts.dispatchEvent(new window.Event("loadingdone"));
      press("fit");
      assert.ok(scale() < fitted, "a loaded font makes Fit account for the wider drawing");
      boxWidth = 100;
      const act = () => tag.dispatchEvent(Object.assign(new window.Event("click", { bubbles: true }), { detail: 1 }));
      for (let i = 0; i < 10; i++) press("out");
      phone = true;
      const small = scale();
      act();
      assert.equal(opened.length, 0, "the first press brings a small tag closer");
      assert.match(spoken.at(-1), /press it again to open it/);
      assert.ok(scale() > small);
      act();
      assert.deepEqual(opened, ["t:worker"]);
      phone = false;

      let captured = false;
      Object.assign(viewport, { setPointerCapture() { captured = true; }, hasPointerCapture: () => captured,
        releasePointerCapture() { captured = false; } });
      pointer(viewport, "pointerdown", 50);
      pointer(viewport, "pointermove", 85);
      assert.equal(captured, true);
      assert.equal(changeMode(viewport), true);
      assert.equal(map.mode, "graph");
      const next = host.querySelector(".dg");
      const nextCanvas = next.querySelector(".dg-world");
      assert.ok(next !== viewport && !viewport.isConnected);
      const position = nextCanvas.style.transform;
      assert.equal(wheel(viewport), false, "a removed Diagram cannot handle the wheel");
      assert.equal(changeMode(viewport), false, "a removed Diagram cannot toggle the current mode");
      pointer(viewport, "pointerup", 85);
      assert.equal(captured, false, "replacing the viewport releases pointer capture");
      assert.equal(viewport.classList.contains("is-drag"), false);
      assert.equal(map.mode, "graph");
      assert.equal(nextCanvas.style.transform, position);
      assert.equal(wheel(next), true, "the current Graph still handles the wheel");
      assert.notEqual(nextCanvas.style.transform, position);

      map.render("p:project");
      const project = host.querySelector(".dg");
      assert.ok(project !== next);
      assert.equal(wheel(next), false, "changing places also disconnects the old viewport");
      assert.equal(wheel(project), true);
    }
    const retained = host.querySelector(".dg");
    map.unmount();
    assert.equal(mountScope.size, 0);
    assert.equal(retained.isConnected, true);
    assert.equal(wheel(retained), false, "unmount disconnects the retained viewport's input");
    assert.equal(changeMode(retained), false);
  }
} finally {
  mock.timers.reset();
}
