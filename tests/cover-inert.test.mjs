// The panel's cover releases everything it made inert, wherever it is now (the controls grader on 9d1f71b, a phone, both
// themes: the panel open, a file from it, the chat unfolded and folded, Back to chat: #fdock and #composer kept the
// panel's inert after it closed, so the message box took no typing; its release walked the notices' line's path,
// and that line had moved out of the folded chat). Checked from the source: what should be inert is worked out whole
// each time; every mark not in it is released; only what isn't inert already is marked; it's worked out again on each
// sync. The walk in a browser is the flows case C029/F08.
//   node tests/cover-inert.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/stage.js", import.meta.url), "utf8");
const body = (name) => { const i = src.indexOf(`function ${name}(`); if (i < 0) return null; let d = 0; const j = src.indexOf("{", i); for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) return src.slice(j, k + 1); } return null; };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("worked out whole, released wherever, marked only where not inert already", () => {
  const b = body("coverSync");
  assert.ok(b, "coverSync");
  assert.ok(/const want = new Set\(\);/.test(b), "what should be inert, as a set");
  assert.ok(/if \(on && el\.parentElement\) walk\(el\.parentElement\);/.test(b), "only while it covers");
  assert.ok(/for \(const n of document\.querySelectorAll\("\[data-stage-inert\]"\)\) if \(!want\.has\(n\)\) \{ n\.inert = false; delete n\.dataset\.stageInert; \}/.test(b), "every stale mark released, wherever it is");
  assert.ok(/for \(const n of want\) if \(!n\.inert\) \{ n\.inert = true; n\.dataset\.stageInert = ""; \}/.test(b), "marked only where not inert already");
  assert.ok(!/else if \(!on && "stageInert" in n\.dataset\)/.test(b), "no release that follows a path");
});
t("worked out again on each sync, while the panel is open or a mark is left", () => {
  const s = body("sync");
  assert.ok(/if \(S\.open \|\| document\.querySelector\("\[data-stage-inert\]"\)\) coverSync\(\);/.test(s));
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
