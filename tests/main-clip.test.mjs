// The page's main area can't be scrolled by anything (the controls grader on 65e84b7, S138 on a phone: after Close on
// the Created notice, the editor's own scrollIntoView, Pierre's, scrolled MAIN#main to 262 and the file out of sight;
// window and every other ancestor stayed at 0). A box with overflow:hidden is still a scroll container a script can
// scroll; overflow:clip isn't. Checked from the CSS; the drawn result is the flows case S138 (Created) by pointer.
//   node tests/main-clip.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../css/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("the main area clips (not hidden: a script could scroll that)", () => {
  const m = /(?:^|\})\s*\.main\{position:relative;[^}]*\}/.exec(app);
  assert.ok(m, ".main's own rule");
  assert.match(m[0], /overflow:clip/);
  assert.doesNotMatch(m[0], /overflow:hidden/);
  assert.ok(!/(?:^|[}\s])\.main\{[^}]*overflow:(hidden|auto|scroll)/.test(app), "no other .main rule makes it a scroll container");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
