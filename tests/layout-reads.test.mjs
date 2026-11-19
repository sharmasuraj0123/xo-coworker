// The "Back to chat" click's layout reads, batched (the owner, 19 Nov 12:06Z: "back to the chat … seems to have a lag";
// a trace of the click found 99 layout reads, none of them Files' own): the conversation's ⌄ button follows the scroll
// once per frame, after the frame's writes (js/msgx.js). js/follow.js, the scroll's one owner, is untouched. (The Now
// strip, whose fit was the other half, left the header for the panel's Threads on 19 Nov.)
//   node tests/layout-reads.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const msgx = readFileSync(new URL("../js/msgx.js", import.meta.url), "utf8");

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
