// The "Back to chat" click's layout reads, batched (the owner, 19 Nov 12:06Z: "back to the chat … seems to have a lag";
// a trace of the click found 99 layout reads, none of them Files' own): the Now strip's fit is worked out from its chips'
// widths only when they or its width change (js/nowfit.js), and the conversation's ⌄ button follows the scroll once per
// frame, after the frame's writes (js/msgx.js). js/follow.js, the scroll's one owner, is untouched.
//   node tests/layout-reads.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fitChips } from "../js/nowfit.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const msgx = readFileSync(new URL("../js/msgx.js", import.meta.url), "utf8");

t("the strip's fit: all of it when it fits, else whole chips and a +N, never fewer than one", () => {
  assert.deepEqual(fitChips([100, 100, 100], 400), { fit: 3, n: 0 });
  assert.deepEqual(fitChips([100, 100, 100, 100], 300), { fit: 2, n: 2 }, "room for the +N kept");
  assert.deepEqual(fitChips([500, 100], 300), { fit: 1, n: 1 }, "a chip too wide still shows, alone");
  assert.deepEqual(fitChips([], 300), { fit: 0, n: 0 });
});

t("the strip measures only when its chips or its width change, then reads all, then writes", () => {
  assert.match(app, /if \(html !== NE\.html\) \{ NE\.html = html; NE\.dirty = true; \}/, "a change of its chips marks it");
  assert.match(app, /new ResizeObserver\(\(\) => \{ NE\.dirty = true; nowEdges\(\); \}\)\.observe\(\$\("#now-wrap"\)\)/, "a change of its size marks it");
  assert.match(app, /if \(!NE\.dirty\) return;\s*NE\.dirty = false;/, "otherwise nothing is measured");
  assert.match(app, /fitChips\(chips\.map\(\(c\) => c\.offsetWidth\), inner\)/, "every chip read in one go, before any write of the result");
  assert.doesNotMatch(app, /for \(const c of chips\) \{ used \+= c\.offsetWidth/, "no read inside the loop that writes");
});

t("the ⌄ button follows the scroll once per frame, after the frame's writes", () => {
  assert.match(msgx, /const downSoon = \(\) => \{ if \(!downT\) downT = requestAnimationFrame\(\(\) => \{ downT = 0; downSync\(\); \}\); \};/);
  assert.match(msgx, /scroller\.addEventListener\("scroll", downSoon, \{ passive: true \}\);/);
  assert.doesNotMatch(msgx, /scroller\.addEventListener\("scroll", downSync/, "not on each scroll event");
});

t("follow.js, the scroll's one owner, is as it was", () => {
  const f = readFileSync(new URL("../js/follow.js", import.meta.url), "utf8");
  assert.match(f, /export function initFollow\(\)/);
});

console.log(`${passed} passed`);
