import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const app = sheet(new URL("../css/app.css", import.meta.url)), tokens = read("core/ui/tokens.css"), js = read("modules/conversation/mention.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const rule = (sel) => { const i = app.indexOf("\n" + sel + "{"); assert.ok(i >= 0, sel); return app.slice(i + sel.length + 2, app.indexOf("}", i)); };

t("one token for both lists: a height and their own scroll", () => {
  assert.match(tokens, /--pop-list-h:min\(296px,40dvh\);/);
  assert.match(rule(".iq-list"), /max-height:var\(--pop-list-h\);overflow-y:auto;/);
  assert.match(rule(".at-list"), /overflow-y:auto;overscroll-behavior:contain;/);
});
t("the @ list never reaches past the top bar", () => {
  assert.match(rule(".at-list"), /^max-height:min\(var\(--pop-list-h\),var\(--at-room,100dvh\) - var\(--h-bar\) - var\(--s-3\)\);/);
  assert.match(js, /at\.style\.setProperty\("--at-room", `\$\{Math\.round\(K\.form\.getBoundingClientRect\(\)\.top\)\}px`\)/, "its own composer's top (the main chat's or the panel's)");
});
t("the keyboard's row is kept in view by the list's own scroll, never scrollIntoView", () => {
  assert.match(js, /if \(li\.offsetTop < at\.scrollTop\) at\.scrollTop = li\.offsetTop;/);
  assert.doesNotMatch(js.slice(js.indexOf("const li = at.children[at._sel]"), js.indexOf("function atClose")), /scrollIntoView\(/);
});
console.log(`\n${passed} passed`);
