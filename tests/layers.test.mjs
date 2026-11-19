// Cascade layers change no winner: one order of layers, declared first, and a sheet in a layer wins and loses where load order made it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ORDER, declarations, turned } from "./lib/layers.mjs";

const ROOT = new URL("../", import.meta.url);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

// contests the analysis can't tell apart from turned ones, each read and found to be different elements
const READ = [
  [/^core\/ui\/tokens\.css :root\[data-theme="light"\] :is\(\.toast,\.lbx\) \{--ink-[34]:#[0-9A-F]{6}\} vs css\/foundation\.css :where\(button,\[role=button\]/, "the toast is a div[role=status] and the lightbox a div[role=dialog]: neither is a control the hover rule names"],
  [/^core\/ui\/tokens\.css :root\[data-theme="light"\] :is\(\.toast,\.lbx\) \{color:var\(--ink\)\} vs css\/diffs\.css \.vw-menu :is\(\[role=menuitem\]/, "a viewer menu's item is never the toast or the lightbox"],
];

const all = declarations(["js/vendor/katex/katex.min.css"]);

t("the layers are declared once, in order, before anything else the page styles", () => {
  const first = /<link rel="stylesheet" href="\.\/([^"]+)">/.exec(readFileSync(new URL("index.html", ROOT), "utf8"));
  assert.ok(first, "a first stylesheet");
  const css = readFileSync(new URL(first[1], ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const m = /^@layer\s+([\w\s,.-]+);/.exec(css);
  assert.ok(m, `${first[1]} starts with the layers' order`);
  assert.deepEqual(m[1].split(",").map((s) => s.trim()), ORDER);
});
t("every layer a sheet names is one of them", () => {
  const used = [...new Set(all.map((d) => d.layer).filter(Boolean))];
  assert.ok(used.length >= 3, `layers in use: ${used.join(", ")}`);
  for (const l of used) assert.ok(ORDER.includes(/** @type {string} */ (l)), `${l} is declared`);
});
t("no contest turns: what won by load order still wins", () => {
  const left = turned(all).filter((c) => !READ.some(([re]) => re.test(c)));
  assert.deepEqual(left, []);
});
t("every contest read by hand is still there to read (else it leaves the list)", () => {
  const now = turned(all);
  for (const [re, why] of READ) assert.ok(now.some((c) => re.test(c)), `${re}: ${why}`);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
