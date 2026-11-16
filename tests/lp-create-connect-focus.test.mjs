// Create's Connect GitHub (S049, S156: H6). Connect can be pressed in two places: GitHub's line under the
// Repository field (#cp-gh), and a failed clone's message ("This repo is private… Connect GitHub", #cp-err). The
// focus hand-off only looked at #cp-gh. Pressed from the message, a success cleared the message (error(""), the
// button with it) and nobody moved focus: it fell to the page. A code didn't move it to Copy either. Focus on either
// Connect is now focus on Connect, and goes where Connect leads: Copy for a code, the repository once connected, and
// a Connect again on failure.
//   node tests/lp-create-connect-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/create.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const connect = (() => { const i = src.indexOf("async function connect() {"); assert.ok(i > 0, "connect found"); return src.slice(i, src.indexOf("\n  }\n", i)); })();

t("a failed clone's message offers Connect GitHub (the second place Connect lives)", () => {
  assert.match(src, /const connect = \{ id: "connect", label: gh\.status === "connected" \? "Reconnect GitHub" : "Connect GitHub" \};/);
  assert.match(src, /\$\("#cp-err"\)[\s\S]{0,200}data-cp="\$\{action\.id\}"/);
});
t("focus on Connect means either place: GitHub's line or the message", () => {
  assert.match(connect, /const onConnect = \(\) => \{ const a = document\.activeElement; return !!a && \(\$\("#cp-gh"\)\.contains\(a\) \|\| \$\("#cp-err"\)\.contains\(a\)\); \};/);
});
t("connected (the message and its button go): focus that was on Connect lands on the repository", () => {
  assert.match(connect, /const was = onConnect\(\);\s*gh = next;/);
  assert.match(connect, /else \(gh\.status === "code" \? \$\("#cp-gh \[data-cp=copy\]"\) : repo\)\?\.focus/);
  assert.doesNotMatch(connect, /const inGh = \$\("#cp-gh"\)\.contains/, "no check that looks at GitHub's line alone");
});
t("a code: focus that was on either Connect lands on Copy", () => {
  assert.match(connect, /const was = onConnect\(\);\s*gh = \{ status: "code"[\s\S]{0,160}if \(was\) \$\("#cp-gh \[data-cp=copy\]"\)/);
});
t("a failure: the Connect you're on keeps focus; else GitHub line's Try again takes it", () => {
  assert.match(connect, /if \(gh\.status === "failed"\) \{ if \(!still\) \$\("#cp-gh \[data-cp=connect\]"\)\?\.focus/);
});
console.log(`${passed} passed${process.exitCode ? ", some failed" : ""}`);
