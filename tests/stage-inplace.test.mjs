// The panel's live parts are drawn in place, so the control you're on survives an update (the controls grader on
// 9d1f71b, C072–C074, all four cells: Tab to a frame's head under Launchpad; a live agent moves its count 1 → 2 → 3
// and the button was replaced, focus to BODY ~150 ms later: stage.js set it with innerHTML). Checked from the source:
// the heads under Launchpad and every list the panel keeps current go through js/redraw.js; innerHTML is left only
// for what's built once, and for icons inside a button that stays. The walk is the flows case C072–C074.
//   node tests/stage-inplace.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/stage.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("the heads under Launchpad and the live lists are drawn in place", () => {
  assert.ok(/import \{ redraw \} from "\.\/redraw\.js";/.test(src));
  assert.ok(/if \(g\._h !== html\) \{ redraw\(g, html\);/.test(src), "the heads (ghosts)");
  assert.ok(/if \(S\.h\[k\] !== same\) \{ redraw\(node, html\); S\.h\[k\] = same; \}/.test(src), "Agents, Changes, the panel's name and counts (set)");
});
t("innerHTML only for what's built once, or icons inside a button that stays", () => {
  const writes = [...src.matchAll(/(\w+(?:\([^)]*\))?)\.innerHTML = /g)].map((m) => m[1]);
  assert.deepEqual(writes.sort(), ['body("changes")', "el", "fb", "fw"].sort(), `innerHTML writes: ${writes.join(", ")}`);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
