// Fit shows the drawing as drawn (the map grader on 65e84b7, S207/S082, all four cells: the top's read failed, a
// pointer Fit, and its "Couldn't read it · Try again" stood 4.40 px past the view at 1440 and 5.87 px at 390). The
// layout gives every box 148 px; a note or "N more" is as wide as its words. So the drawing's extent for Fit and for
// the first look is the layout's out to the boxes' real edges, measured once per drawing while the view is on screen,
// and again when the font arrives. Checked from the source; the drawn result is the flows case "S207/S082 (Try
// again)" and the grader's root-error-geometry.
//   node tests/map-reach.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMapCamera } from "../modules/map/camera.js";

const src = readFileSync(new URL("../js/map.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("Fit and the first look include measured edges and only measure visible drawings once", () => {
  const viewport = { clientWidth: 0, clientHeight: 200 };
  const box = { offsetLeft: 60, offsetWidth: 180, offsetTop: 30, offsetHeight: 45 };
  const bounds = { x0: 0, y0: 0, x1: 148, y1: 32 };
  const M = { cams: new Map(), mode: "tree", bounds, reach: null, reachKey: "", layoutKey: "one", alpha: 0 };
  let scans = 0;
  const camera = createMapCamera({ M, view: () => viewport, world$: () => null, tagW: () => 22,
    clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
    host: () => ({ querySelectorAll(selector) { assert.equal(selector, ".dg-nodes > .dg-n"); scans++; return [box]; } }),
  });
  const c = camera.camOf({ kind: "thread", key: "t:one" });
  camera.fit(c, false, true);
  assert.equal(scans, 0, "a hidden drawing is not measured");
  viewport.clientWidth = 200;
  camera.frame(c);
  assert.deepEqual(c.fitB, { x0: 0, y0: 0, x1: 268, y1: 103 });
  assert.equal(c.s, 176 / 268);
  camera.fit(c, false, true);
  assert.equal(scans, 1, "fit and first look share the measurement");
  M.layoutKey = "two";
  box.offsetWidth = 200;
  camera.fit(c, false, true);
  assert.equal(scans, 2);
  assert.equal(c.fitB.x1, 288);
});
t("the font arriving measures again", () => {
  assert.match(src, /document\.fonts\.addEventListener\("loadingdone", \(\) => \{ M\.reachKey = ""; \}\)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
