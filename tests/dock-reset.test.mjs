import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const body = (start, source = app) => { const i = source.indexOf(start); assert.ok(i >= 0, start); return source.slice(i, source.indexOf("\n}\n", i)); };
const page = readFileSync(new URL("../modules/conversation/thread-page.js", import.meta.url), "utf8").replace(/^ {2}/gm, "");
const dock = readFileSync(new URL("../modules/decisions/dock.js", import.meta.url), "utf8").replace(/^ {2}/gm, "");

t("the dock has one reset: its state, its contents and its observer together", () => {
  assert.match(dock, /function reset\(\) \{\n  Object\.assign\(TD, \{ key: null, item: null, busy: false, undone: null, gen: TD\.gen \+ 1 \}\);\n  tdock\._ch = "";\n  dockRO\.disconnect\(\);\n  dockSwap\(\(\) => tdock\.replaceChildren\(\)\);\n\}/);
  assert.match(dock, /return \{ render: dockRender, reset, TD, el: tdock \};/);
});
t("the Thread page resets its dock when it shows another thread, never its state alone", () => {
  assert.match(body("function tpShow(", page), /\(TP\.dock\)\)\.reset\(\);/);
  assert.doesNotMatch(page, /Object\.assign\(TP\.dock\.TD/);
  assert.doesNotMatch(app, /\.TD\.key = null/);
});
t("a decision's line and a withdrawal's line stop when their dock was reset under them", () => {
  const after = dock.slice(dock.indexOf("after: async (how) => {"));
  assert.match(after, /TD\.busy = true;\n\s*const gen = TD\.gen;/);
  assert.match(after, /await wait\(380\); if \(TD\.gen !== gen\) return; \}/);
  assert.match(after, /if \(TD\.gen !== gen\) return;\n\s*TD\.undone = null;/);
  assert.match(body("async function goneRender(", dock), /const gen = TD\.gen;\n  await hold\(3000\);\n  if \(TD\.gen !== gen\) return;/);
});
t("both docks start at generation 0", () => {
  assert.match(dock, /function createDock\(\{ el: tdock, view, region, TD = \{ key: null, item: null, busy: false, undone: null, gen: 0 \} \}, \{/);
  assert.match(app, /const MDOCK = createDock\(\{[^\n]*TD: \{ key: null, item: null, busy: false, undone: null, gen: 0 \} \}, dockDeps\);/);
});
console.log(`\n${passed} passed`);
