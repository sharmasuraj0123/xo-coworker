// The panel's head and marks are drawn from the page stack on every paint; nothing outside paint resets what it drew
//   node tests/stage-head-back.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const stage = readFileSync(new URL("../js/stage.js", import.meta.url), "utf8");
const code = stage.replace(/\/\/[^\n]*/g, "");

// every transition: the head on screen is the head the stack gives
const setLine = stage.match(/const set = \(k, node, html\) => \{[^\n]*\};/)[0];
const th = stage.slice(stage.indexOf("  function titleHtml("), stage.indexOf("  let nameOf"));
const pcAt = stage.indexOf("  function pageChanged(");
let pcEnd = stage.indexOf("{", pcAt);
for (let d = 0; ; pcEnd++) { if (stage[pcEnd] === "{") d++; else if (stage[pcEnd] === "}" && --d === 0) break; }
const pc = stage.slice(pcAt, pcEnd + 1);
const init = stage.match(/const S = \{[^\n]*?\};/)[0].replace(/^const S = /, "(").replace(/;$/, ")");
const sim = new Function(`
  const S = ${init};
  const PAGES = new Map([["thread", {}], ["files", { lead: () => '<button class="pg-lead"></button>' }], ["shell", {}]]);
  const pageTitle = (t) => t.name + ":" + t.key, sectionsNeed = () => false, esc = (x) => x, ICON = { back: "‹" };
  let screen = "";
  const redraw = (node, html) => { screen = html; };
  ${setLine}
  ${th}
  const paint = () => { if (S.open) set("head", null, titleHtml()); };
  const el = { querySelector: () => null }, onChange = null;
  ${pc}
  const go = (page, under = null, open = true) => { S.page = page; S.under = under; S.open = open; pageChanged(); return screen === titleHtml(); };
  const T = (k) => ({ name: "thread", key: k });
  return [
    ["sections", go(null)],
    ["sections to a thread", go(T("a"))],
    ["thread to another thread", go(T("b"))],
    ["back to the sections", go(null) && screen === ""],
    ["sections to Files", go({ name: "files", key: "files" })],
    ["a shell over Files", go({ name: "shell", key: "x" }, { name: "files", key: "files" })],
    ["back to Files", go({ name: "files", key: "files" })],
    ["another project drops the pages", go(null) && screen === ""],
    ["a thread, then Home closes the panel", go(T("c")) && (go(null, null, false), true)],
    ["the next project opens it bare", go(null) && screen === ""],
  ];`);
for (const [what, ok] of sim()) assert.equal(ok, true, what);
// the drawn-html cache is paint's alone: written only by its set, reset by no caller
assert.equal((code.match(/S\.h\b/g) || []).length, 2, "S.h: set's read and write only");
assert.match(stage, /const set = \(k, node, html\) => \{[^\n]*if \(S\.h\[k\] !== same\) \{ redraw\(node, html\); S\.h\[k\] = same; \} \};/);
assert.match(stage, /function pageChanged\(\) \{ paint\(\); onChange && onChange\(\); \}/);
// the page marks are derived in paint, not pushed by each transition
assert.match(stage, /function paint\(\) \{\n\s*reflect\(\);\n\s*if \(!S\.open\) return;/);
assert.doesNotMatch(code, /\bmark\(\)|is-shell/);
assert.equal((code.match(/\breflect\(\)/g) || []).length, 2, "reflect: defined once, called by paint only");

console.log("stage-head-back: ok");
