import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";

const app = sheet(new URL("../css/app.css", import.meta.url));
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
