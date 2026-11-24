// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { dom } from "./lib/dom.mjs";

const { window, document } = await dom('<div id="tree"></div><div id="graph"></div>');
const frames = new Map();
let frameId = 0, mode = "tree", boxWidth = 100;
let target = "/home/coder/project/one.js";
const dimensions = { clientWidth: 520, clientHeight: 400, offsetWidth: 100, offsetHeight: 32, offsetLeft: 0, offsetTop: 0 };
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
  requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
  cancelAnimationFrame(id) { frames.delete(id); },
  fetch: async () => Response.json({ dirs: [], files: ["one.js", "two.js", "three.js"].map((name) => ({ name })) }),
});
Object.defineProperty(globalThis, "performance", { value: { now: () => Date.now() } });
const { createMap } = await import("../modules/map/map.js");
const thread = { id: "worker", title: "Worker", project: "project", cwd: "/home/coder/project", state: "working", sessionId: "worker" };
const turn = { session: "worker", status: "running", at: "2026-11-24T05:00:00Z" };
const world = {
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

mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1 });
try {
  for (const view of ["tree", "graph"]) {
    mode = view;
    target = "/home/coder/project/one.js";
    const host = document.getElementById(view);
    const spoken = [];
    const map = createMap({ world, go() {}, announce: (text) => spoken.push(text), isBusy: () => true, openFile() {}, stepLineHtml: () => "" });
    map.render("t:worker");
    map.mount(host);
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
    }
    map.hide();
  }
} finally {
  mock.timers.reset();
}
