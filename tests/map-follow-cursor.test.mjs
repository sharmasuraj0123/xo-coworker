import assert from "node:assert/strict";
import { createMapCamera } from "../modules/map/camera.js";
import { createMapDrawing } from "../modules/map/drawing.js";
import { dom } from "./lib/dom.mjs";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const { document } = await dom('<main><svg class="dg-edges"></svg><div class="dg-nodes"></div><div class="dg-curs"></div></main>');
t("the lead carries the arrow’s point, side and measured tag", () => {
  const host = document.querySelector("main");
  const M = { scope: { key: "t:work", kind: "thread" }, refs: new Map(), curs: new Map(), mode: "graph", open: true,
    gpos: new Map(), gnodes: [], gedges: [], gags: [], glit: new Map(), gkey: "", layoutKey: "", raf: 0, alpha: 0, bounds: null };
  const pendingFrames = [];
  globalThis.requestAnimationFrame = (callback) => pendingFrames.push(callback);
  const drawing = createMapDrawing({ M, host: () => host, verbOf: () => "reading", tagW: () => 22, focusNode() {}, camOf: () => null, frame() {}, clamp: Math.min });
  const agent = { id: "agent", nid: "file", busy: true, go: "t:work", color: "blue" };
  const locate = () => ({ x: 30, y: 40, cx: 90, cy: 50, side: "left" });
  drawing.cursors([agent], locate);
  const cursor = host.querySelector(".dg-cur");
  Object.defineProperty(cursor.querySelector(".dg-tag"), "offsetWidth", { value: 36 });
  drawing.cursors([agent], locate);
  assert.ok(host.querySelector(".dg-cur") === cursor, "the cursor is reused");
  assert.deepEqual(M.lead, { key: "agent@file", pt: { x: 68, y: 50 }, at: { x: 30, y: 40 }, side: "left", tw: 36 });
  const nodes = [{ id: "root", kind: "root", parent: null, name: "Project" }, { id: "file", kind: "file", parent: "root", name: "README.md" }];
  drawing.paintGraph(M.scope, nodes, [agent], new Map());
  assert.equal(host.querySelector(".dg-edges line").getAttribute("class"), "k-file");
  assert.ok(host.querySelector(".dg-cur") === cursor, "graph painting retains the same agent cursor");
  assert.equal(pendingFrames.length, 2, "cursor entry and graph settling each request one frame");
});
t("Follow keeps the arrow in view (and its name where there's room), never the box's middle alone", () => {
  const host = document.querySelector("main");
  const M = { mode: "graph", bounds: { x0: 0, y0: 0, x1: 400, y1: 300 } };
  const camera = createMapCamera({ M, host: () => host, world$: () => host, view: () => ({ clientWidth: 400, clientHeight: 344 }) });
  const cam = { x: 0, y: 0, s: 1, follow: true, user: true };
  M.lead = { key: "a", at: { x: 4, y: 150 }, pt: { x: 200, y: 150 }, tw: 32, side: "left" };
  camera.frame(cam);
  assert.ok(cam.x + 4 - 36 >= 48, "the arrow and its measured tag clear the left margin");
  M.lead = { ...M.lead, key: "b", at: { x: 396, y: 150 }, tw: 1000 };
  camera.frame(cam);
  assert.ok(cam.x + 396 + 16 <= 352, "when the tag cannot fit, the complete arrow stays visible");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
