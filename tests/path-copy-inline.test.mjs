// A file XO can't show offers its path with a labelled Copy button: its words are its name and say Copying… and Copied
// where you can see them (the controls grader's lead on 1ed50f6, S125 / V97: the inline button took the head's
// icon-only class, .vw-btn, whose words panel.css hides, so it had no accessible name and its Copied never showed).
//   node tests/path-copy-inline.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
const css = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const line = src.split("\n").find((l) => l.includes('class="vw-path"')) || "";

t("the inline Copy path is a labelled button, not the head's icon-only one", () => {
  assert.ok(line, "the unavailable file's path line");
  assert.match(line, /<button type="button" class="btn vw-path-copy" data-vw-copy-path/);
  assert.doesNotMatch(line, /class="vw-btn"/);
});
t("its words are drawn: Copy the path, Copying… while it outlasts a moment, Copied once it's done", () => {
  assert.match(line, /<span>\$\{V\.copied \? "Copied" : V\.busy && V\.busy\.kind === "copy" && V\.busy\.shown \? "Copying…" : "Copy the path"\}<\/span>/);
  assert.ok(!/(^|[},])\s*\.btn span\{[^}]*display:none/.test(css) && !/\.vw-path-copy span\{[^}]*display:none/.test(css), "nothing hides them");
  assert.ok(/\.vw-path-copy svg\{width:14px;height:14px\}/.test(css), "its icon at the inline size");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
