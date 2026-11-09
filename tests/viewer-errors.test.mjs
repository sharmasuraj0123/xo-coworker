// A save, download, copy or undo that failed is said the same way in every view of the viewer (the controls grader on
// e55c2d8, S126: in the Changes view, Download held then refused, and the screen went back to "Binary file · Download"
// saying nothing; the diff's branch drew no error line, where the file's and the plain one did). One place draws what
// sits above every body: the tabs, the head, and the failure. Checked from the source; drawn, the flows case "S126".
//   node tests/viewer-errors.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const i = src.indexOf("function renderNow()"), body = src.slice(i, src.indexOf("\n  }\n", i));

t("one place draws the failure, with the tabs and the head", () => {
  assert.match(src, /const above = \(\) => \(tabs \? tabs\(\) : ""\) \+ head\(\) \+ \(V\.saveError \? `<p class="vw-cut" role="alert">/);
  assert.equal((src.match(/V\.saveError \? `<p class="vw-cut" role="alert">/g) || []).length, 1, "and nowhere else");
});
t("every branch of the viewer draws it: the file, the change, the plain view", () => {
  const draws = [...body.matchAll(/el\.innerHTML = ([^;]+);/g)].map((m) => m[1]);
  assert.equal(draws.length, 3, "three branches");
  for (const d of draws) assert.match(d, /^above\(\) \+/, `starts with above(): ${d.slice(0, 60)}`);
  assert.doesNotMatch(body, /head\(\) \+/, "no branch draws the head on its own");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
