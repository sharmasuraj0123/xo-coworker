// A step's line reads in the row's face: a sub-agent's title is words, not code; a file target stays code.
//   node tests/step-line-face.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { stepLineHtml } = await import("../js/turnview.js");
const sub = stepLineHtml("Sub-agent: `Read-only regression review`", "subagent");
assert.equal(sub, "Sub-agent: Read-only regression review");
assert.equal(stepLineHtml("Sub-agent: `<b>`", "subagent").includes("<b>"), false, "the title is escaped");
assert.match(stepLineHtml("Edited `app.py`", "edit_file"), /<code[^>]*>app\.py<\/code>/);
const tv = readFileSync(new URL("../js/turnview.js", import.meta.url), "utf8");
const map = readFileSync(new URL("../js/map.js", import.meta.url), "utf8");
assert.match(tv, /said \? esc\(said\) : stepLineHtml\(commsText\(r\.line\) \|\| "", r\.kind\)/);
assert.match(map, /stepLineHtml\(commsText\(ag\.now\.line\) \|\| ag\.now\.tool \|\| "Working", ag\.now\.kind\)/);
console.log("step-line-face: ok");
