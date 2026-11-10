// A thread that isn't here offers no message box (the create-project grader on 131d146, navigation-family
// reset-missing-thread-home, all four cells: the open thread went with a reset, "This thread isn't here." and Go to
// Home worked, but the composer stayed, its placeholder "Message undefined…": the placeholder's last branch named the
// project of a thread that no longer has one). The app marks the view gone; the composer isn't drawn for it, and focus
// that was in it goes to Go to Home (else the conversation's region), never to the page.
//   node tests/gone-thread-composer.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const r = (() => { const i = src.indexOf("function render() {\n  if (!world.state.loaded) return;"); assert.ok(i > 0); return src.slice(i, src.indexOf("\n}\n", i)); })();

t("the view says when its thread isn't here", () => {
  assert.match(r, /const gone = v\.startsWith\("t:"\) && !convThread\(v\);/);
  assert.match(r, /if \(appEl\.hasAttribute\("data-gone"\) !== gone\) appEl\.toggleAttribute\("data-gone", gone\);/);
});
t("a gone thread draws no composer; the line above it stays for what's said", () => {
  assert.match(css, /\.app\[data-gone\] \.composer\{display:none\}/);
  assert.match(css, /\.app\[data-gone\] \.cbar\{padding:0;background:none\}/);
});
t("focus in the composer as it goes: to Go to Home, else the conversation, never the page", () => {
  assert.match(r, /if \(gone && document\.activeElement === say\) \(\[\.\.\.msgsEl\.querySelectorAll\('\.calm-act \[data-go="home"\]'\)\]\.find\(usableEl\) \|\| placeRegion\(\)\)\.focus\(\{ preventScroll: true \}\);/);
});
t("the placeholder never names a project it doesn't have", () => {
  const f = src.slice(src.indexOf("function syncPlaceholder() {"), src.indexOf("\n}\n", src.indexOf("function syncPlaceholder() {")));
  assert.match(f, /const t = convThread\(S\.view\), pid = convProject\(S\.view\);/);
  assert.match(f, /: pid \? `Message \$\{PROJ\(pid\)\}…` : "Message";/, "a project only when there is one");
  assert.doesNotMatch(f, /`Message \$\{PROJ\(convProject/, "no unguarded lookup");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
