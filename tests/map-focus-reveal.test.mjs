// The Map's frame never scrolls: the camera is the only thing that moves the drawing (the Files/Map grader on 131d146,
// S208, 1440 light Graph: Tab traversal back to Follow scrolled the frame by itself, scrollTop 121, since .dg was
// overflow:hidden, a scroll container the browser scrolls to show a focused node; the camera's placement knew nothing
// of it, so with Follow on and settled the agent's arrow sat at y 644–688 against the frame's top at 680, 36 of its 43
// px clipped). The frame clips without scrolling; a node the keyboard reaches outside it is brought in by the camera,
// at once, before the browser would scroll for it; and when focus leaves the drawing while Follow is on, the camera
// goes back to the agent.
//   node tests/map-focus-reveal.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const src = readFileSync(new URL("../js/map.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the frame clips without being a scroll container", () => {
  const r = /(?:^|[}\n])\.dg\{([^}]*)\}/.exec(css);
  assert.ok(r, "the .dg rule");
  assert.match(r[1], /overflow:clip/);
  assert.doesNotMatch(r[1], /overflow:(hidden|auto|scroll)/);
});
t("keyboard focus on something in the drawing out of the frame: the camera brings it in, at once, Follow untouched", () => {
  const i = src.indexOf("function reveal(t) {");
  assert.ok(i > 0, "reveal");
  const f = src.slice(i, src.indexOf("\n  }\n", i));
  assert.match(f, /const c = camOf\(M\.scope\)/);
  assert.match(f, /c\.x \+= dx; c\.y \+= dy; c\.user = true; c\.fitAll = false; applyCam\(c, false\);/, "no glide: in place before the browser looks");
  assert.doesNotMatch(f, /c\.follow\s*=/, "it never turns Follow off");
  const w = src.slice(src.indexOf("function wire(v) {"), src.indexOf("function tool("));
  assert.match(w, /v\.addEventListener\("focusin", \(e\) => \{ if \(e\.target !== v && e\.target\.closest\("\.dg-world"\)\) reveal\(e\.target\); \}\);/);
});
t("focus leaving the drawing while Follow is on: the camera goes back to the agent", () => {
  const w = src.slice(src.indexOf("function wire(v) {"), src.indexOf("function tool("));
  assert.match(w, /v\.addEventListener\("focusout", \(e\) => \{/);
  assert.match(w, /if \(c\.follow && M\.lead\) keepInView\(c, M\.lead\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
