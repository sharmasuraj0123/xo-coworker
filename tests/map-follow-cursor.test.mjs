// Follow keeps the followed agent's cursor in view: its arrow, and its name beside it where there's room, never only the
// middle of the box it's on (the controls grader's S208-moving-follow, 03:21; reproduced on 70375ad, Tree at 1440: at
// the zoom you chose, 2.4, the agent moved to a far file, and Follow put that box's middle in view while the arrow, at the
// box's edge, stood off the view's left). The lead carries the arrow's own point, its side and its name's width; the
// view is nudged by the least move that brings them inside its margins, the arrow first when both can't fit.
//   node tests/map-follow-cursor.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMapDrawing } from "../modules/map/drawing.js";
import { dom } from "./lib/dom.mjs";

const src = readFileSync(new URL("../modules/map/camera.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const body = (name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf("\n  }\n", i)); };

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
  const k = body("keepInView");
  assert.match(k, /function keepInView\(c, lead\)/);
  assert.match(k, /const a = lead\.at, tw = lead\.tw \|\| 0;/);
  assert.match(k, /const arrow = \[a\.x - 2, a\.x \+ 16\]/, "the arrow's own box, in the drawing's units");
  assert.doesNotMatch(k, /pt\.x \* c\.s/, "not the box's middle");
  assert.match(src, /keepInView\(c, lead\)/, "called with the lead");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
