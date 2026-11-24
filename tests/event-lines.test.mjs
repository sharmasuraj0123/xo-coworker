// An event line ("Allowed · …", "Asked the coordinator: …") is a quiet note: a bare mark at the icon size, no disc, and lines in a row sit close.
import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { readFileSync } from "node:fs";
const css = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8");
const appCss = sheet(new URL("../css/app.css", import.meta.url));
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the mark is bare, at --ic, in every look", () => {
  assert.match(appCss, /\n\.ev-ic\{flex:none;display:grid;place-items:center;width:var\(--ic\);height:var\(--ic\);margin:0 4px;color:var\(--accent\)\}/);
  const evRules = [...appCss.matchAll(/[^}\n]*\.ev-ic\{[^}]*\}/g)].map((m) => m[0]);
  assert.equal(evRules.some((r) => /background|border-radius/.test(r)), false, evRules.join("\n"));
  assert.match(css("../modules/conversation/msgx.css"), />\.ev>\.ev-ic\{width:var\(--ic\);margin:0 6px\}/);
  assert.match(css("../core/ui/markdown/rich.css"), />\.ev>\.ev-ic\{margin:0 var\(--s-1\)\}/);
});
t("event lines in a row sit 8 px apart", () => {
  assert.match(css("../core/ui/markdown/rich.css"), />\.ev:has\(\+\.ev\)\{margin-bottom:var\(--s-2\)\}/);
  assert.match(css("../core/ui/markdown/rich.css"), />\.ev\+\.ev\{margin-top:var\(--s-2\)\}/);
});
t("a decision line starts with its verb, not \"You\"", () => {
  assert.match(app, /text: `\$\{d\.verb\} · \$\{d\.said \|\| d\.label\}`/);
  assert.doesNotMatch(app, /`You \$\{d\.verb\.toLowerCase\(\)\}/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
