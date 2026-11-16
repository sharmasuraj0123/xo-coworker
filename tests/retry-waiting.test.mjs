// The file renderer's Try again says it's trying while the renderer loads (the controls grader on 9d1f71b, S139, all
// four cells: with the renderer's module held, "Couldn't show this file" and a ready-looking Try again stood at 150 and
// 800 ms; viewer.js kept the draw's pending state to itself). Checked from the source: every draw that starts over a
// failure notice paints the waiting state in place (status, words, Try again busy); a press while it's busy does
// nothing more; drawn, the notice goes; failed again, it says so again. The drawn states are the flows case
// "S139 (waiting)".
//   node tests/retry-waiting.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
const body = (name) => { const i = src.indexOf(`function ${name}(`); if (i < 0) return null; let d = 0; const j = src.indexOf("{", i); for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) return src.slice(j, k + 1); } return null; };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const has = (s, re, msg) => assert.ok(re.test(s || ""), `${msg} (${re})`);
t("a draw over a failure notice paints the waiting state before the renderer answers", () => {
  const d = body("drawFile");
  assert.ok(d, "drawFile");
  const start = d.indexOf("FL.pend = key;"), awaitAt = d.indexOf("await DV.file(");
  assert.ok(start > 0 && awaitAt > start, "the draw starts, then waits for the renderer");
  const before = d.slice(start, awaitAt);
  has(before, /const again = host\.querySelector\(":scope > \.vw-empty \[data-vw-retry\]"\)/, "it finds the failure's Try again");
  has(before, /box\.setAttribute\("role", "status"\)/, "said, as a status");
  has(before, /textContent = "Drawing this file…"/, "the words: what's happening");
  has(before, /again\.setAttribute\("aria-busy", "true"\); again\.setAttribute\("aria-disabled", "true"\); again\.textContent = "Trying again…"/, "Try again: busy");
  has(d, /for \(const x of host\.querySelectorAll\(":scope > \.vw-empty"\)\) x\.remove\(\)/, "drawn: the notice goes");
  has(d, /Couldn't show this file\.[\s\S]*data-vw-retry>Try again</, "failed again: said again, Try again ready");
});
t("a press while it's trying does nothing more", () => {
  const i = src.indexOf(`if (e.target.closest('[data-vw-retry][aria-busy="true"]')) return;`), j = src.indexOf(`if (e.target.closest("[data-vw-retry]")) {`);
  assert.ok(i > 0 && j > i, "the busy Try again is passed over before the press acts");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
